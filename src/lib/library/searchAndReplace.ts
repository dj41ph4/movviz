import path from "node:path";
import { loadMovies, updateMovie } from "@/lib/library/store";
import { DEFAULT_QUALITY_PROFILES } from "@/lib/library/qualityProfiles";
import { encodeLibraryRef } from "@/lib/library/types";
import { searchFromCache } from "@/lib/indexers/rssCache";
import { MOVIE_CATEGORY_IDS } from "@/lib/indexers/categories";
import { parseRelease } from "@/lib/naming/parser";
import { releaseTitleMatches, yearIsCompatible } from "@/lib/library/matching";
import { withinSizeLimit, loadReleaseRules } from "@/lib/library/releaseRules";
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
 * SUGGESTS — never grabs on its own — when a release matches the user's own
 * favorite/forbidden terms (custom formats, already fully user-configurable)
 * better than the file currently owned, even at the same resolution. Never
 * imposes a language: it only ever compares against rules the user
 * themselves already configured.
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
  reasonKey: "languageUpgrade" | "customFormatUpgrade";
  reasonParams?: Record<string, string>;
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
    .filter(({ parsed }) => parsed.language === targetLanguage)
    .sort((a, b) => rank(b.parsed.resolution) - rank(a.parsed.resolution) || b.release.score - a.release.score)[0];
}

/**
 * Read-only — never grabs anything. Two independent kinds of upgrade are
 * detected per movie, and the language one takes priority when both apply:
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
 * - Custom-format upgrade (unchanged): a release scores higher than the
 *   owned file against the user's own configured favorite/forbidden terms.
 *   Cache-only, same as before — not the gap the user reported.
 */
export async function findUpgradeCandidates(): Promise<UpgradeCandidate[]> {
  const rules = loadReleaseRules();
  const targetLanguage = rules.preferredLanguageUpgrade;
  const candidates: UpgradeCandidate[] = [];
  const cachedReleases = searchFromCache(MOVIE_CATEGORY_IDS);

  for (const movie of loadMovies()) {
    if (movie.status !== "available" || !movie.file || !movie.monitored) continue;
    const profile = DEFAULT_QUALITY_PROFILES.find((p) => p.id === movie.qualityProfileId) ?? DEFAULT_QUALITY_PROFILES[0];

    const currentBasename = path.basename(movie.file.path);
    const currentFormatScore = applyCustomFormats(currentBasename);
    const currentLanguage = parseRelease(currentBasename).language;
    const wantsLanguageUpgrade = !!targetLanguage && currentLanguage !== targetLanguage;

    const safeMatches = computeSafeMatches(cachedReleases, movie, movie.file.resolution, rules, profile);

    let languageUpgrade = wantsLanguageUpgrade ? bestLanguageMatch(safeMatches, targetLanguage!) : undefined;

    if (wantsLanguageUpgrade && !languageUpgrade) {
      const configuredIndexers = loadIndexers().filter((i) => i.enabled && i.protocol === "torrent");
      const indexers = withoutRateLimited(configuredIndexers);
      if (indexers.length > 0) {
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

    const best = languageUpgrade ?? formatUpgrade;
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
        : { reasonKey: "customFormatUpgrade" as const, reasonParams: { delta: String(applyCustomFormats(best.release.title) - currentFormatScore) } }),
    });
  }

  return candidates;
}

export type GrabUpgradeResult = { ok: true } | { ok: false; error: "movie_not_found" | "no_candidate" | "engine_unreachable" };

/**
 * Re-evaluates and grabs the current best candidate for one movie — never
 * auto-triggered, always an explicit user click. Mirrors BOTH upgrade paths
 * from findUpgradeCandidates() (language then custom-format) — the earlier
 * version here only ever re-checked the custom-format path, so clicking
 * "Remplacer" on a language-upgrade candidate (a VF release almost never
 * also scores higher on the user's own custom formats) would silently fail
 * with "no_candidate" even though the list just showed it as available.
 */
export async function grabUpgradeCandidate(movieId: string): Promise<GrabUpgradeResult> {
  const movie = loadMovies().find((m) => m.id === movieId);
  if (!movie || !movie.file) return { ok: false, error: "movie_not_found" };

  const rules = loadReleaseRules();
  const targetLanguage = rules.preferredLanguageUpgrade;
  const profile = DEFAULT_QUALITY_PROFILES.find((p) => p.id === movie.qualityProfileId) ?? DEFAULT_QUALITY_PROFILES[0];
  const currentFormatScore = applyCustomFormats(path.basename(movie.file.path));
  const currentLanguage = parseRelease(path.basename(movie.file.path)).language;
  const wantsLanguageUpgrade = !!targetLanguage && currentLanguage !== targetLanguage;

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

  const best = (languageUpgrade ?? formatUpgrade)?.release;
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
