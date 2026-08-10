import fs from "node:fs";
import path from "node:path";
import { getSeries, getSeriesByTmdbId, addSeries, updateSeries, loadSeries } from "@/lib/library/store";
import { DEFAULT_QUALITY_PROFILES, defaultQualityProfile } from "@/lib/library/qualityProfiles";
import { encodeLibraryRef, type LibrarySeries, type LibrarySeason, type LibraryEpisode } from "@/lib/library/types";
import { searchFromCache } from "@/lib/indexers/rssCache";
import type { IndexerRelease } from "@/lib/indexers/types";
import { TV_CATEGORY_IDS } from "@/lib/indexers/categories";
import { parseRelease } from "@/lib/naming/parser";
import type { ReleaseInfo } from "@/lib/naming/types";
import { releaseTitleMatches, yearIsCompatible, partPackInfo } from "@/lib/library/matching";
import { getReleaseMatchPool } from "@/lib/workers/releaseMatchPool";
import { withinSizeLimit, loadReleaseRules, compareBySizePreference, perceptualSizeBytes, type ReleaseRules } from "@/lib/library/releaseRules";
import { isBlockedForAutoGrab } from "@/lib/library/decisionGuard";
import { recordDecision } from "@/lib/library/decisionLog";
import { buildGrabPayload } from "@/lib/indexers/grabPayload";
import { ENGINE_BASE, engineHeaders, ENGINE_TIMEOUT_MS } from "@/lib/engine/server";
import { getSeries as fetchTmdbSeries, getSeason as fetchTmdbSeason } from "@/lib/metadata/tmdb";
import { emitNotification } from "@/lib/notifications/store";
import { logActivity } from "@/lib/activity/store";
import { logActivityV2, createMediaRef, createFailureRef, createReleaseRef } from "@/lib/activity/v2/store";
import { getTvdbEpisodesFor, getTvdbSeasonNames, groupTvdbEpisodesBySeason, tvdbConfigured, specialsEnabled, type TvdbEpisode } from "@/lib/metadata/tvdb";
import { isRecentlyFailedRelease } from "@/lib/library/failedReleases";
import { episodeStatus } from "@/lib/library/releaseSchedule";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import { notifySeerrProcessingOnce } from "@/lib/seerr/mediaMap";
import { searchTv, searchCompleteSeriesPack, COMPLETE_SERIES_TERMS } from "@/lib/indexers/torznab";
import { loadIndexers } from "@/lib/indexers/store";
import { withoutRateLimited, countNewlyRateLimited } from "@/lib/indexers/rateLimit";
import { withKeyLock } from "@/lib/library/locks";
import { runBackground } from "@/lib/priority/lane";
import { yieldToUser } from "@/lib/priority/userActivity";

/**
 * Anime tends to have more reliable episode numbering/titles on TVDB than
 * TMDb — TMDb often collapses a whole multi-arc run into one or two seasons
 * (e.g. Bleach: 2 on TMDb vs. ~17 arc seasons on TVDB), which is both wrong
 * and useless for tracking what's actually missing. When TVDB genuinely
 * breaks the show into more seasons than TMDb did, its season/episode
 * numbering becomes the library's structure instead of just patching
 * titles/dates onto TMDb's. Only applied on a full-series import (no
 * `seasonNumbers` filter) — TVDB's season numbers don't line up with TMDb's,
 * so a partial import by TMDb season number can't be safely remapped here.
 */
async function buildAnimeSeasonsFromTvdb(
  title: string, year: number | null, tvdbId: number | null, tmdbSeasons: LibrarySeason[]
): Promise<LibrarySeason[]> {
  const tvdbEpisodes = await getTvdbEpisodesFor(tvdbId, title, year);
  if (tvdbEpisodes.length === 0) return tmdbSeasons;

  const tvdbSeasons = (specialsEnabled() ? groupTvdbEpisodesBySeason(tvdbEpisodes) : groupTvdbEpisodesBySeason(tvdbEpisodes).filter((s) => s.seasonNumber !== 0));
  if (tvdbSeasons.length <= tmdbSeasons.length) {
    // TVDB isn't more granular here — just patch titles/dates in place.
    applyTvdbTitleOverrides(tvdbEpisodes, tmdbSeasons);
    return tmdbSeasons;
  }

  const seasonNames = tvdbId ? await getTvdbSeasonNames(tvdbId) : new Map<number, string>();

  return tvdbSeasons.map((s) => {
    const monitoredByDefault = s.seasonNumber !== 0;
    return {
      seasonNumber: s.seasonNumber,
      name: seasonNames.get(s.seasonNumber) ?? `Saison ${s.seasonNumber}`,
      monitored: monitoredByDefault,
      episodes: s.episodes.map((e) => ({
        seasonNumber: e.seasonNumber,
        episodeNumber: e.episodeNumber,
        title: e.title && !hasCjkText(e.title) ? e.title : `Épisode ${e.episodeNumber}`,
        airDate: e.airDate,
        monitored: monitoredByDefault,
        status: episodeStatus(e.airDate, e.title),
        file: null,
        activeInfoHash: null,
        plexRatingKey: null,
      })),
    };
  });
}

function applyTvdbTitleOverrides(tvdbEpisodes: TvdbEpisode[], seasons: LibrarySeason[]) {
  const bySeasonEpisode = new Map(tvdbEpisodes.map((e) => [`${e.seasonNumber}-${e.episodeNumber}`, e]));
  for (const season of seasons) {
    for (const ep of season.episodes) {
      const match = bySeasonEpisode.get(`${season.seasonNumber}-${ep.episodeNumber}`);
      if (match) {
        if (match.title && !hasCjkText(match.title)) ep.title = match.title;
        if (match.airDate) ep.airDate = match.airDate;
      }
    }
  }
}

interface DiskFile {
  path: string;
  episodeNumber: number;
}

interface DiskSeason {
  seasonNumber: number;
  files: DiskFile[];
}

const VIDEO_EXTS = /\.(mkv|mp4|avi|ts|m2ts|wmv|mov|webm|flv)$/i;

// Real pause between per-episode direct-search attempts — see the matching
// constant/comment in searchMissing.ts. Measured live: an indexer tripped
// its own 429 after ~35 requests in ~35s (one item = one request per
// indexer), so 800ms wasn't a large enough gap; raised here too for the
// same reason.
const ITEM_DELAY_MS = 1500;

function scanSeriesDiskStructure(baseDir: string): DiskSeason[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(baseDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const bySeason = new Map<number, DiskFile[]>();

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    // Match "Saison 1", "Season 01", "S01", "Saison 1 - Nom", "Specials",
    // "Season 00", etc. — "Specials" carries no digit at all, so it's
    // recognized by name and mapped straight to season 0.
    const isSpecials = /^specials?$/i.test(entry.name.trim());
    const sm = isSpecials ? null : entry.name.match(/S(?:aison)?[. _-]?(\d{1,2})/i);
    if (!isSpecials && !sm) continue;
    const seasonNumber = isSpecials ? 0 : parseInt(sm![1], 10);
    if (seasonNumber < 0) continue;

    let seasonFiles: fs.Dirent[];
    try {
      seasonFiles = fs.readdirSync(path.join(baseDir, entry.name), { withFileTypes: true });
    } catch {
      continue;
    }

    const diskFiles: DiskFile[] = [];
    for (const file of seasonFiles) {
      if (!file.isFile() || !VIDEO_EXTS.test(file.name)) continue;
      const parsed = parseRelease(file.name);
      if (parsed.season != null && parsed.season === seasonNumber && parsed.episode != null) {
        diskFiles.push({
          path: path.join(baseDir, entry.name, file.name),
          episodeNumber: parsed.episode,
        });
      }
    }

    if (diskFiles.length > 0) {
      diskFiles.sort((a, b) => a.episodeNumber - b.episodeNumber);
      bySeason.set(seasonNumber, diskFiles);
    }
  }

  return [...bySeason.entries()]
    .sort(([a], [b]) => a - b)
    .map(([seasonNumber, files]) => ({ seasonNumber, files }));
}

export type ResyncAnimeResult =
  | { ok: true; oldSeasonCount: number; newSeasonCount: number }
  | { ok: false; error: "not_found" | "no_tvdb_match" | "active_downloads" | "no_disk_seasons" };

/**
 * Resync a series already in the library :
 *
 * 1. Scan the actual media folder on disk for season directories and video
 *    files (SxxExx), then use TVDB for episode metadata.
 * 2. If nothing useful found on disk, fall back to the old TVDB-vs-TMDb
 *    comparison (kept for series that were added as separate seasons but
 *    whose episodes were never physically downloaded).
 *
 * The disk-driven path also creates seasons that have NO matching file yet
 * (they still show up in the UI as "missing") — the user wanted to see every
 * season they own even when the episode library is incomplete.
 */
export async function resyncAnimeSeasonsFromTvdb(seriesId: string): Promise<ResyncAnimeResult> {
  const series = getSeries(seriesId);
  if (!series) return { error: "not_found", ok: false };

  const oldSorted = [...series.seasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
  const oldFlat = oldSorted.flatMap((s) => [...s.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber));
  if (oldFlat.some((e) => e.status === "downloading" || e.status === "searching")) {
    return { error: "active_downloads", ok: false };
  }

  // ---- 1. Detect series base directory from an existing file path ----
  const firstFile = oldFlat.find((e) => e.file?.path);
  let baseDir: string | null = null;
  if (firstFile?.file?.path) {
    const fileDir = path.dirname(firstFile.file.path);
    // If the immediate parent folder looks like a season dir, go up one level
    baseDir = /S(?:aison)?[. _-]?\d{1,2}/i.test(path.basename(fileDir))
      ? path.dirname(fileDir)
      : fileDir;
  }

  // ---- 2. Scan disk seasons ----
  const diskSeasons = baseDir ? scanSeriesDiskStructure(baseDir) : [];

  // ---- 3. Get TVDB metadata ----
  const meta = await fetchTmdbSeries(series.tmdbId);
  const tvdbEpisodes = await getTvdbEpisodesFor(meta?.tvdbId ?? null, series.title, series.year);
  const seasonNames = meta?.tvdbId ? await getTvdbSeasonNames(meta.tvdbId) : new Map<number, string>();
  const tvdbByKey = new Map<string, TvdbEpisode>();
  for (const e of tvdbEpisodes) {
    tvdbByKey.set(`${e.seasonNumber}-${e.episodeNumber}`, e);
  }

  // Build a lookup of existing titles before TVDB overwrites them — used to
  // preserve French/Latin titles when TVDB only has Japanese (CJK) for an ep.
  const existingTitleByKey = new Map<string, string>();
  for (const ep of oldFlat) {
    existingTitleByKey.set(`${ep.seasonNumber}-${ep.episodeNumber}`, ep.title);
  }

  // ---- 4. Disk-driven path — build seasons from what exists on disk ----
  if (diskSeasons.length > 0) {
    const newSeasons: LibrarySeason[] = [];

    for (const ds of diskSeasons) {
      const episodeNumbers = new Set(ds.files.map((f) => f.episodeNumber));

      // Collect all episode numbers TVDB knows about for this season, plus
      // any extras found on disk that TVDB doesn't list.
      const allEps = new Set<number>();
      for (const ep of tvdbEpisodes.filter((e) => e.seasonNumber === ds.seasonNumber)) {
        allEps.add(ep.episodeNumber);
      }
      for (const epN of episodeNumbers) allEps.add(epN);

      const episodes: LibraryEpisode[] = [...allEps].sort((a, b) => a - b).map((epN) => {
        const tvdb = tvdbByKey.get(`${ds.seasonNumber}-${epN}`);
        const diskFile = ds.files.find((f) => f.episodeNumber === epN);
        let status: LibraryEpisode["status"] = "missing";
        let file: LibraryEpisode["file"] = null;
        if (diskFile) {
          status = "available";
          const parsed = parseRelease(path.basename(diskFile.path));
          let stat: fs.Stats | undefined;
          try { stat = fs.statSync(diskFile.path); } catch { /* ignore */ }
          file = {
            path: diskFile.path,
            quality: parsed.source ?? "—",
            resolution: parsed.resolution ?? null,
            videoCodec: parsed.videoCodec,
            audioCodec: parsed.audioCodec,
            hdr: parsed.hdr,
            source: parsed.source,
            size: stat?.size ?? 0,
            addedAt: Date.now(),
          };
        }
        const existingTitle = existingTitleByKey.get(`${ds.seasonNumber}-${epN}`);
        return {
          seasonNumber: ds.seasonNumber,
          episodeNumber: epN,
          // CJK handling:
          //  - existing French/Latin title (not CJK) → keep it, ignore TVDB
          //  - existing CJK title + TVDB has a non-CJK (French) title → replace
          //  - existing CJK title + TVDB is also CJK (or null) → fall back to
          //    the generic "Épisode N" rather than propagating another CJK
          //    string — this is the v1.3.1/v1.3.2 bug: the old condition still
          //    picked tvdb.title when it was CJK, so a Japanese title just got
          //    replaced with another Japanese title.
          title: !existingTitle || hasCjkText(existingTitle)
            ? (tvdb?.title && !hasCjkText(tvdb.title) ? tvdb.title : `Épisode ${epN}`)
            : existingTitle,
          airDate: tvdb?.airDate ?? null,
          monitored: true,
          status,
          file,
          activeInfoHash: null,
          plexRatingKey: null,
        };
      });

      newSeasons.push({
        seasonNumber: ds.seasonNumber,
        name: seasonNames.get(ds.seasonNumber) ?? `Saison ${ds.seasonNumber}`,
        monitored: true,
        episodes,
      });
    }

    updateSeries(seriesId, { seasons: newSeasons });
    return { ok: true, oldSeasonCount: series.seasons.length, newSeasonCount: newSeasons.length };
  }

  // ---- 5. Fallback: no disk data — compare TVDB vs TMDb directly ----
  if (tvdbEpisodes.length === 0) return { ok: false, error: diskSeasons.length === 0 && baseDir ? "no_disk_seasons" : "no_tvdb_match" };

  const tvdbSeasons = (specialsEnabled() ? groupTvdbEpisodesBySeason(tvdbEpisodes) : groupTvdbEpisodesBySeason(tvdbEpisodes).filter((s) => s.seasonNumber !== 0));
  if (tvdbSeasons.length <= series.seasons.length) {
    // TVDB isn't more granular here, but resyncing is still worth doing for
    // its own sake: refreshing episode titles (e.g. picking up a
    // newly-working localized TVDB title where the library still has the
    // Japanese original from an earlier import) shouldn't require a season
    // restructure to happen at all — patch titles/dates in place instead of
    // silently no-oping.
    const patched = series.seasons.map((se) => ({ ...se, episodes: se.episodes.map((e) => ({ ...e })) }));
    applyTvdbTitleOverrides(tvdbEpisodes, patched);
    updateSeries(seriesId, { seasons: patched });
    return { ok: true, oldSeasonCount: series.seasons.length, newSeasonCount: patched.length };
  }

  const newSeasons: LibrarySeason[] = [];
  let cursor = 0;
  for (const s of tvdbSeasons) {
    // Same opt-in-by-default rule as a fresh add — a genuinely new season 0
    // discovered here (no prior library entry to carry a monitored flag
    // from) shouldn't come pre-monitored the way a real season does.
    const monitoredByDefault = s.seasonNumber !== 0;
    // Season 0 never participates in the positional carry-over below: it's
    // new territory for any series added before specials were tracked, so
    // there's no legitimate "old" episode at any particular cursor position
    // to correspond to it — consuming cursor slots for it would shift every
    // later real season's carry-over by however many specials TVDB reports,
    // silently reassigning files/statuses between unrelated episodes.
    const episodes: LibraryEpisode[] = s.episodes.map((e) => {
      const carried = s.seasonNumber === 0 ? undefined : oldFlat[cursor++];
      return {
        seasonNumber: e.seasonNumber,
        episodeNumber: e.episodeNumber,
        title: !carried || hasCjkText(carried.title)
          ? (e.title && !hasCjkText(e.title) ? e.title : `Épisode ${e.episodeNumber}`)
          : carried.title,
        airDate: e.airDate,
        monitored: carried?.monitored ?? monitoredByDefault,
        status: carried?.status ?? "missing",
        file: carried?.file ?? null,
        activeInfoHash: carried?.activeInfoHash ?? null,
        plexRatingKey: carried?.plexRatingKey ?? null,
      };
    });
    newSeasons.push({
      seasonNumber: s.seasonNumber,
      name: seasonNames.get(s.seasonNumber) ?? `Saison ${s.seasonNumber}`,
      monitored: monitoredByDefault,
      episodes,
    });
  }

  updateSeries(seriesId, { seasons: newSeasons });
  return { ok: true, oldSeasonCount: series.seasons.length, newSeasonCount: newSeasons.length };
}

/**
 * Backfills season 0 (specials) from TMDb for a series that already has a
 * library entry but was added before specials were tracked at all — TMDb is
 * the metadata source for EVERY series (not just anime, which additionally
 * gets the richer TVDB-sourced resync above), so this is the generic
 * counterpart that applies regardless of genre. Purely additive: never
 * touches a season the series already has, only appends season 0 when TMDb
 * lists one and the series doesn't have it yet.
 */
export async function backfillMissingSeason0FromTmdb(seriesId: string): Promise<{ ok: boolean; added: boolean; error?: string }> {
  if (!specialsEnabled()) return { ok: true, added: false };

  const series = getSeries(seriesId);
  if (!series) return { ok: false, added: false, error: "not_found" };
  if (series.seasons.some((s) => s.seasonNumber === 0)) return { ok: true, added: false };

  const meta = await fetchTmdbSeries(series.tmdbId).catch(() => null);
  const tmdbSeason0 = meta?.seasons.find((s) => s.seasonNumber === 0);
  if (!tmdbSeason0) return { ok: true, added: false };

  const detail = await fetchTmdbSeason(series.tmdbId, 0).catch(() => null);
  const episodes: LibraryEpisode[] = (detail?.episodes ?? []).map((e) => ({
    seasonNumber: e.seasonNumber,
    episodeNumber: e.episodeNumber,
    title: e.title,
    airDate: e.airDate,
    monitored: false,
    status: episodeStatus(e.airDate, e.title),
    file: null,
    activeInfoHash: null,
    plexRatingKey: null,
  }));

  const newSeason: LibrarySeason = { seasonNumber: 0, name: tmdbSeason0.name, monitored: false, episodes };
  updateSeries(seriesId, { seasons: [...series.seasons, newSeason] });
  return { ok: true, added: true };
}

/**
 * Create (or reuse) the library entry for a series — every season/episode
 * TMDb knows about, tracked individually — then kick off an automatic search
 * for the first monitored season so the pipeline proves out immediately.
 * Remaining seasons stay "missing" until searched from the Wanted list or a
 * season's own search button, same as the movie flow scales to real catalogs.
 */
export async function addSeriesToLibrary(
  tmdbId: number,
  qualityProfileId?: string,
  seasonNumbers?: number[],
  options?: { skipSearch?: boolean }
) {
  const existing = getSeriesByTmdbId(tmdbId);
  if (existing) return { series: existing, searchResult: null };

  const meta = await fetchTmdbSeries(tmdbId);
  if (!meta) return { error: "series not found on TMDb" as const };

  const specialsAllowed = specialsEnabled();
  const targetSeasons = (seasonNumbers?.length
    ? meta.seasons.filter((s) => seasonNumbers.includes(s.seasonNumber))
    : meta.seasons
  ).filter((s) => specialsAllowed || s.seasonNumber !== 0);

  const seasons: LibrarySeason[] = [];
  for (const s of targetSeasons) {
    // Specials (season 0 — OVAs, recaps, bonus content) are tracked like any
    // other season now, but default unmonitored: they're lower-value and
    // often harder to find releases for than regular episodes, so opting in
    // is on the user rather than auto-searching them the moment a series is
    // added. Regular seasons are unaffected (still default monitored).
    const monitoredByDefault = s.seasonNumber !== 0;
    const detail = await fetchTmdbSeason(tmdbId, s.seasonNumber);
    const episodes: LibraryEpisode[] = (detail?.episodes ?? []).map((e) => ({
      seasonNumber: e.seasonNumber,
      episodeNumber: e.episodeNumber,
      title: e.title,
      airDate: e.airDate,
      monitored: monitoredByDefault,
      // Unaired episodes start "upcoming" — excluded from every search path
      // until releaseDayTask flips them to "missing" on/after air date.
      // Same for TBA placeholders with no date at all (episodeStatus).
      status: episodeStatus(e.airDate, e.title),
      file: null,
      activeInfoHash: null,
      plexRatingKey: null,
    }));
    seasons.push({ seasonNumber: s.seasonNumber, name: s.name, monitored: monitoredByDefault, episodes });
  }

  const finalSeasons = meta.isAnime && tvdbConfigured() && !seasonNumbers?.length
    ? await buildAnimeSeasonsFromTvdb(meta.title, meta.year, meta.tvdbId, seasons)
    : seasons;

  const series: LibrarySeries = {
    id: `sr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    tmdbId: meta.tmdbId,
    imdbId: meta.imdbId,
    title: meta.title,
    year: meta.year,
    releaseDate: meta.releaseDate,
    overview: meta.overview,
    posterPath: meta.posterPath,
    backdropPath: meta.backdropPath,
    rating: meta.rating,
    genres: meta.genres,
    tvStatus: meta.status,
    monitored: true,
    qualityProfileId: qualityProfileId ?? defaultQualityProfile().id,
    seasons: finalSeasons,
    addedAt: Date.now(),
    tags: [],
    plexRatingKey: null,
    originalTitle: meta.originalTitle,
  };
  addSeries(series);

  const searchResult = options?.skipSearch ? null : await searchAndGrabCompleteSeries(series.id);
  return { series, searchResult };
}

export function profileFor(qualityProfileId: string) {
  return DEFAULT_QUALITY_PROFILES.find((p) => p.id === qualityProfileId) ?? DEFAULT_QUALITY_PROFILES[0];
}

type GrabReleaseResult =
  | { ok: true; release: IndexerRelease }
  | { ok: false; error: "no_indexers" | "no_match"; totalReleases?: number };

/** Turns a grabRelease/tryGrabSeriesPack failure into a readable sentence for the activity log. */
function describeGrabFailure(result: { error: "no_indexers" | "no_match"; totalReleases?: number }): string {
  if (result.error === "no_indexers") return "Aucun indexeur torrent activé.";
  if (!result.totalReleases) return "Aucun résultat trouvé sur les indexeurs pour cette recherche.";
  return `${result.totalReleases} résultat(s) trouvé(s) sur les indexeurs, mais aucun ne correspond au titre, à la saison/l'épisode, à la résolution autorisée ou au score minimum du profil de qualité.`;
}

/**
 * Single activity-v2 "grabbed" entry for every series grab path (épisode,
 * pack de saison, intégrale), so Activité always knows WHAT level of content
 * the torrent carries. Convention used by the queue reconstruction too
 * (activity/v2/route.ts): season === 0 + packEpisodeCount = intégrale.
 */
function logSeriesGrabV2(
  series: LibrarySeries,
  kind: "episode" | "season" | "series",
  release: IndexerRelease,
  packEpisodeCount: number,
  seasonCount: number,
  season?: number,
  episode?: number
) {
  logActivityV2({
    kind: "grabbed",
    media: createMediaRef(
      "series",
      series.id,
      series.tmdbId,
      series.title,
      kind === "episode" ? season : kind === "season" ? season : 0,
      kind === "episode" ? episode : undefined,
      packEpisodeCount,
      kind === "series" ? seasonCount : undefined
    ),
    actor: "system",
    release: createReleaseRef(
      release.indexerId,
      release.title,
      release.protocol,
      release.size,
      parseRelease(release.title).source ?? "Inconnue",
      release.score,
      release.seeders ?? undefined,
      release.leechers ?? undefined
    ),
    metadata: { libraryRef: encodeLibraryRef({ kind, seriesId: series.id, season, episode } as never) },
  });
}

async function grabRelease(
  series: LibrarySeries,
  seasonNumber: number,
  episodeNumber: number | undefined,
  profile: ReturnType<typeof profileFor>,
  filterPack: boolean
): Promise<GrabReleaseResult> {
  const t0 = performance.now();
  const releases = searchFromCache(TV_CATEGORY_IDS);
  const cacheMs = Math.round(performance.now() - t0);
  const rules = loadReleaseRules();

  // Part-pack context for single-season series (DVD-ordering splits — see
  // partPackInfo in matching.ts). Null for multi-season series, so their
  // exact season matching is completely untouched.
  const singleSeasonTotalEpisodes = series.seasons.length === 1 ? series.seasons[0].episodes.length : null;

  const label = episodeNumber
    ? `${series.title} S${String(seasonNumber).padStart(2, "0")}E${String(episodeNumber).padStart(2, "0")}`
    : `${series.title} S${String(seasonNumber).padStart(2, "0")} (pack)`;

  // Scene/tracker releases are always named after the ORIGINAL title — a
  // French title (e.g. "Ma vie avec les Walter Boys" vs the release
  // "My.Life.With.The.Walter.Boys") never matches anything. The original
  // title becomes the primary search target; the localized title stays as
  // an alias (verified live: C411 + TR4KER both return 0 for the FR title,
  // plenty of hits for the EN one).
  const searchTitle = series.originalTitle && series.originalTitle !== series.title ? series.originalTitle : series.title;
  const searchAliases = [
    ...(series.aliases ?? []),
    ...(series.originalTitle && series.originalTitle !== series.title ? [series.originalTitle] : []),
  ];

  recordSearchLog("debug", "grab_release.cache_read", `${label} — cache RSS donne ${releases.length} release(s) (${cacheMs}ms)`, cacheMs);

  const tS = performance.now();
  // Parse + title/season/episode matching (the CPU-heavy regex pass over
  // every cached release) runs in a real worker thread, not here — see
  // releaseMatchWorker.mjs for why. Everything after (blocked words,
  // resolution, score, size) stays on the main thread: it's cheap array
  // filtering that needs live store/config state, not worth a round-trip.
  const matched = await getReleaseMatchPool().run({
    releases: releases.map((r) => ({ title: r.title })),
    targetTitle: searchTitle,
    aliases: searchAliases,
    seasonNumber,
    episodeNumber: filterPack ? null : (episodeNumber ?? null),
    filterPack,
    partTotalEpisodes: singleSeasonTotalEpisodes,
  });
  const step4 = matched.survivors.map(({ idx, parsed }) => ({ release: releases[idx], parsed }));
  // Two library entries can share the exact same title with nothing but the
  // year to tell them apart (e.g. "Doctor Who" 1963 vs 2005 — confirmed
  // live: the classic show's season/episode search matched and grabbed a
  // release actually belonging to the 2005 reboot, since season numbers
  // alone don't disambiguate two shows that both have a "season 9"). The
  // intégrale search path already guards against this with yearIsCompatible
  // — season/episode search never did. Same lenient semantics: a release
  // with no year at all still passes, only a release that states a clearly
  // different year gets rejected.
  // KNOWN TRADEOFF: series.year is always the show's DEBUT year, not the
  // broadcast year of any specific season — a decades-spanning back
  // catalogue (26 seasons across 1963-1989, in Doctor Who's own case) could
  // in principle have an old season's release tagged with its own real
  // broadcast year, which would then get wrongly rejected here since it sits
  // more than a year off the debut year. Accepted deliberately: it's the
  // same tradeoff the intégrale path has already lived with, and it only
  // trades a same-title-different-year false positive (silently grabbing
  // the wrong show, confirmed to actually happen) for a narrower false
  // negative (a legitimate old-season release requiring a manual grab) —
  // revisit with a per-season tolerance if that ever surfaces for real.
  const stepYear = step4.filter(({ parsed }) => yearIsCompatible(parsed.year, series.year));
  // Decision Guard: a blocked term is a hard veto here — no score, however high, can rescue a release an admin explicitly forbade.
  const stepBlocked = stepYear.filter(({ release }) => !isBlockedForAutoGrab(release.title, rules, series.title).blocked);
  const step5 = stepBlocked.filter(({ parsed }) => !parsed.resolution || profile.allowedResolutions.includes(parsed.resolution));
  const step6 = step5.filter(({ release }) => release.score >= profile.minScore);
  const step7 = step6.filter(({ release }) => withinSizeLimit(release.size, filterPack ? "season" : "episode"));
  const step8 = step7.filter(({ release }) => !isRecentlyFailedRelease(release.infoHash));
  const candidates = step8.sort((a, b) => compareBySizePreference(rules.sizePreference, { ...a.release, videoCodec: a.parsed.videoCodec }, { ...b.release, videoCodec: b.parsed.videoCodec }));
  const scoreMs = Math.round(performance.now() - tS);
  recordSearchLog("debug", "grab_release.scoring", `${label} — ${candidates.length} candidat(s) sur ${releases.length} brut(s) (${scoreMs}ms), titre:${matched.titleCount}, saison:${matched.secondCount}, pack:${matched.packCount}, résolution:${step5.length}, score:${step6.length}, taille:${step7.length}, échec:${step8.length}`, scoreMs);

  if (candidates.length > 0) {
    const top = candidates[0];
    recordSearchLog("info", "grab_release.match", `${label} — meilleur candidat: "${top.release.title}" (score:${top.release.score}, indexeur:${top.release.indexerId})`);
    recordDecision({
      refTitle: label,
      releaseTitle: top.release.title,
      decision: "accepted",
      reasons: top.release.scoreBreakdown?.length
        ? top.release.scoreBreakdown.map((b) => ({ type: "score", message: `${b.label} (${b.delta >= 0 ? "+" : ""}${b.delta})` }))
        : [{ type: "profile_match", message: "Correspond au profil de qualité" }],
    });
    return { ok: true, release: top.release };
  }

  // Cache RSS vide pour ce titre — repli sur une recherche directe (comme
  // avant le passage au cache-only en v1.1.14). Le cache RSS ne contient que
  // les ~100-150 dernières sorties toutes séries confondues ; une saison plus
  // ancienne n'y apparaît jamais. withoutRateLimited() exclut un indexeur
  // encore en cooldown 429 sans empêcher l'autre de répondre.
  const configuredIndexers = loadIndexers().filter((i) => i.enabled && i.protocol === "torrent");
  const indexers = withoutRateLimited(configuredIndexers);
  const alreadyLimited = configuredIndexers.length - indexers.length;
  if (indexers.length === 0) {
    recordSearchLog("warn", "grab_release.no_match", `${label} — 0 candidat sur ${releases.length} bruts, aucun indexeur disponible : tous rate-limités (${alreadyLimited}/${configuredIndexers.length})`);
    return { ok: false, error: "no_match", totalReleases: releases.length };
  }

  const tDirect = performance.now();
  recordSearchLog(
    "info",
    "grab_release.fallback_direct",
    `${label} — cache vide, recherche directe sur ${indexers.length} indexeur(s)` +
      (alreadyLimited > 0 ? ` (${alreadyLimited} exclu(s), déjà rate-limité(s))` : "")
  );
  // Sequential: un indexeur à la fois pour éviter les 429 en parallèle.
  const directReleases: IndexerRelease[] = [];
  for (const ix of indexers) {
    const results = await searchTv(ix, { title: searchTitle, season: seasonNumber, episode: filterPack ? null : episodeNumber, tvdbId: series.tvdbId ?? null }, TV_CATEGORY_IDS).catch(() => [] as IndexerRelease[]);
    directReleases.push(...results);
  }
  const directMs = Math.round(performance.now() - tDirect);
  const newlyLimited = countNewlyRateLimited(indexers);
  recordSearchLog("info", "grab_release.fallback_result", `${label} — recherche directe: ${directReleases.length} release(s) (${directMs}ms)`, directMs);

  const dMatched = await getReleaseMatchPool().run({
    releases: directReleases.map((r) => ({ title: r.title })),
    targetTitle: searchTitle,
    aliases: searchAliases,
    seasonNumber,
    episodeNumber: filterPack ? null : (episodeNumber ?? null),
    filterPack,
    partTotalEpisodes: singleSeasonTotalEpisodes,
  });
  const dStep4 = dMatched.survivors.map(({ idx, parsed }) => ({ release: directReleases[idx], parsed }));
  const dStepYear = dStep4.filter(({ parsed }) => yearIsCompatible(parsed.year, series.year));
  const dStepBlocked = dStepYear.filter(({ release }) => !isBlockedForAutoGrab(release.title, rules, series.title).blocked);
  const dStep5 = dStepBlocked.filter(({ parsed }) => !parsed.resolution || profile.allowedResolutions.includes(parsed.resolution));
  const dStep6 = dStep5.filter(({ release }) => release.score >= profile.minScore);
  const dStep7 = dStep6.filter(({ release }) => withinSizeLimit(release.size, filterPack ? "season" : "episode"));
  const dStep8 = dStep7.filter(({ release }) => !isRecentlyFailedRelease(release.infoHash));
  const directCandidates = dStep8.sort((a, b) => compareBySizePreference(rules.sizePreference, { ...a.release, videoCodec: a.parsed.videoCodec }, { ...b.release, videoCodec: b.parsed.videoCodec }));

  const topDirect = directCandidates[0];
  if (!topDirect) {
    if (newlyLimited > 0) {
      recordSearchLog("warn", "grab_release.fallback_rate_limited", `${label} — 0 résultat : ${newlyLimited} indexeur(s) ont répondu 429 (rate-limité) pendant cette recherche, pas forcément "rien trouvé"`);
    } else {
      recordSearchLog("warn", "grab_release.no_match", `${label} — 0 candidat sur ${directReleases.length} directs (titre:${dMatched.titleCount}, saison:${dMatched.secondCount}, pack:${dMatched.packCount}, résolution:${dStep5.length}, score:${dStep6.length}, taille:${dStep7.length}, échec:${dStep8.length})`);
    }
    return { ok: false, error: "no_match", totalReleases: releases.length + directReleases.length };
  }
  recordSearchLog("info", "grab_release.fallback_match", `${label} — meilleur candidat via recherche directe: "${topDirect.release.title}" (score:${topDirect.release.score}, indexeur:${topDirect.release.indexerId})`);
  recordDecision({
    refTitle: label,
    releaseTitle: topDirect.release.title,
    decision: "accepted",
    reasons: topDirect.release.scoreBreakdown?.length
      ? topDirect.release.scoreBreakdown.map((b) => ({ type: "score", message: `${b.label} (${b.delta >= 0 ? "+" : ""}${b.delta})` }))
      : [{ type: "profile_match", message: "Correspond au profil de qualité" }],
  });
  return { ok: true, release: topDirect.release };
}

async function sendToEngine(
  release: IndexerRelease,
  category: "series",
  libraryRef: string,
  title: string,
  episodeTarget?: { season: number; episode: number },
  episodeTargets?: { season: number; episode: number }[]
) {
  const payload = await buildGrabPayload({
    magnetUrl: release.magnetUrl,
    downloadUrl: release.downloadUrl,
    indexerId: release.indexerId,
  });
  if ("error" in payload) return { error: "grab_failed" as const, detail: payload.error };
  try {
    const res = await fetch(`${ENGINE_BASE}/torrents`, {
      method: "POST",
      headers: engineHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ ...payload, category, libraryRef, title, episodeTarget, episodeTargets }),
      signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS),
    });
    const torrent = await res.json();
    if (!res.ok) return { error: "engine_rejected" as const, detail: torrent };
    return { ok: true as const, torrent };
  } catch {
    return { error: "engine_unreachable" as const };
  }
}

function setEpisodeStatus(
  series: LibrarySeries,
  seasonNumber: number,
  episodeNumber: number,
  patch: Partial<LibraryEpisode>
) {
  setEpisodesStatus(series, seasonNumber, [episodeNumber], patch);
}

/**
 * Patches several episodes of one season in a single write. Calling
 * setEpisodeStatus in a loop looked equivalent but wasn't: each call rebuilt
 * the whole season from the same stale `series` snapshot passed into the
 * loop, so updateSeries's whole-array replace meant every iteration
 * clobbered the previous one — only the last episode touched ever kept its
 * new status ("only the last episode shows as downloading" for a season
 * pack). This computes every episode's patch once, then writes once.
 */
function setEpisodesStatus(
  series: LibrarySeries,
  seasonNumber: number,
  episodeNumbers: number[],
  patch: Partial<LibraryEpisode>
) {
  const targets = new Set(episodeNumbers);
  const seasons = series.seasons.map((s) =>
    s.seasonNumber !== seasonNumber
      ? s
      : { ...s, episodes: s.episodes.map((e) => (targets.has(e.episodeNumber) ? { ...e, ...patch } : e)) }
  );
  updateSeries(series.id, { seasons });
}

/**
 * Same clobbering hazard as setEpisodesStatus, one level up: a series-pack
 * grab spans several seasons at once, and calling setEpisodesStatus in a
 * loop (once per season) against the same pre-loop `series` snapshot meant
 * each call's updateSeries wholesale-replaced the season array computed from
 * that stale snapshot — only the LAST season processed ever kept its
 * "downloading" status, every earlier one silently reverted to "missing".
 * This computes every season's patch in one pass, then writes once.
 */
function setMultiSeasonEpisodesStatus(
  series: LibrarySeries,
  bySeason: Map<number, number[]>,
  patch: Partial<LibraryEpisode>
) {
  const seasons = series.seasons.map((s) => {
    const episodeNumbers = bySeason.get(s.seasonNumber);
    if (!episodeNumbers) return s;
    const targets = new Set(episodeNumbers);
    return { ...s, episodes: s.episodes.map((e) => (targets.has(e.episodeNumber) ? { ...e, ...patch } : e)) };
  });
  updateSeries(series.id, { seasons });
}

/** Groups { season, episode } targets by season, for a single setEpisodesStatus call per season. */
function groupTargetsBySeason(targets: { season: number; episode: number }[]): Map<number, number[]> {
  const bySeason = new Map<number, number[]>();
  for (const t of targets) {
    const list = bySeason.get(t.season) ?? [];
    list.push(t.episode);
    bySeason.set(t.season, list);
  }
  return bySeason;
}

/**
 * Search + grab a single episode. Shared by manual retries and season-pack
 * fallback. If no standalone release for this one episode clears the
 * quality profile, falls back to a season pack — and while a pack is being
 * pulled anyway, every other missing episode of that season rides along
 * (episodeTargets tells the engine which files to keep, see
 * selectEpisodeFiles in instance.mjs), instead of downloading gigabytes just
 * to extract the one file that was actually asked for.
 */
export async function searchAndGrabEpisode(
  seriesId: string,
  seasonNumber: number,
  episodeNumber: number,
  options?: { skipPackRetry?: boolean }
) {
  const series = getSeries(seriesId);
  if (!series) return { error: "series not found" as const };
  const profile = profileFor(series.qualityProfileId);
  const media = createMediaRef("series", seriesId, series.tmdbId, series.title, seasonNumber, episodeNumber);

  // Snapshot the season's missing episodes before flipping this one to
  // "searching" — otherwise it drops out of its own "missing" filter below.
  const season = series.seasons.find((s) => s.seasonNumber === seasonNumber);
  const missingInSeason = new Set(
    (season?.episodes ?? []).filter((e) => e.monitored && e.status === "missing").map((e) => e.episodeNumber)
  );
  missingInSeason.add(episodeNumber);
  const missingEpisodeNumbers = [...missingInSeason];

  setEpisodeStatus(series, seasonNumber, episodeNumber, { status: "searching" });

  // try/finally safety net: any exception between the flip and the restore
  // paths below would leave the episode "searching" forever (see
  // restoreStaleEpisodeSearch). A successful grab already moved it to
  // "downloading" — the finally only restores what is STILL "searching".
  try {
    return await searchAndGrabEpisodeCascade(series, seriesId, seasonNumber, episodeNumber, profile, media, missingEpisodeNumbers, options);
  } finally {
    restoreStaleEpisodeSearch(seriesId, seasonNumber, episodeNumber);
  }
}

/**
 * The actual search cascade of searchAndGrabEpisode, extracted so the
 * "searching" flip above is always protected by the finally — see
 * restoreStaleEpisodeSearch for why that matters.
 */
async function searchAndGrabEpisodeCascade(
  series: LibrarySeries,
  seriesId: string,
  seasonNumber: number,
  episodeNumber: number,
  profile: ReturnType<typeof profileFor>,
  media: ReturnType<typeof createMediaRef>,
  missingEpisodeNumbers: number[],
  options?: { skipPackRetry?: boolean }
) {
  // RÈGLE ABSOLUE — cascade stricte : intégrale d'abord, sinon saison, sinon
  // épisode seul. skipPackRetry (posé par les boucles batch) signifie que
  // l'intégrale ET la saison ont déjà été cherchées et épuisées pour cette
  // série dans ce même run → on ne cherche que l'épisode seul.
  if (!options?.skipPackRetry) {
    // Intégrale d'abord — couvre toute la série d'un coup quand elle existe.
    const seriesPack = await tryGrabSeriesPack(series, profile);
    if (seriesPack) {
      setMultiSeasonEpisodesStatus(series, groupTargetsBySeason(seriesPack.targets), { status: "downloading", activeInfoHash: seriesPack.torrent.infoHash });
      void notifySeerrProcessingOnce("series", series.tmdbId).catch(() => {});
      logActivity("grabbed", "system", `${series.title} — intégrale (${seriesPack.targets.length} ép.)`, `/title/series/${series.tmdbId}`, {
        libraryRef: encodeLibraryRef({ kind: "series", seriesId }),
        releaseTitle: seriesPack.release.title,
        indexer: seriesPack.release.indexerId,
        infoHash: seriesPack.torrent.infoHash,
      });
      logSeriesGrabV2(
        series,
        "series",
        seriesPack.release,
        seriesPack.targets.length,
        new Set(seriesPack.targets.map((t) => t.season)).size
      );
      return { ok: true as const, release: seriesPack.release, torrent: seriesPack.torrent };
    }

    await new Promise<void>((resolve) => setTimeout(resolve, ITEM_DELAY_MS));

    // Pas d'intégrale — un pack de saison vaut le coup : il amène aussi tous
    // les autres épisodes manquants de la saison.
    const pack = await tryGrabSeasonPack(series, seasonNumber, profile, missingEpisodeNumbers);
    if (pack) {
      setEpisodesStatus(series, seasonNumber, missingEpisodeNumbers, { status: "downloading", activeInfoHash: pack.torrent.infoHash });
      void notifySeerrProcessingOnce("series", series.tmdbId).catch(() => {});
      logActivity("grabbed", "system", `${series.title} — saison ${seasonNumber} (${missingEpisodeNumbers.length} ép., via ${seasonNumber}x${String(episodeNumber).padStart(2, "0")})`, `/title/series/${series.tmdbId}`, {
        libraryRef: encodeLibraryRef({ kind: "season", seriesId, season: seasonNumber }),
        releaseTitle: pack.release.title,
        indexer: pack.release.indexerId,
        infoHash: pack.torrent.infoHash,
      });
      logSeriesGrabV2(series, "season", pack.release, missingEpisodeNumbers.length, 1, seasonNumber);
      return { ok: true as const, release: pack.release, torrent: pack.torrent };
    }

    await new Promise<void>((resolve) => setTimeout(resolve, ITEM_DELAY_MS));
  }

  // Ni intégrale ni saison — l'épisode seul, en dernier.
  const single = await grabRelease(series, seasonNumber, episodeNumber, profile, false);
  if (single.ok) {
    // Same season-part translation as tryGrabSeasonPackImpl: a part release
    // (single-season series, DVD ordering) names its files in its own
    // numbering — the engine target must follow or no file is selected.
    const partPack = partPackInfo(series, parseRelease(single.release.title));
    let episodeTarget = { season: seasonNumber, episode: episodeNumber };
    if (partPack) {
      const k = episodeNumber - (partPack.partNumber - 1) * partPack.partSize;
      if (k >= 1 && k <= partPack.partSize) episodeTarget = { season: partPack.partNumber, episode: k };
    }
    const sent = await sendToEngine(
      single.release,
      "series",
      encodeLibraryRef({ kind: "episode", seriesId, season: seasonNumber, episode: episodeNumber }),
      series.title,
      episodeTarget
    );
    if ("error" in sent) {
      setEpisodeStatus(series, seasonNumber, episodeNumber, { status: "missing" });
      logActivityV2({ kind: "failed", media, actor: "system", failure: createFailureRef("download_failed", "Le moteur de téléchargement a refusé ou n'a pas pu joindre cette release.") });
      return sent;
    }
    setEpisodeStatus(series, seasonNumber, episodeNumber, { status: "downloading", activeInfoHash: sent.torrent.infoHash });
    void notifySeerrProcessingOnce("series", series.tmdbId).catch(() => {});
    logActivity("grabbed", "system", `${series.title} — ${seasonNumber}x${String(episodeNumber).padStart(2, "0")}`, `/title/series/${series.tmdbId}`, {
      libraryRef: encodeLibraryRef({ kind: "episode", seriesId, season: seasonNumber, episode: episodeNumber }),
      releaseTitle: single.release.title,
      indexer: single.release.indexerId,
      infoHash: sent.torrent.infoHash,
    });
    logSeriesGrabV2(series, "episode", single.release, 1, 1, seasonNumber, episodeNumber);
    emitNotification(
      "grab_episode",
      `${series.title} — ${seasonNumber}x${String(episodeNumber).padStart(2, "0")} récupéré`,
      `/title/series/${series.tmdbId}`,
      { title: series.title, code: `${seasonNumber}x${String(episodeNumber).padStart(2, "0")}` }
    );
    return { ok: true as const, release: single.release, torrent: sent.torrent };
  }

  setEpisodeStatus(series, seasonNumber, episodeNumber, { status: "missing" });
  logActivityV2({
    kind: "failed",
    media,
    actor: "system",
    failure: createFailureRef(
      single.error === "no_indexers" ? "no_indexers" : "no_release_found",
      options?.skipPackRetry
        ? `Aucune release exploitable trouvée pour cet épisode (pack de saison et intégrale déjà écartés pour cette série). ${describeGrabFailure(single)}`
        : `Aucune release exploitable trouvée, ni pour une intégrale, ni pour un pack de saison, ni pour l'épisode seul. ${describeGrabFailure(single)}`
    ),
  });
  return single;
}

/**
 * try/finally safety net for the "searching" flip: whatever throws between
 * the flip and the restore paths (worker-pool crash, indexer timeout,
 * engine outage), the episode must come back to "missing". A status left
 * "searching" has no resumer anywhere except the boot-time
 * reconcileStaleSearches — confirmed live: a bulk search hit by an error
 * left 13 episodes of Les Experts stuck on "Recherche…" for days.
 * Only restores if the episode is STILL "searching" — a grab that
 * succeeded, or a concurrent search that progressed it, keeps its status.
 */
function restoreStaleEpisodeSearch(seriesId: string, seasonNumber: number, episodeNumber: number) {
  const fresh = getSeries(seriesId);
  if (!fresh) return;
  const ep = fresh.seasons
    .find((s) => s.seasonNumber === seasonNumber)
    ?.episodes.find((e) => e.episodeNumber === episodeNumber);
  if (!ep || ep.status !== "searching") return;
  setEpisodeStatus(fresh, seasonNumber, episodeNumber, { status: "missing" });
  recordSearchLog(
    "warn",
    "grab_episode.stale_search_restored",
    `${fresh.title} S${seasonNumber}E${String(episodeNumber).padStart(2, "0")} — remis à "manquant" (statut "recherche" laissé par une erreur en cours de recherche)`
  );
}

/**
 * Search for a whole-season pack and send it to the engine if one clears the
 * quality profile. Shared by every series search path so "pack first" is
 * consistent whether triggered manually, by the catch-up task, or by RSS.
 * `missingEpisodeNumbers` restricts what the engine actually downloads from
 * the pack to just those episodes (see selectEpisodeFiles in instance.mjs) —
 * without it, every file in the pack gets pulled even when only one or two
 * episodes of the season were actually missing.
 */
async function tryGrabSeasonPackImpl(
  series: LibrarySeries,
  seasonNumber: number,
  profile: ReturnType<typeof profileFor>,
  missingEpisodeNumbers: number[]
) {
  const packResult = await grabRelease(series, seasonNumber, undefined, profile, true);
  if (!packResult.ok) return null;
  // A season-split release (single-season series, DVD ordering — e.g. a
  // "S02" pack of Disjointed covering S1E11-20) carries files named after
  // the release's OWN season/part numbering. The engine matches files
  // against episodeTargets by parsed filename, so targets must be sent in
  // the release's numbering ({ season: part, episode: k } for season
  // episode (part-1)*partSize + k) or no file would be selected. Targets
  // outside the part's episode range are dropped — the episodes they cover
  // aren't in this release; the import side maps the kept files back to the
  // season's own numbering (see normalizePartFiles in applyImportedFiles).
  const partPack = partPackInfo(series, parseRelease(packResult.release.title));
  const episodeTargets = partPack
    ? missingEpisodeNumbers
        .map((episode) => ({ season: partPack.partNumber, episode: episode - (partPack.partNumber - 1) * partPack.partSize }))
        .filter((t) => t.episode >= 1 && t.episode <= partPack.partSize)
    : missingEpisodeNumbers.map((episode) => ({ season: seasonNumber, episode }));
  const sent = await sendToEngine(
    packResult.release,
    "series",
    encodeLibraryRef({ kind: "season", seriesId: series.id, season: seasonNumber }),
    series.title,
    undefined,
    episodeTargets
  );
  if (!("ok" in sent)) return null;
  // Placed here (the deduped Impl function), not at each of the several
  // callers below — season/episode counts are only correct at the moment
  // of the actual grab, and this fires exactly once per real grab even
  // though multiple callers can race for the same season (they share this
  // same in-flight promise). Season-pack and intégrale grabs previously had
  // no notification kind at all, unlike single-episode grabs — see
  // grab_season/grab_series in NotificationKind.
  emitNotification(
    "grab_season",
    `${series.title} — Saison ${seasonNumber} récupérée (${missingEpisodeNumbers.length} ép.)`,
    `/title/series/${series.tmdbId}`,
    { title: series.title, season: seasonNumber, count: missingEpisodeNumbers.length }
  );
  return { release: packResult.release, torrent: sent.torrent };
}

/**
 * Serializes every search that touches one series or movie across the whole
 * process. Bulk "search all missing", scheduled retries and manual buttons
 * all run as separate queue jobs with up to MAX_CONCURRENT in flight, so
 * without this two jobs can process the same series at the same time — each
 * running its own intégrale/season-pack search chain (measured live: 3
 * identical complete-series searches of one show at once, each 12+ HTTP
 * requests per indexer). Later callers wait for the earlier one, then
 * re-read fresh state: by then the first pass has usually grabbed
 * everything, so they fall out through the "nothing missing anymore" early
 * returns instead of re-searching.
 *
 * Anchored on globalThis (AGENTS.md rule) — Next.js bundles API routes
 * separately, so a module-level Map wouldn't be shared between the route
 * bundle and the scheduler bundle. Shared with the import callback path
 * (see locks.ts) so a completed-episode import never races a concurrent
 * search on the same series.
 */
export function withSearchLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  return withKeyLock(key, fn);
}

/**
 * Two missing episodes of the same season searched around the same time
 * (e.g. one click per episode, or a single click racing the bulk "search
 * missing" job) would otherwise each run their own indexer search and grab
 * the same season pack twice — two separate torrents of the identical
 * content. In-flight calls for the same series+season share one promise
 * instead: the second caller waits for the first's result and reuses it
 * rather than starting a redundant grab.
 *
 * Anchored on globalThis (AGENTS.md rule) — Next.js bundles API routes
 * separately, so a module-level Map wouldn't be shared between the route
 * bundle and the scheduler bundle.
 */
const gAutoGrab = globalThis as typeof globalThis & {
  __movvizSeasonPackInFlight?: Map<string, ReturnType<typeof tryGrabSeasonPackImpl>>;
  __movvizSeriesPackInFlight?: Map<string, ReturnType<typeof tryGrabSeriesPackImpl>>;
};

function seasonPackInFlight() {
  return (gAutoGrab.__movvizSeasonPackInFlight ??= new Map());
}

function tryGrabSeasonPack(
  series: LibrarySeries,
  seasonNumber: number,
  profile: ReturnType<typeof profileFor>,
  missingEpisodeNumbers: number[]
) {
  const key = `${series.id}-${seasonNumber}`;
  const existing = seasonPackInFlight().get(key);
  if (existing) return existing;
  const p = tryGrabSeasonPackImpl(series, seasonNumber, profile, missingEpisodeNumbers).finally(() => {
    seasonPackInFlight().delete(key);
  });
  seasonPackInFlight().set(key, p);
  return p;
}

/**
 * Try to grab the whole season as one pack; if no pack release clears the
 * quality profile, fall back to searching each missing episode individually.
 * `skipSeriesPackRetry` — set by searchAndGrabSeries once a complete-series
 * pack has already been searched for and failed earlier in the same run, so
 * later seasons don't repeat that identical, series-wide (not season-specific)
 * search.
 */
export async function searchAndGrabSeason(
  seriesId: string,
  seasonNumber: number,
  options?: { skipSeriesPackRetry?: boolean; shouldCancel?: () => boolean }
) {
  const series = getSeries(seriesId);
  if (!series) return { error: "series not found" as const };
  const season = series.seasons.find((s) => s.seasonNumber === seasonNumber);
  if (!season) return { error: "season not found" as const };
  const profile = profileFor(series.qualityProfileId);

  const missing = season.episodes.filter((e) => e.monitored && e.status === "missing");
  if (missing.length === 0) return { ok: true as const, skipped: "nothing missing" };

  setEpisodesStatus(series, seasonNumber, missing.map((e) => e.episodeNumber), { status: "searching" });

  // try/finally safety net — same contract as searchAndGrabEpisode: the
  // season-wide flip must come back to "missing" no matter what throws
  // inside the cascade (the per-episode fallback restores each episode it
  // touches, but any exception before that would leave the whole season
  // stuck on "searching" — see restoreStaleSeasonSearch).
  try {
    return await searchAndGrabSeasonCascade(series, seriesId, seasonNumber, profile, missing, options);
  } finally {
    restoreStaleSeasonSearch(seriesId, seasonNumber, missing.map((e) => e.episodeNumber));
  }
}

/**
 * The actual search cascade of searchAndGrabSeason, extracted so the
 * season-wide "searching" flip above is always protected by the finally —
 * see restoreStaleSeasonSearch.
 */
async function searchAndGrabSeasonCascade(
  series: LibrarySeries,
  seriesId: string,
  seasonNumber: number,
  profile: ReturnType<typeof profileFor>,
  missing: LibraryEpisode[],
  options?: { skipSeriesPackRetry?: boolean; shouldCancel?: () => boolean }
) {
  // RÈGLE ABSOLUE — intégrale d'abord : si elle existe, elle couvre toute la
  // série d'un coup. Skipped when a prior season in this same searchAndGrabSeries
  // run already searched for this exact pack and found nothing — whether a
  // complete-series pack exists can't change between one season and the next
  // in the same run, so re-searching it per season (measured live: 6
  // identical, empty direct searches for one 8-season show) is pure wasted
  // indexer load.
  if (!options?.skipSeriesPackRetry) {
    const seriesPack = await tryGrabSeriesPack(series, profile);
    if (seriesPack) {
      setMultiSeasonEpisodesStatus(series, groupTargetsBySeason(seriesPack.targets), { status: "downloading", activeInfoHash: seriesPack.torrent.infoHash });
      void notifySeerrProcessingOnce("series", series.tmdbId).catch(() => {});
      logActivity("grabbed", "system", `${series.title} — intégrale (${seriesPack.targets.length} ép.)`, `/title/series/${series.tmdbId}`, {
        libraryRef: encodeLibraryRef({ kind: "series", seriesId }),
        releaseTitle: seriesPack.release.title,
        indexer: seriesPack.release.indexerId,
        infoHash: seriesPack.torrent.infoHash,
      });
      logSeriesGrabV2(
        series,
        "series",
        seriesPack.release,
        seriesPack.targets.length,
        new Set(seriesPack.targets.map((t) => t.season)).size
      );
      return { ok: true as const, mode: "series_pack" as const, release: seriesPack.release, torrent: seriesPack.torrent };
    }

    // Real pause before the next fallback stage — confirmed live as still
    // necessary even with the per-item pacing above: one series with no cache
    // hit chains series-pack, season-pack, then per-episode attempts, each
    // querying every configured indexer in parallel with no gap between
    // stages. That's several near-simultaneous request bursts for a SINGLE
    // series, which alone was enough to trip an indexer's rate limit (a
    // second series barely added to it before the 429 hit).
    await new Promise<void>((resolve) => setTimeout(resolve, ITEM_DELAY_MS));
  }

  // Pas d'intégrale — le pack de saison, qui amène aussi tous les autres
  // épisodes manquants de la saison.
  const pack = await tryGrabSeasonPack(series, seasonNumber, profile, missing.map((e) => e.episodeNumber));
  if (pack) {
    setEpisodesStatus(series, seasonNumber, missing.map((e) => e.episodeNumber), {
      status: "downloading",
      activeInfoHash: pack.torrent.infoHash,
    });
    void notifySeerrProcessingOnce("series", series.tmdbId).catch(() => {});
    logActivity("grabbed", "system", `${series.title} — saison ${seasonNumber}`, `/title/series/${series.tmdbId}`, {
      libraryRef: encodeLibraryRef({ kind: "season", seriesId, season: seasonNumber }),
      releaseTitle: pack.release.title,
      indexer: pack.release.indexerId,
      infoHash: pack.torrent.infoHash,
    });
    logSeriesGrabV2(series, "season", pack.release, missing.length, 1, seasonNumber);
    return { ok: true as const, mode: "pack" as const, release: pack.release, torrent: pack.torrent };
  }

  // Real pause before moving to the per-episode fallback stage.
  await new Promise<void>((resolve) => setTimeout(resolve, ITEM_DELAY_MS));

  // Ni intégrale ni pack de saison — les épisodes un par un. skipPackRetry:
  // true since the season pack and series pack were both just searched for,
  // right above, for this exact season — re-searching either one again for
  // every single missing episode found nothing new (same cache, same indexer
  // availability) while multiplying both the request count and the pacing
  // delays by 3x per episode. Confirmed live: a show with dozens of missing
  // episodes took hours under that redundancy.
  const perEpisode = [];
  for (const ep of missing) {
    // Cancellation checkpoint between episodes — see searchAndGrabSeries's
    // season loop. Remaining episodes stay "missing" (restored by the
    // finally in searchAndGrabSeason) and are retried on a later run.
    if (options?.shouldCancel?.()) break;
    perEpisode.push(await searchAndGrabEpisode(seriesId, seasonNumber, ep.episodeNumber, { skipPackRetry: true }));
    await new Promise<void>((resolve) => setTimeout(resolve, ITEM_DELAY_MS));
  }
  return { ok: true as const, mode: "per_episode" as const, results: perEpisode };
}

/**
 * try/finally safety net for the season-wide "searching" flip — restores
 * every episode of the season that is still "searching" (i.e. not grabbed,
 * not restored by the per-episode fallback) when the cascade threw.
 */
function restoreStaleSeasonSearch(seriesId: string, seasonNumber: number, episodeNumbers: number[]) {
  const fresh = getSeries(seriesId);
  if (!fresh) return;
  const stillSearching = fresh.seasons
    .find((s) => s.seasonNumber === seasonNumber)
    ?.episodes.filter((e) => episodeNumbers.includes(e.episodeNumber) && e.status === "searching");
  if (!stillSearching || stillSearching.length === 0) return;
  setEpisodesStatus(fresh, seasonNumber, stillSearching.map((e) => e.episodeNumber), { status: "missing" });
  recordSearchLog(
    "warn",
    "grab_season.stale_search_restored",
    `${fresh.title} — saison ${seasonNumber} : ${stillSearching.length} épisode(s) remis à "manquant" (statut "recherche" laissé par une erreur en cours de recherche)`
  );
}

/**
 * Collect every { season, episode } that is monitored + missing across the
 * entire series — used when a complete-series pack is grabbed so the engine
 * knows which files to select. "searching" episodes are included: a season
 * search flips its whole season to "searching" BEFORE the series pack is
 * attempted, so excluding them would silently drop the current season from
 * the engine's file selection.
 */
function collectMissingTargets(series: LibrarySeries): { season: number; episode: number }[] {
  const targets: { season: number; episode: number }[] = [];
  for (const season of series.seasons) {
    if (!season.monitored) continue;
    for (const ep of season.episodes) {
      if (ep.monitored && (ep.status === "missing" || ep.status === "searching")) targets.push({ season: season.seasonNumber, episode: ep.episodeNumber });
    }
  }
  return targets;
}

const COMPLETE_SERIES_TERMS_RE = new RegExp(
  `\\b(${COMPLETE_SERIES_TERMS.map((t) => t.replace(/\s+/g, "[.\\s]+")).join("|")})\\b`,
  "i"
);
const SEASON_RANGE_RE = /\bS(?:easons?|aison)?\.?\s?0?(\d{1,3})\s*[-–toà]+\s*S?(?:aison)?\.?\s?0?(\d{1,3})\b/i;

/**
 * Extract the season range from a release title (e.g. "S01 à S28" → {lo: 1, hi: 28}).
 * Returns null if no season range is found.
 */
export function extractSeasonRange(rawTitle: string): { lo: number; hi: number } | null {
  const range = rawTitle.match(SEASON_RANGE_RE);
  if (!range) return null;
  const lo = parseInt(range[1], 10);
  const hi = parseInt(range[2], 10);
  if (hi <= lo) return null;
  return { lo, hi };
}

/**
 * A release found by title alone can be anything matching that title — a
 * single episode, a single season pack, or the real complete-series pack
 * this function is looking for. Nothing else here checks that distinction
 * (parseRelease has no season-range awareness), so without this a single
 * season 6 episode can win as "the complete series pack" and get grabbed to
 * cover a completely different season's missing episode — confirmed live:
 * American Horror Story's S13E01 target got matched to, and downloaded as,
 * a plain "American.Horror.Story.S06..." release.
 *
 * Detection rules (mission: the NAME is the primary signal, backed by an
 * exhaustive keyword list — see COMPLETE_SERIES_TERMS in torznab.ts):
 *  - a release carries an explicit pack marker ("Complete", "Intégrale",
 *    "Saisons complètes", … in any of ~10 languages) → intégrale candidate;
 *  - or a season range ("S01-S13") covering essentially the whole show;
 *  - BUT a release with an explicit single-season episode marker
 *    (S01E01-S01E24, S04E01-E24 — i.e. `parsed.episode != null`) is a
 *    SEASON pack, never an intégrale, even when it carries a "Complete"
 *    tag (that tag refers to the season being complete, not the show).
 *
 * When targetSeasons is provided, the pack must also cover at least one of
 * the requested seasons — prevents "Intégrale S01-S28" from being grabbed
 * for a Season 29 search (the range doesn't include S29).
 */
export function isCompleteSeriesPackTitle(
  rawTitle: string,
  seasonCount: number,
  targetSeasons?: number[],
  parsedEpisode?: number | null,
  parsedSeason?: number | null
): boolean {
  const range = extractSeasonRange(rawTitle);
  const hasTerm = COMPLETE_SERIES_TERMS_RE.test(rawTitle);

  if (!hasTerm && !range) return false;

  // Un pack de saison taggé "Complete" (S01E01-S01E24) n'est pas une intégrale.
  if (!range && parsedEpisode != null) return false;

  // Un pack de SAISON taggé "Complete" sans plage couvrante ("Show.S03.Complete",
  // "Show.Complete.Season.1") n'est pas une intégrale non plus — le marqueur
  // "Complete" s'y réfère à la saison, pas à la série entière.
  if (!range && parsedSeason != null) return false;

  // If there's a season range, it must cover most of the show
  if (range) {
    const coversShow = range.hi > range.lo && range.hi - range.lo + 1 >= Math.max(2, seasonCount - 1);
    if (!coversShow) return false;
  }

  // If target seasons are specified, the pack must cover at least one of them
  if (targetSeasons && targetSeasons.length > 0) {
    if (!range) {
      // Pack detected by term only (e.g. "Intégrale") with no season range —
      // can't verify coverage, so allow it (the term implies completeness)
      return true;
    }
    return targetSeasons.some((s) => s >= range.lo && s <= range.hi);
  }

  return true;
}

/**
 * Try to grab a complete-series pack (single torrent with every season/episode
 * of the show). When found, sends it to the engine with episodeTargets so only
 * the missing episodes' files land on disk.
 *
 * Deduped in-flight (same contract as season packs): concurrent calls for the
 * same series share one promise so the same integral pack can't be grabbed
 * twice by racing runs (bulk search + scheduled task + manual button).
 * `seasonFilter` restricts the pack to the given seasons (used by bulk
 * searches respecting a season budget — the engine only selects those files).
 */
/**
 * Collects every complete-series-pack candidate for a series, from the RSS
 * cache first, falling back to a direct multi-indexer search when the cache
 * has nothing. This is the SINGLE source of truth for the integral search —
 * the auto-grab flow (tryGrabSeriesPackImpl) and the manual integral
 * selection popup both consume it, so what the popup offers is exactly what
 * the automatic search would have grabbed.
 */
export interface CompleteSeriesCandidate {
  release: IndexerRelease;
  parsed: ReleaseInfo;
}

// Regular scoring (resolution/HDR/codec/custom formats) rewards exactly the
// things that make an intégrale enormous — a 4K remux pack scores highest
// but can be 10x the size of a perfectly watchable 1080p WEB-DL of the same
// show. For a complete-series pack specifically, disk space matters far more
// than squeezing out extra quality points, so candidates are picked by
// smallest size first instead — but only among packs with enough seeders to
// actually finish downloading; a torrent with 0-1 seeders is a stall risk
// no matter how small it is, so those only get considered as a last resort
// (sorted by quality score, the old behavior) when nothing safer exists.
const MIN_SAFE_SEEDERS = 2;
// "balanced" (default, unchanged) keeps the raw-byte smallest-first pick
// described above. "smaller"/"quality" (opt-in, see releaseRules.ts's
// sizePreference) use codec-normalized size instead — so a 12GB x265 pack
// correctly beats a 20GB x264 one of the same real quality under "smaller",
// rather than losing to it on raw bytes as it would have before.
function compareCompletePackCandidates(
  a: CompleteSeriesCandidate,
  b: CompleteSeriesCandidate,
  sizePreference: ReleaseRules["sizePreference"] = "balanced"
): number {
  const aSafe = a.release.seeders == null || a.release.seeders >= MIN_SAFE_SEEDERS;
  const bSafe = b.release.seeders == null || b.release.seeders >= MIN_SAFE_SEEDERS;
  if (aSafe !== bSafe) return aSafe ? -1 : 1;
  if (aSafe) {
    if (sizePreference === "balanced") return a.release.size - b.release.size;
    const aSize = perceptualSizeBytes(a.release.size, a.parsed.videoCodec);
    const bSize = perceptualSizeBytes(b.release.size, b.parsed.videoCodec);
    return sizePreference === "smaller" ? aSize - bSize : bSize - aSize;
  }
  return b.release.score - a.release.score;
}

export async function searchCompleteSeriesCandidates(
  series: LibrarySeries,
  profile: ReturnType<typeof profileFor>,
  seasonFilter?: Set<number>
): Promise<{ candidates: CompleteSeriesCandidate[]; targets: { season: number; episode: number }[]; seasonCount: number; targetSeasons: number[] } | null> {
  const seasonCount = series.seasons.filter((s) => s.seasonNumber > 0 && s.monitored).length;
  const targets = collectMissingTargets(series).filter((t) => !seasonFilter || seasonFilter.has(t.season));
  if (targets.length === 0) return null;
  const targetSeasons = [...new Set(targets.map((t) => t.season))];
  // Same original-title preference as grabRelease: scene releases are named
  // after the original (usually English) title — a French title alone never
  // matches a pack release. The localized title stays as an alias.
  const searchTitle = series.originalTitle && series.originalTitle !== series.title ? series.originalTitle : series.title;
  const searchAliases = [
    ...(series.aliases ?? []),
    ...(series.originalTitle && series.originalTitle !== series.title ? [series.originalTitle] : []),
  ];

  const t0 = performance.now();
  const releases = searchFromCache(TV_CATEGORY_IDS);
  const cacheMs = Math.round(performance.now() - t0);
  const rules = loadReleaseRules();
  recordSearchLog("debug", "series_pack.cache_read", `${series.title} (${seasonCount} saisons) — cache RSS donne ${releases.length} release(s) (${cacheMs}ms)`, cacheMs);

  const tS = performance.now();
  const candidates: CompleteSeriesCandidate[] = releases
    .map((r) => ({ release: r, parsed: parseRelease(r.title) }))
    .filter(({ parsed }) => releaseTitleMatches(parsed.title, searchTitle, searchAliases))
    // A same-titled reboot/remake from a different year (e.g. Avatar: The
    // Last Airbender 2005 animated vs. 2024 live-action) has an identical
    // title — with no season/episode numbers to disambiguate an intégrale
    // (unlike a regular episode/season search), title similarity alone can
    // never tell them apart. yearIsCompatible is lenient (a release with no
    // year at all still passes) so this only rejects a release that states
    // a clearly different year, never a legitimately unlabeled one.
    .filter(({ parsed }) => yearIsCompatible(parsed.year, series.year))
    .filter(({ release, parsed }) => isCompleteSeriesPackTitle(release.title, seasonCount, targetSeasons, parsed.episode, parsed.season))
    // Decision Guard: a blocked term is a hard veto here — no score, however high, can rescue a release an admin explicitly forbade.
    .filter(({ release }) => !isBlockedForAutoGrab(release.title, rules, series.title).blocked)
    .filter(({ parsed }) => !parsed.resolution || profile.allowedResolutions.includes(parsed.resolution))
    .filter(({ release }) => release.score >= profile.minScore)
    .filter(({ release }) => withinSizeLimit(release.size, "series"))
    .filter(({ release }) => !isRecentlyFailedRelease(release.infoHash))
    .sort(compareCompletePackCandidates);
  const scoreMs = Math.round(performance.now() - tS);
  recordSearchLog("debug", "series_pack.scoring", `${series.title} — ${candidates.length} candidat(s) sur ${releases.length} brut(s) (${scoreMs}ms)`, scoreMs);

  if (candidates.length === 0) {
    const configuredIndexers = loadIndexers().filter((i) => i.enabled && i.protocol === "torrent");
    const indexers = withoutRateLimited(configuredIndexers);
    const alreadyLimited = configuredIndexers.length - indexers.length;
    if (indexers.length === 0) {
      recordSearchLog("warn", "series_pack.no_match", `${series.title} — aucun pack intégrale trouvé sur ${releases.length} bruts, aucun indexeur disponible : tous rate-limités (${alreadyLimited}/${configuredIndexers.length})`);
      return { candidates, targets, seasonCount, targetSeasons };
    }
    const tDirect = performance.now();
    recordSearchLog(
      "info",
      "series_pack.fallback_direct",
      `${series.title} — cache vide, recherche directe d'intégrale sur ${indexers.length} indexeur(s)` +
        (alreadyLimited > 0 ? ` (${alreadyLimited} exclu(s), déjà rate-limité(s))` : "")
    );
    // Sequential: un indexeur à la fois pour éviter les 429 en parallèle.
    const directReleases: IndexerRelease[] = [];
    for (const ix of indexers) {
      const results = await searchCompleteSeriesPack(ix, { title: searchTitle, seasonCount }, TV_CATEGORY_IDS).catch(() => [] as IndexerRelease[]);
      directReleases.push(...results);
    }
    const directMs = Math.round(performance.now() - tDirect);
    const newlyLimited = countNewlyRateLimited(indexers);
    recordSearchLog("info", "series_pack.fallback_result", `${series.title} — recherche directe: ${directReleases.length} release(s) (${directMs}ms)`, directMs);

    const directCandidates: CompleteSeriesCandidate[] = directReleases
      .map((r) => ({ release: r, parsed: parseRelease(r.title) }))
      .filter(({ parsed }) => releaseTitleMatches(parsed.title, searchTitle, searchAliases))
    // A same-titled reboot/remake from a different year (e.g. Avatar: The
    // Last Airbender 2005 animated vs. 2024 live-action) has an identical
    // title — with no season/episode numbers to disambiguate an intégrale
    // (unlike a regular episode/season search), title similarity alone can
    // never tell them apart. yearIsCompatible is lenient (a release with no
    // year at all still passes) so this only rejects a release that states
    // a clearly different year, never a legitimately unlabeled one.
    .filter(({ parsed }) => yearIsCompatible(parsed.year, series.year))
    .filter(({ release, parsed }) => isCompleteSeriesPackTitle(release.title, seasonCount, targetSeasons, parsed.episode, parsed.season))
    .filter(({ release }) => !isBlockedForAutoGrab(release.title, rules, series.title).blocked)
      .filter(({ parsed }) => !parsed.resolution || profile.allowedResolutions.includes(parsed.resolution))
      .filter(({ release }) => release.score >= profile.minScore)
      .filter(({ release }) => withinSizeLimit(release.size, "series"))
      .filter(({ release }) => !isRecentlyFailedRelease(release.infoHash))
      .sort(compareCompletePackCandidates);
    candidates.push(...directCandidates);

    if (directCandidates.length === 0) {
      if (newlyLimited > 0) {
        recordSearchLog("warn", "series_pack.fallback_rate_limited", `${series.title} — 0 résultat : ${newlyLimited} indexeur(s) ont répondu 429 (rate-limité) pendant cette recherche, pas forcément "rien trouvé"`);
      } else {
        recordSearchLog("warn", "series_pack.no_match", `${series.title} — 0 candidat (cache + recherche directe: ${releases.length + directReleases.length} bruts)`);
      }
      return { candidates, targets, seasonCount, targetSeasons };
    }
    recordSearchLog("info", "series_pack.fallback_match", `${series.title} — ${directCandidates.length} pack(s) via recherche directe, meilleur: "${directCandidates[0].release.title}" (score:${directCandidates[0].release.score}, indexeur:${directCandidates[0].release.indexerId})`);
  } else {
    recordSearchLog("info", "series_pack.match", `${series.title} — ${candidates.length} pack(s), meilleur: "${candidates[0].release.title}" (score:${candidates[0].release.score}, indexeur:${candidates[0].release.indexerId})`);
  }

  return { candidates, targets, seasonCount, targetSeasons };
}

async function tryGrabSeriesPackImpl(
  series: LibrarySeries,
  profile: ReturnType<typeof profileFor>,
  seasonFilter?: Set<number>
) {
  const found = await searchCompleteSeriesCandidates(series, profile, seasonFilter);
  if (!found || found.candidates.length === 0) return null;
  const { candidates, targets } = found;
  const top = candidates[0];

  recordDecision({
    refTitle: series.title,
    releaseTitle: top.release.title,
    decision: "accepted",
    reasons: top.release.scoreBreakdown?.length
      ? top.release.scoreBreakdown.map((b) => ({ type: "score", message: `${b.label} (${b.delta >= 0 ? "+" : ""}${b.delta})` }))
      : [{ type: "profile_match", message: "Correspond au profil de qualité" }],
  });

  const sent = await sendToEngine(
    top.release,
    "series",
    encodeLibraryRef({ kind: "series", seriesId: series.id }),
    series.title,
    undefined,
    targets
  );
  if (!("ok" in sent)) {
    const detail = "detail" in sent ? JSON.stringify(sent.detail) : sent.error;
    const hint = detail.includes("unauthorized") ? " — TOKEN MOTEUR INVALIDE : le moteur et le web doivent partager le même token (engine-token.json)" : "";
    recordSearchLog("error", "series_pack.engine_rejected", `${series.title} — "${top.release.title}" refusé par le moteur (${detail})${hint}`);
    return null;
  }
  recordSearchLog("info", "series_pack.grabbed", `${series.title} — "${top.release.title}" envoyé au moteur (${targets.length} ép. ciblés)`);
  // Same placement rationale as tryGrabSeasonPackImpl above — fires exactly
  // once per real grab, previously missing entirely for intégrale grabs.
  emitNotification(
    "grab_series",
    `${series.title} — intégrale récupérée (${targets.length} ép.)`,
    `/title/series/${series.tmdbId}`,
    { title: series.title, count: targets.length }
  );
  return { release: top.release, torrent: sent.torrent, targets };
}

/**
 * Deduped wrapper around tryGrabSeriesPackImpl — concurrent calls for the
 * same series share one promise (same contract as season packs), so a
 * complete-series pack can't be searched/grabbed twice by racing runs
 * (bulk "search missing" + scheduled tasks + manual buttons).
 */
type SeriesPackResult = {
  release: IndexerRelease;
  torrent: { infoHash: string };
  targets: { season: number; episode: number }[];
};
function tryGrabSeriesPack(
  series: LibrarySeries,
  profile: ReturnType<typeof profileFor>,
  seasonFilter?: Set<number>
): Promise<SeriesPackResult | null> {
  const key = `${series.id}|${seasonFilter ? [...seasonFilter].sort((a, b) => a - b).join(",") : "*"}`;
  const existing = (gAutoGrab.__movvizSeriesPackInFlight ??= new Map()).get(key);
  if (existing) return existing as Promise<SeriesPackResult | null>;
  const p = tryGrabSeriesPackImpl(series, profile, seasonFilter).finally(() => {
    gAutoGrab.__movvizSeriesPackInFlight?.delete(key);
  });
  (gAutoGrab.__movvizSeriesPackInFlight ??= new Map()).set(key, p);
  return p;
}

/**
 * Search + grab a complete-series pack that covers every monitored season.
 * Falls back to searching per-season when no pack is found. Serialized per
 * series via withSearchLock, like every other series-level search entry
 * point.
 */
export async function searchAndGrabCompleteSeries(seriesId: string) {
  return withSearchLock(`series:${seriesId}`, async () => {
    const series = getSeries(seriesId);
    if (!series) return { error: "series not found" as const };
    const profile = profileFor(series.qualityProfileId);

    const targets = collectMissingTargets(series);
    if (targets.length === 0) return { ok: true as const, skipped: "nothing missing" };

    const seriesPack = await tryGrabSeriesPack(series, profile);
    if (seriesPack) {
      setMultiSeasonEpisodesStatus(series, groupTargetsBySeason(targets), { status: "downloading", activeInfoHash: seriesPack.torrent.infoHash });
      void notifySeerrProcessingOnce("series", series.tmdbId).catch(() => {});
      logActivity("grabbed", "system", `${series.title} — intégrale`, `/title/series/${series.tmdbId}`, {
        libraryRef: encodeLibraryRef({ kind: "series", seriesId }),
        releaseTitle: seriesPack.release.title,
        indexer: seriesPack.release.indexerId,
        infoHash: seriesPack.torrent.infoHash,
      });
      logSeriesGrabV2(
        series,
        "series",
        seriesPack.release,
        seriesPack.targets.length,
        new Set(seriesPack.targets.map((t) => t.season)).size
      );
      return { ok: true as const, mode: "series_pack" as const, release: seriesPack.release, torrent: seriesPack.torrent };
    }

    // No complete pack — search each season individually. skipSeriesPackRetry:
    // true — l'intégrale vient d'être épuisée au niveau série, chaque saison ne
    // doit pas la re-chercher (même cache, même réponse).
    // Real pause between seasons, same pacing as searchAndGrabSeries: the engine
    // needs a beat to start a grabbed pack before the next search chain fires.
    // Ordre chronologique imposé (S01 → S02 → …) : le store ne garantit pas
    // l'ordre du tableau, et la mission exige la progression dans l'ordre.
    const results = [];
    const orderedSeasons = [...series.seasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
    for (const season of orderedSeasons) {
      if (!season.monitored) continue;
      const missing = season.episodes.filter((e) => e.monitored && e.status === "missing");
      if (missing.length === 0) continue;
      await new Promise<void>((resolve) => setTimeout(resolve, ITEM_DELAY_MS));
      results.push(await searchAndGrabSeason(seriesId, season.seasonNumber, { skipSeriesPackRetry: true }));
    }
    return { ok: true as const, mode: "per_season" as const, results };
  });
}

/**
 * Search every monitored season that still has missing episodes — the "search
 * whole series" / "rechercher les manquants" action. RÈGLE ABSOLUE :
 * l'intégrale est cherchée en premier systématiquement (plus de seuil de
 * complétion) — si elle est trouvée, STOP ; sinon saison par saison, chaque
 * saison essayant intégrale(skip) → pack saison → épisodes.
 *
 * Serialized per series via withSearchLock: a bulk job and a scheduled
 * retry searching the same show at the same time would otherwise each run
 * their own full search chain (see withSearchLock's comment). The lock also
 * reports per-season progress through `onSeasonDone` so the bulk job's
 * counter advances season by season instead of freezing on 0/N during a
 * giant show.
 */
export async function searchAndGrabSeries(
  seriesId: string,
  options?: { onSeasonDone?: () => void; shouldCancel?: () => boolean }
) {
  return withSearchLock(`series:${seriesId}`, async () => {
    const series = getSeries(seriesId);
    if (!series) return { error: "series not found" as const };
    const profile = profileFor(series.qualityProfileId);

    const monitoredEpisodes = series.seasons.filter((s) => s.monitored).flatMap((s) => s.episodes.filter((e) => e.monitored));
    const missingCount = monitoredEpisodes.filter((e) => e.status === "missing").length;
    if (missingCount === 0) return { ok: true as const, results: [] };

    // Intégrale d'abord — couvre toute la série d'un coup quand elle existe.
    const seriesPack = await tryGrabSeriesPack(series, profile);
    if (seriesPack) {
      setMultiSeasonEpisodesStatus(series, groupTargetsBySeason(seriesPack.targets), { status: "downloading", activeInfoHash: seriesPack.torrent.infoHash });
      void notifySeerrProcessingOnce("series", series.tmdbId).catch(() => {});
      logActivity("grabbed", "system", `${series.title} — intégrale`, `/title/series/${series.tmdbId}`, {
        libraryRef: encodeLibraryRef({ kind: "series", seriesId }),
        releaseTitle: seriesPack.release.title,
        indexer: seriesPack.release.indexerId,
        infoHash: seriesPack.torrent.infoHash,
      });
      logSeriesGrabV2(
        series,
        "series",
        seriesPack.release,
        seriesPack.targets.length,
        new Set(seriesPack.targets.map((t) => t.season)).size
      );
      return { ok: true as const, mode: "series_pack" as const, release: seriesPack.release, torrent: seriesPack.torrent };
    }

    const results = [];
    // L'intégrale vient d'être épuisée pour ce run — toutes les saisons passent
    // skipSeriesPackRetry: true (la réponse ne peut pas changer entre deux
    // saisons dans le même run). Ordre chronologique imposé (S01 → S02 → …).
    const orderedSeasons = [...series.seasons].sort((a, b) => a.seasonNumber - b.seasonNumber);
    for (const season of orderedSeasons) {
      // Cooperative cancellation checkpoint — the bulk "rechercher les
      // manquants" job polls between series AND between seasons (see
      // searchMissing.ts runBatch / queue.ts requestCancelJob), so a cancel
      // lands within a season at worst.
      if (options?.shouldCancel?.()) break;
      if (!season.monitored) continue;
      if (!season.episodes.some((e) => e.monitored && e.status === "missing")) continue;
      const result = await searchAndGrabSeason(seriesId, season.seasonNumber, { skipSeriesPackRetry: true, shouldCancel: options?.shouldCancel });
      results.push(result);
      options?.onSeasonDone?.();
      // Each search synchronously title-matches against the whole RSS cache —
      // real CPU time on Node's single thread. A show missing many seasons
      // (e.g. 6+) would otherwise run that back-to-back with no gap, stalling
      // every other request on the server for the whole stretch. A real pause
      // (not just a same-tick yield) spreads that cost out in wall-clock time
      // instead of one sustained burst — see the matching comment in
      // searchMissing.ts's runBatch.
      await new Promise<void>((resolve) => setTimeout(resolve, ITEM_DELAY_MS));
    }
    return { ok: true as const, results };
  });
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Bidirectional status reconciliation against the air date — see
 * transitionUpcomingMovies in autoGrab.ts for the full rationale (same idea,
 * per-episode): "upcoming" → "missing" once aired, AND "missing" → "upcoming"
 * for any episode whose air date is still in the future, catching every
 * episode added before the "upcoming" status existed. The same shared
 * episodeStatus() rule also catches TBA placeholders with no date at all:
 * they flip to "upcoming" on the first pass and are never flipped back (an
 * undated TBA can never "air").
 */
export function transitionUpcomingEpisodes() {
  const transitioned: string[] = [];
  for (const series of loadSeries()) {
    let changed = false;
    const seasons = series.seasons.map((season) => {
      const episodes = season.episodes.map((ep) => {
        if (ep.status !== "upcoming" && ep.status !== "missing") return ep;
        const target = episodeStatus(ep.airDate, ep.title);
        if (ep.status === "upcoming" && target === "missing") {
          changed = true;
          transitioned.push(`${series.id}.${season.seasonNumber}.${ep.episodeNumber}`);
          return { ...ep, status: "missing" as const };
        }
        if (ep.status === "missing" && target === "upcoming") {
          changed = true;
          transitioned.push(`${series.id}.${season.seasonNumber}.${ep.episodeNumber}`);
          return { ...ep, status: "upcoming" as const };
        }
        return ep;
      });
      return { ...season, episodes };
    });
    if (changed) updateSeries(series.id, { seasons });
  }
  return { transitioned };
}

/**
 * Same idea as autoGrab.ts's searchReleasedMissingMovies — episodes stay
 * "missing" indefinitely once monitored, so this retries any monitored
 * episode whose air date has actually passed a few times a day, catching
 * releases that land on indexers a bit late. Bounded to 14 days so it
 * doesn't degrade into an unbounded retry of every old missing episode.
 */
export async function searchReleasedMissingEpisodes() {
  // Voie arrière-plan + cession à l'utilisateur : tâche planifiée, jamais
  // prioritaire sur une interaction utilisateur.
  return runBackground(() => searchReleasedMissingEpisodesInner());
}

async function searchReleasedMissingEpisodesInner() {
  const now = Date.now();
  const searched: string[] = [];

  // Group qualifying episodes by series — RÈGLE ABSOLUE : l'intégrale est
  // tentée UNE fois par série avant toute saison/épisode, puis chaque saison
  // est tentée comme pack, puis épisode par épisode.
  const bySeries = new Map<string, { series: LibrarySeries; seasons: Map<number, number[]> }>();
  for (const series of loadSeries()) {
    if (!series.monitored) continue;
    for (const season of series.seasons) {
      for (const ep of season.episodes) {
        if (!ep.monitored || ep.status !== "missing" || !ep.airDate) continue;
        const airedAt = new Date(ep.airDate).getTime();
        if (Number.isNaN(airedAt) || airedAt > now || now - airedAt > 14 * DAY_MS) continue;
        let entry = bySeries.get(series.id);
        if (!entry) {
          entry = { series, seasons: new Map() };
          bySeries.set(series.id, entry);
        }
        const list = entry.seasons.get(season.seasonNumber) ?? [];
        list.push(ep.episodeNumber);
        entry.seasons.set(season.seasonNumber, list);
      }
    }
  }

  for (const { series, seasons } of bySeries.values()) {
    await yieldToUser();
    await withSearchLock(`series:${series.id}`, async () => {
      // Re-derive from fresh state: an earlier pass on this series (bulk job,
      // manual button) may have grabbed some of it while we waited on the
      // lock — re-searching what it just grabbed would be pure wasted load.
      const current = stillMissingFromFresh(series.id, seasons);
      if (!current) return;
      const { series: fresh, seasons: freshSeasons } = current;
      const profile = profileFor(fresh.qualityProfileId);

      // 1. Intégrale d'abord — couvre toute la série d'un coup quand elle existe.
      const seriesPack = await tryGrabSeriesPack(fresh, profile);
      if (seriesPack) {
        setMultiSeasonEpisodesStatus(fresh, groupTargetsBySeason(seriesPack.targets), {
          status: "downloading",
          activeInfoHash: seriesPack.torrent.infoHash,
        });
        void notifySeerrProcessingOnce("series", fresh.tmdbId).catch(() => {});
        for (const [seasonNumber, episodeNumbers] of freshSeasons) {
          for (const episodeNumber of episodeNumbers) searched.push(`${fresh.id}.${seasonNumber}.${episodeNumber}`);
        }
        return;
      }

      // 2. Par saison : pack de saison d'abord, sinon épisode par épisode
      // (skipPackRetry — l'intégrale vient d'être épuisée pour cette série).
      for (const [seasonNumber, episodeNumbers] of freshSeasons) {
        const pack = await tryGrabSeasonPack(fresh, seasonNumber, profile, episodeNumbers);
        if (pack) {
          setEpisodesStatus(fresh, seasonNumber, episodeNumbers, {
            status: "downloading",
            activeInfoHash: pack.torrent.infoHash,
          });
          void notifySeerrProcessingOnce("series", fresh.tmdbId).catch(() => {});
          for (const episodeNumber of episodeNumbers) searched.push(`${fresh.id}.${seasonNumber}.${episodeNumber}`);
          continue;
        }
        for (const episodeNumber of episodeNumbers) {
          await searchAndGrabEpisode(fresh.id, seasonNumber, episodeNumber, { skipPackRetry: true });
          searched.push(`${fresh.id}.${seasonNumber}.${episodeNumber}`);
          await new Promise<void>((resolve) => setTimeout(resolve, ITEM_DELAY_MS));
        }
      }
    });
  }

  return { searched };
}

/**
 * Re-derives, from fresh store state, which of a previously collected
 * { season → episodes } budget are still monitored+missing — used inside
 * withSearchLock so a pass that waited behind another pass on the same
 * series never re-searches what the first pass already grabbed. Returns
 * null when nothing remains (the usual outcome after an earlier grab).
 */
function stillMissingFromFresh(
  seriesId: string,
  seasons: Map<number, number[]>
): { series: LibrarySeries; seasons: Map<number, number[]> } | null {
  const fresh = getSeries(seriesId);
  if (!fresh) return null;
  const result = new Map<number, number[]>();
  for (const [seasonNumber, episodeNumbers] of seasons) {
    const season = fresh.seasons.find((s) => s.seasonNumber === seasonNumber);
    const still = (season?.episodes ?? [])
      .filter((e) => episodeNumbers.includes(e.episodeNumber) && e.monitored && e.status === "missing")
      .map((e) => e.episodeNumber);
    if (still.length > 0) result.set(seasonNumber, still);
  }
  if (result.size === 0) return null;
  return { series: fresh, seasons: result };
}

/** True if `text` contains CJK characters (Japanese/Chinese kanji, hiragana, katakana). Used to detect when TVDB fell back to Japanese because no French title exists. */
export function hasCjkText(text: string): boolean {
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text);
}

/**
 * Searches every monitored missing episode/season, regardless of air date.
 * Enforces all quality profile rules. Limits batch to avoid hammering indexers.
 */
export async function searchMissingEpisodes(maxSeasons = 30) {
  // Voie arrière-plan + cession à l'utilisateur : bulk planifiée (relance
  // 6h), jamais prioritaire sur une interaction utilisateur. Le bulk MANUEL
  // passe par searchAllMissing (searchMissing.ts), en voie utilisateur.
  return runBackground(() => searchMissingEpisodesInner(maxSeasons));
}

async function searchMissingEpisodesInner(maxSeasons: number) {
  const searched: string[] = [];
  // Group by series — RÈGLE ABSOLUE : l'intégrale est tentée UNE fois par
  // série (limitée aux saisons du budget), avant toute saison/épisode.
  const bySeries = new Map<string, { series: LibrarySeries; seasons: Map<number, number[]> }>();
  let seasonCount = 0;

  for (const series of loadSeries()) {
    if (!series.monitored) continue;
    for (const season of series.seasons) {
      if (seasonCount >= maxSeasons) break;
      for (const ep of season.episodes) {
        if (ep.monitored && ep.status === "missing") {
          let entry = bySeries.get(series.id);
          if (!entry) {
            entry = { series, seasons: new Map() };
            bySeries.set(series.id, entry);
          }
          const list = entry.seasons.get(season.seasonNumber) ?? [];
          list.push(ep.episodeNumber);
          entry.seasons.set(season.seasonNumber, list);
        }
      }
      seasonCount++;
    }
  }

  // Randomize series order so the same shows don't get re-searched every pass.
  const entries = [...bySeries.values()];
  for (let i = entries.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [entries[i], entries[j]] = [entries[j], entries[i]];
  }

  for (const { series, seasons } of entries) {
    await yieldToUser();
    await withSearchLock(`series:${series.id}`, async () => {
      // Re-derive from fresh state: an earlier pass on this series (bulk job,
      // manual button) may have grabbed some of it while we waited on the
      // lock — re-searching what it just grabbed would be pure wasted load.
      const current = stillMissingFromFresh(series.id, seasons);
      if (!current) return;
      const { series: fresh, seasons: freshSeasons } = current;
      const profile = profileFor(fresh.qualityProfileId);

      // 1. Intégrale d'abord — limitée aux saisons du budget (seasonFilter) :
      //    l'engine ne sélectionne que les fichiers de ces saisons.
      const seasonFilter = new Set(freshSeasons.keys());
      const seriesPack = await tryGrabSeriesPack(fresh, profile, seasonFilter);
      if (seriesPack) {
        setMultiSeasonEpisodesStatus(fresh, groupTargetsBySeason(seriesPack.targets), {
          status: "downloading",
          activeInfoHash: seriesPack.torrent.infoHash,
        });
        void notifySeerrProcessingOnce("series", fresh.tmdbId).catch(() => {});
        for (const [seasonNumber, episodeNumbers] of freshSeasons) {
          for (const episodeNumber of episodeNumbers) searched.push(`${fresh.id}.${seasonNumber}.${episodeNumber}`);
        }
        return;
      }

      // 2. Par saison : pack de saison d'abord, sinon épisode par épisode
      //    (skipPackRetry — l'intégrale vient d'être épuisée pour cette série).
      for (const [seasonNumber, episodeNumbers] of freshSeasons) {
        const pack = await tryGrabSeasonPack(fresh, seasonNumber, profile, episodeNumbers);
        if (pack) {
          setEpisodesStatus(fresh, seasonNumber, episodeNumbers, {
            status: "downloading",
            activeInfoHash: pack.torrent.infoHash,
          });
          void notifySeerrProcessingOnce("series", fresh.tmdbId).catch(() => {});
          for (const episodeNumber of episodeNumbers) searched.push(`${fresh.id}.${seasonNumber}.${episodeNumber}`);
          continue;
        }
        for (const episodeNumber of episodeNumbers) {
          await searchAndGrabEpisode(fresh.id, seasonNumber, episodeNumber, { skipPackRetry: true });
          searched.push(`${fresh.id}.${seasonNumber}.${episodeNumber}`);
          await new Promise<void>((resolve) => setTimeout(resolve, ITEM_DELAY_MS));
        }
      }
    });
  }

  return { searched };
}
