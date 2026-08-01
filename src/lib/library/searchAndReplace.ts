import path from "node:path";
import { loadMovies, updateMovie } from "@/lib/library/store";
import { DEFAULT_QUALITY_PROFILES } from "@/lib/library/qualityProfiles";
import { encodeLibraryRef } from "@/lib/library/types";
import { searchFromCache } from "@/lib/indexers/rssCache";
import { MOVIE_CATEGORY_IDS } from "@/lib/indexers/categories";
import { parseRelease } from "@/lib/naming/parser";
import { releaseTitleMatches, yearIsCompatible } from "@/lib/library/matching";
import { withinSizeLimit, loadReleaseRules, normalizeCodec } from "@/lib/library/releaseRules";
import { isBlockedForAutoGrab } from "@/lib/library/decisionGuard";
import { applyCustomFormats, searchMovie } from "@/lib/indexers/torznab";
import { isRecentlyFailedRelease } from "@/lib/library/failedReleases";
import { buildGrabPayload } from "@/lib/indexers/grabPayload";
import { ENGINE_BASE, engineHeaders, ENGINE_TIMEOUT_MS } from "@/lib/engine/server";
import { emitNotification } from "@/lib/notifications/store";
import { loadIndexers } from "@/lib/indexers/store";
import { withoutRateLimited } from "@/lib/indexers/rateLimit";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import { isUpgradeIgnored } from "@/lib/library/ignoredUpgrades";
import { getMediaIndex, type MediaIndexEntry } from "@/lib/library/mediaIndex";
import type { IndexerRelease } from "@/lib/indexers/types";

/**
 * "Rechercher et remplacer" (LOT2.3) — a deliberately separate, on-demand
 * counterpart to checkQualityUpgrades() in autoGrab.ts. That task only ever
 * upgrades on RESOLUTION and runs unattended/automatically; this only
 * SUGGESTS — never grabs on its own — when a release is a same-or-better
 * resolution than the file currently owned and wins on one of three
 * independent, user-configured signals (language, custom formats, or codec —
 * see findUpgradeCandidates() below). Never imposes anything: it only ever
 * compares against rules the user themselves already configured.
 */

const RESOLUTION_ORDER = ["480p", "720p", "1080p", "2160p"];
const rank = (res: string | null) => (res ? RESOLUTION_ORDER.indexOf(res) : -1);

export interface UpgradeCandidate {
  movieId: string;
  title: string;
  currentVersion: string;
  currentFormatScore: number;
  currentSize: number;
  detectedVersion: string;
  detectedFormatScore: number;
  size: number;
  /** Translation key + params, same pattern as the dashboard Hero's SuggestionScore.reasons — never a raw string baked server-side, so every locale renders it correctly. */
  reasonKey: "languageUpgrade" | "audioCodecUpgrade" | "videoCodecUpgrade" | "resolutionUpgrade" | "customFormatUpgrade" | "codecUpgrade";
  reasonParams?: Record<string, string>;
}

/** Score of a file's video codec against the user's own configured `codecScores` (Settings → Qualité) — unknown/undetected codecs are treated as the neutral baseline (0), same as score() in torznab.ts. */
function codecScore(videoCodec: string | null, rules: ReturnType<typeof loadReleaseRules>): number {
  const codec = normalizeCodec(videoCodec);
  return codec ? rules.codecScores[codec] ?? 0 : 0;
}

/**
 * Hands control back to the event loop — the per-movie work below (regex
 * title matching + custom-format scoring against every cached release) is
 * real synchronous CPU time, and a library of thousands of movies run
 * through it back-to-back with no gap starves every other concurrent
 * request on the server for the whole scan's duration (seen live: a single
 * run left /api/health itself taking 1s+ and other unrelated endpoints
 * timing out at 45-60s). Yielding once per movie costs effectively nothing
 * in wall-clock time but lets pending I/O and other requests interleave.
 */
export function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function versionLabel(resolution: string | null, videoCodec: string | null, audioCodec: string | null): string {
  return [resolution, videoCodec, audioCodec].filter(Boolean).join(" · ") || "?";
}

/** True when the candidate is a real upgrade — not just the same file re-downloaded under a different release name. */
function isMeaningfulUpgrade(candidate: { release: IndexerRelease; parsed: ReturnType<typeof parseRelease> }, movie: { file: { size: number; resolution: string | null; videoCodec: string | null } | null }, isLanguage = false): boolean {
  if (!movie.file || isLanguage) return true;
  const r = candidate.parsed;
  if (rank(r.resolution) > rank(movie.file.resolution)) return true;
  if (r.videoCodec && movie.file.videoCodec && normalizeCodec(r.videoCodec) !== normalizeCodec(movie.file.videoCodec)) return true;
  const sizeDiff = Math.abs((candidate.release.size - movie.file.size) / Math.max(movie.file.size, 1));
  return sizeDiff >= 0.10; // at least 10% size difference
}

/**
 * Read-only — never grabs anything. Two independent kinds of upgrade are
 * detected per movie, and the language one takes priority when both apply:
 *
 * - Language upgrade: the owned file is Quebec French (VFQ) and a France
 *   French (VF — VFF/TRUEFRENCH/VF2/VFI all normalize to this, see
 *   naming/parser.ts) release exists at the same or better resolution.
 *   Independent of custom formats entirely — a regional dub preference, not
 *   a quality-score comparison.
 * - Custom-format upgrade (unchanged): a release scores higher than the
 *   owned file against the user's own configured favorite/forbidden terms.
 */
function computeSafeMatches(
  releases: IndexerRelease[],
  movie: { title: string; year: number | null },
  currentResolution: string | null,
  rules: ReturnType<typeof loadReleaseRules>,
  profile: { allowedResolutions: string[] }
) {
  return releases
    .map((r) => ({ release: r, parsed: parseRelease(r.title) }))
    .filter(({ parsed }) => releaseTitleMatches(parsed.title, movie.title))
    .filter(({ parsed }) => yearIsCompatible(parsed.year, movie.year))
    .filter(({ release }) => !isBlockedForAutoGrab(release.title, rules, movie.title).blocked)
    .filter(({ parsed }) => parsed.resolution && profile.allowedResolutions.includes(parsed.resolution))
    // Equal or better resolution only — a "replace" is never a downgrade in quality.
    .filter(({ parsed }) => rank(parsed.resolution) >= rank(currentResolution))
    .filter(({ release }) => !isRecentlyFailedRelease(release.infoHash));
}

/**
 * Finds the best release matching `targetLanguage` in `matches` — shared by
 * the cache pass and the direct-search fallback pass below.
 */
function bestLanguageMatch(
  matches: ReturnType<typeof computeSafeMatches>,
  targetLanguage: string
) {
  return matches
    .filter(({ parsed }) => parsed.language && languageSatisfies(targetLanguage, parsed.language))
    .sort((a, b) => rank(b.parsed.resolution) - rank(a.parsed.resolution) || b.release.score - a.release.score)[0];
}

/**
 * Read-only — never grabs anything. Three independent kinds of upgrade are
 * detected per movie, tried in this priority order (first match wins):
 *
 * - Language upgrade: the owned file's language (whatever normalizeLanguage
 *   in naming/parser.ts reports — VF, VFQ, MULTI · VF, VOSTFR, VOST, VO)
 *   differs from the user's configured `preferredLanguageUpgrade` (Settings
 *   → Qualité), and a release in that target language exists at the same or
 *   better resolution. Deliberately symmetric and fully user-driven — no
 *   direction is hardcoded, so a household can just as easily set VFQ as the
 *   target (upgrading VF/VOSTFR/etc. TO Quebec French) as VF (the default).
 *   Independent of custom formats entirely — a language preference, not a
 *   quality-score comparison. Falls back to a live direct search when the
 *   RSS cache (only the ~100-150 most recent releases site-wide) has
 *   nothing — bounded to just the subset of the library not already in the
 *   target language, so this stays a handful of extra searches rather than
 *   one per monitored movie.
 * - Custom-format upgrade: a release scores higher than the owned file
 *   against the user's own configured favorite/forbidden terms. Cache-only.
 * - Codec upgrade: a release at the same or better resolution scores higher
 *   on the user's own configured `codecScores` (Settings → Qualité, e.g.
 *   x265/AV1 over x264) than the file currently owned. Neither
 *   checkQualityUpgrades() (resolution only) nor the custom-format check
 *   above (regex terms, not codec) ever catch this — a library already at
 *   its resolution cutoff with only the default French-audio custom format
 *   configured would otherwise never surface anything to replace, even with
 *   codec preferences explicitly set. Cache-only, same as custom-format.
 */
/** Language group mappings for languageSatisfies. */
const LANGUAGE_GROUPS: Record<string, Set<string>> = {
  VF: new Set(["VF", "VFQ", "VFF", "TRUEFRENCH", "FRENCH", "FR", "VF2", "VFI"]),
  ITA: new Set(["ITA", "ITALIAN"]),
  GER: new Set(["GER", "GERMAN", "DEUTSCH"]),
  NL: new Set(["NL", "DUTCH", "NEDERLANDS"]),
  EN: new Set(["EN", "ENGLISH"]),
  ES: new Set(["ES", "SPANISH", "ESPANOL"]),
};

function getLanguageGroup(tag: string): string | null {
  const up = tag.toUpperCase();
  for (const [group, tags] of Object.entries(LANGUAGE_GROUPS)) {
    if (tags.has(up)) return group;
  }
  if (up in LANGUAGE_GROUPS) return up;
  return null;
}

function normLang(s: string): string {
  return s.toUpperCase().replace(/[\s·]+/g, "");
}

/**
 * Above this many episodes needing a live direct-search fallback in one
 * findEpisodeUpgradeCandidates() run, the rest are simply left for the next
 * daily run instead of being searched right now. A TV library can have
 * thousands of episodes not yet in the target language — searching every one
 * of them sequentially (each its own indexer round-trip) in a single pass,
 * whether that pass is the scheduled task or someone opening the "Rechercher
 * et remplacer" panel, is exactly the kind of sustained request burst that
 * trips an indexer's own rate limit. Bounding it here means today's run only
 * ever adds a bounded amount of load, and the ones skipped this time get
 * picked up automatically by tomorrow's scheduled run (or the next time the
 * panel is opened) instead of never being searched at all.
 */
export const MAX_LIVE_LANGUAGE_SEARCHES_PER_RUN = 25;

/** True when `current` already satisfies `target` (e.g. VF satisfies MULTI·VF, ITA satisfies MULTI·ITA). */
export function languageSatisfies(target: string, current: string | null | undefined): boolean {
  if (!current) return false;
  if (target === current) return true;
  const up = normLang(current);
  const tUp = normLang(target);
  // MULTI · X handling: if either is MULTI-prefixed, check if the other belongs to the same language group
  if (tUp.startsWith("MULTI")) {
    const suffix = tUp.replace("MULTI", "");
    const group = getLanguageGroup(suffix);
    if (group) {
      const cGroup = getLanguageGroup(up);
      if (cGroup === group) return true;
      const groupTags = LANGUAGE_GROUPS[group];
      if (groupTags && groupTags.has(up)) return true;
    }
  }
  if (up.startsWith("MULTI")) {
    const suffix = up.replace("MULTI", "");
    const group = getLanguageGroup(suffix);
    if (group) {
      const tGroup = getLanguageGroup(tUp);
      if (tGroup === group) return true;
      const groupTags = LANGUAGE_GROUPS[group];
      if (groupTags && groupTags.has(tUp)) return true;
    }
  }
  return false;
}

/** True when the parsed release's video codec matches the user's target preference. */
function videoCodecSatisfies(target: string, parsed: ReturnType<typeof parseRelease>): boolean {
  const codec = normalizeCodec(parsed.videoCodec);
  return normalizeCodec(target) === codec;
}

/** True when the parsed release's audio codec matches the user's target preference. */
function audioCodecSatisfies(target: string, parsed: ReturnType<typeof parseRelease>): boolean {
  return (parsed.audioCodec ?? "").toLowerCase() === target.toLowerCase();
}

export async function findUpgradeCandidates(): Promise<UpgradeCandidate[]> {
  const rules = loadReleaseRules();
  const targetLanguage = rules.preferredLanguageUpgrade;
  const candidates: UpgradeCandidate[] = [];
  const cachedReleases = searchFromCache(MOVIE_CATEGORY_IDS);
  let liveSearchesUsed = 0;
  const index = getMediaIndex();

  for (const m of index.movies) {
    await yieldToEventLoop();
    if (!m.monitored) continue;
    if (m.movieId && isUpgradeIgnored(m.movieId)) continue;
    const profile = DEFAULT_QUALITY_PROFILES.find((p) => p.id === m.qualityProfileId) ?? DEFAULT_QUALITY_PROFILES[0];

    // Fast pre-check: skip only if movie satisfies ALL configurable criteria
    // AND there are no codec score / format upgrades to check (signal is
    // irrelevant for these — they ALWAYS need safeMatches computation).
    const wantsLanguageUpgrade = !!targetLanguage && !languageSatisfies(targetLanguage, m.language);
    const wantsAudioUpgrade = !!rules.preferredAudioCodec && (m.audioCodec ?? "").toLowerCase() !== rules.preferredAudioCodec.toLowerCase();
    const wantsVideoUpgrade = !!rules.preferredVideoCodec && normalizeCodec(m.videoCodec) !== normalizeCodec(rules.preferredVideoCodec);
    // Movies always need safeMatches for format/codec score upgrades — only
    // episodes can skip entirely (see searchAndReplaceSeries.ts).
    const wantsResolutionUpgrade = !!rules.preferredResolution && rank(m.resolution) < rank(rules.preferredResolution);
    if (!wantsLanguageUpgrade && !wantsAudioUpgrade && !wantsVideoUpgrade && !wantsResolutionUpgrade) {
      // Even if no configurable upgrade is wanted, codec scores (x264→x265)
      // and custom formats may still produce candidates — never skip movies.
    }

    const safeMatches = computeSafeMatches(cachedReleases, { title: m.title, year: m.year }, m.resolution, rules, profile);

    let languageUpgrade = wantsLanguageUpgrade ? bestLanguageMatch(safeMatches, targetLanguage!) : undefined;

    if (wantsLanguageUpgrade && !languageUpgrade && liveSearchesUsed < MAX_LIVE_LANGUAGE_SEARCHES_PER_RUN) {
      const configuredIndexers = loadIndexers().filter((i) => i.enabled && i.protocol === "torrent");
      const indexers = withoutRateLimited(configuredIndexers);
      if (indexers.length > 0) {
        liveSearchesUsed++;
        recordSearchLog("info", "search_and_replace.language_fallback_direct", `${m.title} — ${m.language ?? "?"} détecté, cache sans ${targetLanguage}, recherche directe sur ${indexers.length} indexeur(s)`);
        const directReleases: IndexerRelease[] = [];
        // Full movie object needed for imdbId/tmdbId — rare path, OK to fetch.
        const fullMovie = loadMovies().find((x) => x.id === m.movieId);
        for (const ix of indexers) {
          const results = await searchMovie(ix, { title: m.title, year: m.year, imdbId: fullMovie?.imdbId, tmdbId: fullMovie?.tmdbId }, MOVIE_CATEGORY_IDS).catch(() => [] as IndexerRelease[]);
          directReleases.push(...results);
        }
        const directMatches = computeSafeMatches(directReleases, { title: m.title, year: m.year }, m.resolution, rules, profile);
        languageUpgrade = bestLanguageMatch(directMatches, targetLanguage!);
      }
    }

    // Audio codec upgrade
    const wantsAudioCodecUpgrade = !!rules.preferredAudioCodec && !audioCodecSatisfies(rules.preferredAudioCodec, { audioCodec: m.audioCodec } as ReturnType<typeof parseRelease>);
    const audioCodecUpgrade = wantsAudioCodecUpgrade && !languageUpgrade
      ? safeMatches.find(({ parsed }) => audioCodecSatisfies(rules.preferredAudioCodec!, parsed))
      : undefined;

    // Video codec upgrade
    const wantsVideoCodecUpgrade = !!rules.preferredVideoCodec && normalizeCodec(m.videoCodec) !== normalizeCodec(rules.preferredVideoCodec);
    const videoCodecUpgrade = wantsVideoCodecUpgrade && !languageUpgrade && !audioCodecUpgrade
      ? safeMatches.find(({ parsed }) => videoCodecSatisfies(rules.preferredVideoCodec!, parsed))
      : undefined;

    // Resolution upgrade
    const resolutionUpgrade = wantsResolutionUpgrade && !languageUpgrade && !audioCodecUpgrade && !videoCodecUpgrade
      ? safeMatches.find(({ parsed }) => rank(parsed.resolution) >= rank(rules.preferredResolution!))
      : undefined;

    const formatUpgrade = safeMatches
      .filter(({ release }) => applyCustomFormats(release.title) > m.formatScore)
      .sort((a, b) => applyCustomFormats(b.release.title) - applyCustomFormats(a.release.title) || b.release.score - a.release.score)[0];

    const currentCodecScore = codecScore(m.videoCodec, rules);
    const codecUpgrade = !formatUpgrade
      ? safeMatches
          .filter(({ parsed }) => codecScore(parsed.videoCodec, rules) > currentCodecScore)
          .sort((a, b) => codecScore(b.parsed.videoCodec, rules) - codecScore(a.parsed.videoCodec, rules) || b.release.score - a.release.score)[0]
      : undefined;

    const best = languageUpgrade ?? audioCodecUpgrade ?? videoCodecUpgrade ?? resolutionUpgrade ?? formatUpgrade ?? codecUpgrade; if (best && !isMeaningfulUpgrade(best as never, { file: { size: m.size, resolution: m.resolution, videoCodec: m.videoCodec } } as never, !!languageUpgrade)) continue;
    if (!best) continue;

    // Determine which upgrade type won
    let reasonKey: UpgradeCandidate["reasonKey"];
    let reasonParams: Record<string, string> | undefined;
    if (best === languageUpgrade && languageUpgrade) {
      reasonKey = "languageUpgrade";
      reasonParams = { from: m.language ?? "?", to: targetLanguage! };
    } else if (best === audioCodecUpgrade && audioCodecUpgrade) {
      reasonKey = "audioCodecUpgrade";
      reasonParams = { from: m.audioCodec ?? "?", to: rules.preferredAudioCodec! };
    } else if (best === videoCodecUpgrade && videoCodecUpgrade) {
      reasonKey = "videoCodecUpgrade";
      reasonParams = { from: m.videoCodec ?? "?", to: rules.preferredVideoCodec! };
    } else if (best === resolutionUpgrade && resolutionUpgrade) {
      reasonKey = "resolutionUpgrade";
      reasonParams = { from: m.resolution ?? "?", to: rules.preferredResolution! };
    } else if (best === formatUpgrade && formatUpgrade) {
      reasonKey = "customFormatUpgrade";
      reasonParams = { delta: String(applyCustomFormats(best.release.title) - m.formatScore) };
    } else if (best) {
      reasonKey = "codecUpgrade";
      reasonParams = { from: m.videoCodec ?? "?", to: best.parsed.videoCodec ?? "?" };
    } else {
      continue;
    }

    candidates.push({
      movieId: m.movieId!,
      title: m.title,
      currentVersion: versionLabel(m.resolution, m.videoCodec, m.audioCodec),
      currentFormatScore: m.formatScore,
      currentSize: m.size,
      detectedVersion: versionLabel(best.parsed.resolution, best.parsed.videoCodec, best.parsed.audioCodec),
      detectedFormatScore: applyCustomFormats(best.release.title),
      size: best.release.size,
      reasonKey,
      reasonParams,
    });
  }

  return candidates;
}

export type GrabUpgradeResult = { ok: true; infoHash: string } | { ok: false; error: "movie_not_found" | "no_candidate" | "engine_unreachable" };

/**
 * Re-evaluates and grabs the current best candidate for one movie — never
 * auto-triggered, always an explicit user click. Mirrors all three upgrade
 * paths from findUpgradeCandidates() (language, then custom-format, then
 * codec) in the same priority order, so clicking "Remplacer" on any
 * candidate the list just showed re-finds the same release instead of
 * silently failing with "no_candidate" because only a subset of paths were
 * re-checked here.
 */
export async function grabUpgradeCandidate(movieId: string): Promise<GrabUpgradeResult> {
  const movie = loadMovies().find((m) => m.id === movieId);
  if (!movie || !movie.file) return { ok: false, error: "movie_not_found" }; if (isUpgradeIgnored(movieId)) return { ok: false, error: "no_candidate" };

  const rules = loadReleaseRules();
  const targetLanguage = rules.preferredLanguageUpgrade;
  const profile = DEFAULT_QUALITY_PROFILES.find((p) => p.id === movie.qualityProfileId) ?? DEFAULT_QUALITY_PROFILES[0];
  const currentBasename = path.basename(movie.file.path);
  const currentFormatScore = applyCustomFormats(currentBasename);
  const currentLanguage = movie.file.language ?? parseRelease(currentBasename).language;
  const wantsLanguageUpgrade = !!targetLanguage && !languageSatisfies(targetLanguage, currentLanguage);

  let safeMatches = computeSafeMatches(searchFromCache(MOVIE_CATEGORY_IDS), movie, movie.file.resolution, rules, profile)
    .filter(({ release }) => withinSizeLimit(release.size, "movie"));

  let languageUpgrade = wantsLanguageUpgrade ? bestLanguageMatch(safeMatches, targetLanguage!) : undefined;

  if (wantsLanguageUpgrade && !languageUpgrade) {
    const configuredIndexers = loadIndexers().filter((i) => i.enabled && i.protocol === "torrent");
    const indexers = withoutRateLimited(configuredIndexers);
    if (indexers.length > 0) {
      const directReleases: IndexerRelease[] = [];
      for (const ix of indexers) {
        const results = await searchMovie(ix, { title: movie.title, year: movie.year, imdbId: movie.imdbId, tmdbId: movie.tmdbId }, MOVIE_CATEGORY_IDS).catch(() => [] as IndexerRelease[]);
        directReleases.push(...results);
      }
      const directMatches = computeSafeMatches(directReleases, movie, movie.file.resolution, rules, profile)
        .filter(({ release }) => withinSizeLimit(release.size, "movie"));
      languageUpgrade = bestLanguageMatch(directMatches, targetLanguage!);
      if (languageUpgrade) safeMatches = directMatches;
    }
  }

  let formatUpgrade = safeMatches
    .filter(({ release }) => applyCustomFormats(release.title) > currentFormatScore)
    .sort((a, b) => applyCustomFormats(b.release.title) - applyCustomFormats(a.release.title) || b.release.score - a.release.score)[0];

  const currentCodecScore = codecScore(movie.file.videoCodec, rules);
  let codecUpgrade: (typeof safeMatches)[0] | undefined;
  if (!formatUpgrade) {
    codecUpgrade = safeMatches
        .filter(({ parsed }) => codecScore(parsed.videoCodec, rules) > currentCodecScore)
        .sort((a, b) => codecScore(b.parsed.videoCodec, rules) - codecScore(a.parsed.videoCodec, rules) || b.release.score - a.release.score)[0];
  }

  // Fallback to direct indexer search when RSS cache (only ~150 most recent
  // releases) misses older catalog titles — same pattern as language fallback.
  if (!languageUpgrade && !formatUpgrade && !codecUpgrade) {
    const configuredIndexers = loadIndexers().filter((i) => i.enabled && i.protocol === "torrent");
    const indexers = withoutRateLimited(configuredIndexers);
    if (indexers.length > 0) {
      const directReleases: IndexerRelease[] = [];
      for (const ix of indexers) {
        const results = await searchMovie(ix, { title: movie.title, year: movie.year, imdbId: movie.imdbId, tmdbId: movie.tmdbId }, MOVIE_CATEGORY_IDS).catch(() => [] as IndexerRelease[]);
        directReleases.push(...results);
      }
      const directMatches = computeSafeMatches(directReleases, movie, movie.file.resolution, rules, profile)
          .filter(({ release }) => withinSizeLimit(release.size, "movie"));
      if (wantsLanguageUpgrade) languageUpgrade = bestLanguageMatch(directMatches, targetLanguage!) ?? languageUpgrade;
      if (!formatUpgrade) {
        formatUpgrade = directMatches
          .filter(({ release }) => applyCustomFormats(release.title) > currentFormatScore)
          .sort((a, b) => applyCustomFormats(b.release.title) - applyCustomFormats(a.release.title) || b.release.score - a.release.score)[0];
        if (!formatUpgrade) {
          codecUpgrade = directMatches
              .filter(({ parsed }) => codecScore(parsed.videoCodec, rules) > currentCodecScore)
              .sort((a, b) => codecScore(b.parsed.videoCodec, rules) - codecScore(a.parsed.videoCodec, rules) || b.release.score - a.release.score)[0];
        }
      }
    }
  }

  const bestMatch = languageUpgrade ?? formatUpgrade ?? codecUpgrade; if (!bestMatch?.release) return { ok: false, error: 'no_candidate' }; if (!isMeaningfulUpgrade(bestMatch, movie, !!languageUpgrade)) return { ok: false, error: 'no_candidate' }; const best = bestMatch.release;
  if (!best) return { ok: false, error: "no_candidate" };

  const payload = await buildGrabPayload({ magnetUrl: best.magnetUrl, downloadUrl: best.downloadUrl, indexerId: best.indexerId });
  if ("error" in payload) return { ok: false, error: "engine_unreachable" };

  try {
    const res = await fetch(`${ENGINE_BASE}/torrents`, {
      method: "POST",
      headers: engineHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({
        ...payload,
        category: "movie",
        libraryRef: encodeLibraryRef({ kind: "movie", movieId: movie.id }),
        title: movie.title,
        year: movie.year,
      }),
      signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS),
    });
    const torrent = await res.json();
    if (!res.ok) return { ok: false, error: "engine_unreachable" };
    updateMovie(movie.id, { status: "downloading", activeInfoHash: torrent.infoHash });
    emitNotification("grab_movie_upgrade", `${movie.title} — remplacement lancé`, "/library", { title: movie.title });
    return { ok: true, infoHash: torrent.infoHash };
  } catch {
    return { ok: false, error: "engine_unreachable" };
  }
}





