import { getSeries, loadSeries, updateSeries } from "@/lib/library/store";
import { DEFAULT_QUALITY_PROFILES } from "@/lib/library/qualityProfiles";
import { encodeLibraryRef, type LibrarySeries } from "@/lib/library/types";
import { searchFromCache } from "@/lib/indexers/rssCache";
import { TV_CATEGORY_IDS } from "@/lib/indexers/categories";
import { parseRelease } from "@/lib/naming/parser";
import { releaseTitleMatches, seasonEpisodeMatches } from "@/lib/library/matching";
import { withinSizeLimit, loadReleaseRules } from "@/lib/library/releaseRules";
import { isBlockedForAutoGrab } from "@/lib/library/decisionGuard";
import { searchTv } from "@/lib/indexers/torznab";
import { isRecentlyFailedRelease } from "@/lib/library/failedReleases";
import { buildGrabPayload } from "@/lib/indexers/grabPayload";
import { ENGINE_BASE, engineHeaders, ENGINE_TIMEOUT_MS } from "@/lib/engine/server";
import { emitNotification } from "@/lib/notifications/store";
import { loadIndexers } from "@/lib/indexers/store";
import { withoutRateLimited } from "@/lib/indexers/rateLimit";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import { languageSatisfies, MAX_LIVE_LANGUAGE_SEARCHES_PER_RUN, yieldToEventLoop } from "@/lib/library/searchAndReplace";
import type { IndexerRelease } from "@/lib/indexers/types";

/**
 * Episode-level counterpart to searchAndReplace.ts's language-upgrade path —
 * same `preferredLanguageUpgrade` setting, same languageSatisfies() rule, but
 * walking every monitored/available episode across every series instead of
 * every movie. Read-only — never grabs anything on its own, same as the
 * movie side. Custom-format upgrades aren't offered here: those compare a
 * whole release's score against the file's own basename score, which is a
 * much noisier signal per-episode than per-movie (episode releases carry far
 * less distinguishing text) — language is the one dimension that's both
 * clearly defined and exactly what episodes get tagged with (see
 * detectLanguage.ts / languageDetectionTask.ts).
 */

const RESOLUTION_ORDER = ["480p", "720p", "1080p", "2160p"];
const rank = (res: string | null) => (res ? RESOLUTION_ORDER.indexOf(res) : -1);

export interface EpisodeUpgradeCandidate {
  seriesId: string;
  seriesTitle: string;
  seasonNumber: number;
  episodeNumber: number;
  currentVersion: string;
  currentSize: number;
  detectedVersion: string;
  size: number;
  reasonKey: "languageUpgrade";
  reasonParams: { from: string; to: string };
}

function versionLabel(resolution: string | null, videoCodec: string | null, audioCodec: string | null): string {
  return [resolution, videoCodec, audioCodec].filter(Boolean).join(" · ") || "?";
}

function computeSafeEpisodeMatches(
  releases: IndexerRelease[],
  series: { title: string },
  seasonNumber: number,
  episodeNumber: number,
  currentResolution: string | null,
  rules: ReturnType<typeof loadReleaseRules>,
  profile: { allowedResolutions: string[] }
) {
  return releases
    .map((r) => ({ release: r, parsed: parseRelease(r.title) }))
    .filter(({ parsed }) => releaseTitleMatches(parsed.title, series.title))
    .filter(({ parsed }) => seasonEpisodeMatches(parsed, seasonNumber, episodeNumber))
    .filter(({ release }) => !isBlockedForAutoGrab(release.title, rules, series.title).blocked)
    .filter(({ parsed }) => parsed.resolution && profile.allowedResolutions.includes(parsed.resolution))
    // Equal or better resolution only — a "replace" is never a downgrade in quality.
    .filter(({ parsed }) => rank(parsed.resolution) >= rank(currentResolution))
    .filter(({ release }) => withinSizeLimit(release.size, "episode"))
    .filter(({ release }) => !isRecentlyFailedRelease(release.infoHash));
}

function bestEpisodeLanguageMatch(matches: ReturnType<typeof computeSafeEpisodeMatches>, targetLanguage: string) {
  return matches
    .filter(({ parsed }) => parsed.language && languageSatisfies(targetLanguage, parsed.language))
    .sort((a, b) => rank(b.parsed.resolution) - rank(a.parsed.resolution) || b.release.score - a.release.score)[0];
}

/** Every monitored, available episode across every series — flattened once, reused by both find and grab. */
function eligibleEpisodes(seriesList: LibrarySeries[]) {
  const out: { series: LibrarySeries; seasonNumber: number; episodeNumber: number; file: NonNullable<LibrarySeries["seasons"][number]["episodes"][number]["file"]> }[] = [];
  for (const series of seriesList) {
    for (const season of series.seasons) {
      for (const ep of season.episodes) {
        if (ep.status !== "available" || !ep.monitored || !ep.file) continue;
        out.push({ series, seasonNumber: season.seasonNumber, episodeNumber: ep.episodeNumber, file: ep.file });
      }
    }
  }
  return out;
}

export async function findEpisodeUpgradeCandidates(): Promise<EpisodeUpgradeCandidate[]> {
  const rules = loadReleaseRules();
  const targetLanguage = rules.preferredLanguageUpgrade;
  if (!targetLanguage) return [];

  const candidates: EpisodeUpgradeCandidate[] = [];
  const cachedReleases = searchFromCache(TV_CATEGORY_IDS);
  let liveSearchesUsed = 0;

  for (const { series, seasonNumber, episodeNumber, file } of eligibleEpisodes(loadSeries())) {
    // See yieldToEventLoop()'s doc in searchAndReplace.ts — with thousands of
    // episodes in a real library, this loop's per-episode CPU work (regex
    // title/season/episode matching against every cached release) would
    // otherwise starve every other request on the server for the entire scan.
    await yieldToEventLoop();
    const profile = DEFAULT_QUALITY_PROFILES.find((p) => p.id === series.qualityProfileId) ?? DEFAULT_QUALITY_PROFILES[0];
    const currentBasename = file.path.replace(/^.*[/\\]/, "");
    const currentLanguage = file.language ?? parseRelease(currentBasename).language;
    if (languageSatisfies(targetLanguage, currentLanguage)) continue;

    const safeMatches = computeSafeEpisodeMatches(cachedReleases, series, seasonNumber, episodeNumber, file.resolution, rules, profile);
    let best = bestEpisodeLanguageMatch(safeMatches, targetLanguage);

    if (!best && liveSearchesUsed < MAX_LIVE_LANGUAGE_SEARCHES_PER_RUN) {
      const configuredIndexers = loadIndexers().filter((i) => i.enabled && i.protocol === "torrent");
      const indexers = withoutRateLimited(configuredIndexers);
      if (indexers.length > 0) {
        liveSearchesUsed++;
        const label = `${series.title} S${String(seasonNumber).padStart(2, "0")}E${String(episodeNumber).padStart(2, "0")}`;
        recordSearchLog("info", "search_and_replace_series.language_fallback_direct", `${label} — ${currentLanguage ?? "?"} détecté, cache sans ${targetLanguage}, recherche directe sur ${indexers.length} indexeur(s)`);
        const directReleases: IndexerRelease[] = [];
        // Sequential, one indexer at a time — same pacing discipline as
        // autoGrabSeries.ts, so this never fires a burst of parallel
        // requests at a single indexer.
        for (const ix of indexers) {
          const results = await searchTv(ix, { title: series.title, season: seasonNumber, episode: episodeNumber }, TV_CATEGORY_IDS).catch(() => [] as IndexerRelease[]);
          directReleases.push(...results);
        }
        const directMatches = computeSafeEpisodeMatches(directReleases, series, seasonNumber, episodeNumber, file.resolution, rules, profile);
        best = bestEpisodeLanguageMatch(directMatches, targetLanguage);
      }
    }

    if (!best) continue;

    candidates.push({
      seriesId: series.id,
      seriesTitle: series.title,
      seasonNumber,
      episodeNumber,
      currentVersion: versionLabel(file.resolution, file.videoCodec, file.audioCodec),
      currentSize: file.size,
      detectedVersion: versionLabel(best.parsed.resolution, best.parsed.videoCodec, best.parsed.audioCodec),
      size: best.release.size,
      reasonKey: "languageUpgrade",
      reasonParams: { from: currentLanguage ?? "?", to: targetLanguage },
    });
  }

  return candidates;
}

export type GrabEpisodeUpgradeResult = { ok: true } | { ok: false; error: "not_found" | "no_candidate" | "engine_unreachable" };

/** Re-evaluates and grabs the current best language-upgrade candidate for one episode — never auto-triggered, always an explicit user click. */
export async function grabEpisodeUpgradeCandidate(seriesId: string, seasonNumber: number, episodeNumber: number): Promise<GrabEpisodeUpgradeResult> {
  const series = getSeries(seriesId);
  const season = series?.seasons.find((s) => s.seasonNumber === seasonNumber);
  const episode = season?.episodes.find((e) => e.episodeNumber === episodeNumber);
  if (!series || !episode?.file) return { ok: false, error: "not_found" };

  const rules = loadReleaseRules();
  const targetLanguage = rules.preferredLanguageUpgrade;
  if (!targetLanguage) return { ok: false, error: "no_candidate" };
  const profile = DEFAULT_QUALITY_PROFILES.find((p) => p.id === series.qualityProfileId) ?? DEFAULT_QUALITY_PROFILES[0];

  let matches = computeSafeEpisodeMatches(searchFromCache(TV_CATEGORY_IDS), series, seasonNumber, episodeNumber, episode.file.resolution, rules, profile);
  let best = bestEpisodeLanguageMatch(matches, targetLanguage);

  if (!best) {
    const configuredIndexers = loadIndexers().filter((i) => i.enabled && i.protocol === "torrent");
    const indexers = withoutRateLimited(configuredIndexers);
    if (indexers.length > 0) {
      const directReleases: IndexerRelease[] = [];
      for (const ix of indexers) {
        const results = await searchTv(ix, { title: series.title, season: seasonNumber, episode: episodeNumber }, TV_CATEGORY_IDS).catch(() => [] as IndexerRelease[]);
        directReleases.push(...results);
      }
      matches = computeSafeEpisodeMatches(directReleases, series, seasonNumber, episodeNumber, episode.file.resolution, rules, profile);
      best = bestEpisodeLanguageMatch(matches, targetLanguage);
    }
  }

  if (!best) return { ok: false, error: "no_candidate" };

  const payload = await buildGrabPayload({ magnetUrl: best.release.magnetUrl, downloadUrl: best.release.downloadUrl, indexerId: best.release.indexerId });
  if ("error" in payload) return { ok: false, error: "engine_unreachable" };

  try {
    const res = await fetch(`${ENGINE_BASE}/torrents`, {
      method: "POST",
      headers: engineHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({
        ...payload,
        category: "series",
        libraryRef: encodeLibraryRef({ kind: "episode", seriesId, season: seasonNumber, episode: episodeNumber }),
        title: series.title,
        episodeTarget: { season: seasonNumber, episode: episodeNumber },
      }),
      signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS),
    });
    const torrent = await res.json();
    if (!res.ok) return { ok: false, error: "engine_unreachable" };

    const newSeasons = series.seasons.map((s) =>
      s.seasonNumber !== seasonNumber
        ? s
        : { ...s, episodes: s.episodes.map((e) => (e.episodeNumber === episodeNumber ? { ...e, status: "downloading" as const, activeInfoHash: torrent.infoHash } : e)) }
    );
    updateSeries(series.id, { seasons: newSeasons });

    emitNotification(
      "grab_episode",
      `${series.title} — ${seasonNumber}x${String(episodeNumber).padStart(2, "0")} — remplacement lancé (langue)`,
      `/title/series/${series.tmdbId}`,
      { title: series.title, code: `${seasonNumber}x${String(episodeNumber).padStart(2, "0")}` }
    );
    return { ok: true };
  } catch {
    return { ok: false, error: "engine_unreachable" };
  }
}
