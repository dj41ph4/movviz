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
  reasonKey: "languageUpgrade" | "customFormatUpgrade" | "codecUpgrade";
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
/** Normalised French audio tags (space/dot stripped) for `languageSatisfies`. */
const FRENCH_TAGS_NORM = new Set(["VF", "VFQ", "VFF", "TRUEFRENCH", "FRENCH", "FR", "VF2", "VFI", "MULTIVF"]);

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

/** True when `current` already satisfies `target` (e.g. VF satisfies MULTI·VF). */
export function languageSatisfies(target: string, current: string | null | undefined): boolean {
  if (!current) return false;
  if (target === current) return true;
  const up = normLang(current);
  const tUp = normLang(target);
  if (tUp === "MULTIVF" && FRENCH_TAGS_NORM.has(up)) return true;
  if (up === "MULTIVF" && FRENCH_TAGS_NORM.has(tUp)) return true;
  return false;
}

export async function findUpgradeCandidates(): Promise<UpgradeCandidate[]> {
  const rules = loadReleaseRules();
  const targetLanguage = rules.preferredLanguageUpgrade;
  const candidates: UpgradeCandidate[] = [];
  const cachedReleases = searchFromCache(MOVIE_CATEGORY_IDS);
  let liveSearchesUsed = 0;

  for (const movie of loadMovies()) {
    await yieldToEventLoop();
    if (movie.status !== "available" || !movie.file || !movie.monitored) continue;
    const profile = DEFAULT_QUALITY_PROFILES.find((p) => p.id === movie.qualityProfileId) ?? DEFAULT_QUALITY_PROFILES[0];

    const currentBasename = path.basename(movie.file.path);
    const currentFormatScore = applyCustomFormats(currentBasename);
    const currentLanguage = movie.file.language ?? parseRelease(currentBasename).language;
    const wantsLanguageUpgrade = !!targetLanguage && !languageSatisfies(targetLanguage, currentLanguage);

    const safeMatches = computeSafeMatches(cachedReleases, movie, movie.file.resolution, rules, profile);

    let languageUpgrade = wantsLanguageUpgrade ? bestLanguageMatch(safeMatches, targetLanguage!) : undefined;

    if (wantsLanguageUpgrade && !languageUpgrade && liveSearchesUsed < MAX_LIVE_LANGUAGE_SEARCHES_PER_RUN) {
      const configuredIndexers = loadIndexers().filter((i) => i.enabled && i.protocol === "torrent");
      const indexers = withoutRateLimited(configuredIndexers);
      if (indexers.length > 0) {
        liveSearchesUsed++;
        recordSearchLog("info", "search_and_replace.language_fallback_direct", `${movie.title} — ${currentLanguage ?? "?"} détecté, cache sans ${targetLanguage}, recherche directe sur ${indexers.length} indexeur(s)`);
        const directReleases: IndexerRelease[] = [];
        for (const ix of indexers) {
          const results = await searchMovie(ix, { title: movie.title, year: movie.year, imdbId: movie.imdbId, tmdbId: movie.tmdbId }, MOVIE_CATEGORY_IDS).catch(() => [] as IndexerRelease[]);
          directReleases.push(...results);
        }
        const directMatches = computeSafeMatches(directReleases, movie, movie.file.resolution, rules, profile);
        languageUpgrade = bestLanguageMatch(directMatches, targetLanguage!);
      }
    }

    const formatUpgrade = safeMatches
      .filter(({ release }) => applyCustomFormats(release.title) > currentFormatScore)
      .sort((a, b) => applyCustomFormats(b.release.title) - applyCustomFormats(a.release.title) || b.release.score - a.release.score)[0];

    // Codec upgrade (LOT — same resolution but a better codec per the user's
    // own codecScores, e.g. x264 -> x265/AV1): lowest priority of the three,
    // since language and custom-format bonuses are stronger, more deliberate
    // signals — but without this, a library with its resolution already
    // maxed out and no custom formats configured beyond the default French
    // audio one (the common case) never surfaces anything at all, even
    // though the user explicitly configured non-zero codec preferences.
    const currentCodecScore = codecScore(movie.file.videoCodec, rules);
    const codecUpgrade = !formatUpgrade
      ? safeMatches
          .filter(({ parsed }) => codecScore(parsed.videoCodec, rules) > currentCodecScore)
          .sort((a, b) => codecScore(b.parsed.videoCodec, rules) - codecScore(a.parsed.videoCodec, rules) || b.release.score - a.release.score)[0]
      : undefined;

    const best = languageUpgrade ?? formatUpgrade ?? codecUpgrade;
    if (!best) continue;

    candidates.push({
      movieId: movie.id,
      title: movie.title,
      currentVersion: versionLabel(movie.file.resolution, movie.file.videoCodec, movie.file.audioCodec),
      currentFormatScore,
      currentSize: movie.file.size,
      detectedVersion: versionLabel(best.parsed.resolution, best.parsed.videoCodec, best.parsed.audioCodec),
      detectedFormatScore: applyCustomFormats(best.release.title),
      size: best.release.size,
      ...(languageUpgrade
        ? { reasonKey: "languageUpgrade" as const, reasonParams: { from: currentLanguage ?? "?", to: targetLanguage! } }
        : formatUpgrade
          ? { reasonKey: "customFormatUpgrade" as const, reasonParams: { delta: String(applyCustomFormats(best.release.title) - currentFormatScore) } }
          : { reasonKey: "codecUpgrade" as const, reasonParams: { from: movie.file.videoCodec ?? "?", to: best.parsed.videoCodec ?? "?" } }),
    });
  }

  return candidates;
}

export type GrabUpgradeResult = { ok: true } | { ok: false; error: "movie_not_found" | "no_candidate" | "engine_unreachable" };

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
  if (!movie || !movie.file) return { ok: false, error: "movie_not_found" };

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

  const formatUpgrade = safeMatches
    .filter(({ release }) => applyCustomFormats(release.title) > currentFormatScore)
    .sort((a, b) => applyCustomFormats(b.release.title) - applyCustomFormats(a.release.title) || b.release.score - a.release.score)[0];

  const currentCodecScore = codecScore(movie.file.videoCodec, rules);
  const codecUpgrade = !formatUpgrade
    ? safeMatches
        .filter(({ parsed }) => codecScore(parsed.videoCodec, rules) > currentCodecScore)
        .sort((a, b) => codecScore(b.parsed.videoCodec, rules) - codecScore(a.parsed.videoCodec, rules) || b.release.score - a.release.score)[0]
    : undefined;

  const best = (languageUpgrade ?? formatUpgrade ?? codecUpgrade)?.release;
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
    emitNotification(
      "grab_movie_upgrade",
      `${movie.title} — remplacement lancé (préférences de recherche)`,
      "/library",
      { title: movie.title }
    );
    return { ok: true };
  } catch {
    return { ok: false, error: "engine_unreachable" };
  }
}
