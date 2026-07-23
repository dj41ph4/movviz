import fs from "node:fs";
import path from "node:path";
import { getSeries, getSeriesByTmdbId, addSeries, updateSeries, loadSeries } from "@/lib/library/store";
import { DEFAULT_QUALITY_PROFILES, defaultQualityProfile } from "@/lib/library/qualityProfiles";
import { encodeLibraryRef, type LibrarySeries, type LibrarySeason, type LibraryEpisode } from "@/lib/library/types";
import { searchFromCache } from "@/lib/indexers/rssCache";
import type { IndexerRelease } from "@/lib/indexers/types";
import { TV_CATEGORY_IDS } from "@/lib/indexers/categories";
import { parseRelease } from "@/lib/naming/parser";
import { releaseTitleMatches, seasonEpisodeMatches } from "@/lib/library/matching";
import { withinSizeLimit } from "@/lib/library/releaseRules";
import { buildGrabPayload } from "@/lib/indexers/grabPayload";
import { ENGINE_BASE, engineHeaders, ENGINE_TIMEOUT_MS } from "@/lib/engine/server";
import { getSeries as fetchTmdbSeries, getSeason as fetchTmdbSeason } from "@/lib/metadata/tmdb";
import { emitNotification } from "@/lib/notifications/store";
import { logActivity } from "@/lib/activity/store";
import { logActivityV2, createMediaRef, createFailureRef } from "@/lib/activity/v2/store";
import { getTvdbEpisodesFor, groupTvdbEpisodesBySeason, tvdbConfigured, type TvdbEpisode } from "@/lib/metadata/tvdb";
import { loadTvdbConfig } from "@/lib/metadata/tvdbStore";
import { isRecentlyFailedRelease } from "@/lib/library/failedReleases";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import { notifySeerrStatus } from "@/lib/seerr/mediaMap";
import { searchTv, searchCompleteSeriesPack, COMPLETE_SERIES_TERMS } from "@/lib/indexers/torznab";
import { loadIndexers } from "@/lib/indexers/store";
import { withoutRateLimited, countNewlyRateLimited } from "@/lib/indexers/rateLimit";

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

  const tvdbSeasons = groupTvdbEpisodesBySeason(tvdbEpisodes);
  if (tvdbSeasons.length <= tmdbSeasons.length) {
    // TVDB isn't more granular here — just patch titles/dates in place.
    applyTvdbTitleOverrides(tvdbEpisodes, tmdbSeasons);
    return tmdbSeasons;
  }

  return tvdbSeasons.map((s) => ({
    seasonNumber: s.seasonNumber,
    name: `Saison ${s.seasonNumber}`,
    monitored: true,
    episodes: s.episodes.map((e) => ({
      seasonNumber: e.seasonNumber,
      episodeNumber: e.episodeNumber,
      title: e.title && !hasCjkText(e.title) ? e.title : `Épisode ${e.episodeNumber}`,
      airDate: e.airDate,
      monitored: true,
      status: "missing",
      file: null,
      activeInfoHash: null,
      plexRatingKey: null,
    })),
  }));
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
    // Match "Saison 1", "Season 01", "S01", "Saison 1 - Nom", etc.
    const sm = entry.name.match(/S(?:aison)?[. _-]?(\d{1,2})/i);
    if (!sm) continue;
    const seasonNumber = parseInt(sm[1], 10);
    if (seasonNumber < 1) continue;

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
  | { ok: false; error: "not_found" | "no_tvdb_match" | "not_more_granular" | "active_downloads" | "no_disk_seasons" };

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
          title: (tvdb?.title && !hasCjkText(tvdb.title)) || !existingTitle || hasCjkText(existingTitle)
            ? (tvdb?.title ?? `Épisode ${epN}`)
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
        name: `Saison ${ds.seasonNumber}`,
        monitored: true,
        episodes,
      });
    }

    updateSeries(seriesId, { seasons: newSeasons });
    return { ok: true, oldSeasonCount: series.seasons.length, newSeasonCount: newSeasons.length };
  }

  // ---- 5. Fallback: no disk data — compare TVDB vs TMDb directly ----
  if (tvdbEpisodes.length === 0) return { ok: false, error: diskSeasons.length === 0 && baseDir ? "no_disk_seasons" : "no_tvdb_match" };

  const tvdbSeasons = groupTvdbEpisodesBySeason(tvdbEpisodes);
  if (tvdbSeasons.length <= series.seasons.length) return { error: "not_more_granular", ok: false };

  const newSeasons: LibrarySeason[] = [];
  let cursor = 0;
  for (const s of tvdbSeasons) {
    const episodes: LibraryEpisode[] = s.episodes.map((e) => {
      const carried = oldFlat[cursor++];
      return {
        seasonNumber: e.seasonNumber,
        episodeNumber: e.episodeNumber,
        title: (e.title && !hasCjkText(e.title)) || !carried || hasCjkText(carried.title)
          ? e.title
          : carried.title,
        airDate: e.airDate,
        monitored: carried?.monitored ?? true,
        status: carried?.status ?? "missing",
        file: carried?.file ?? null,
        activeInfoHash: carried?.activeInfoHash ?? null,
        plexRatingKey: carried?.plexRatingKey ?? null,
      };
    });
    newSeasons.push({ seasonNumber: s.seasonNumber, name: `Saison ${s.seasonNumber}`, monitored: true, episodes });
  }

  updateSeries(seriesId, { seasons: newSeasons });
  return { ok: true, oldSeasonCount: series.seasons.length, newSeasonCount: newSeasons.length };
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

  const targetSeasons = (seasonNumbers?.length
    ? meta.seasons.filter((s) => seasonNumbers.includes(s.seasonNumber))
    : meta.seasons
  ).filter((s) => s.seasonNumber > 0);

  const seasons: LibrarySeason[] = [];
  for (const s of targetSeasons) {
    const detail = await fetchTmdbSeason(tmdbId, s.seasonNumber);
    const episodes: LibraryEpisode[] = (detail?.episodes ?? []).map((e) => ({
      seasonNumber: e.seasonNumber,
      episodeNumber: e.episodeNumber,
      title: e.title,
      airDate: e.airDate,
      monitored: true,
      status: "missing",
      file: null,
      activeInfoHash: null,
      plexRatingKey: null,
    }));
    seasons.push({ seasonNumber: s.seasonNumber, name: s.name, monitored: true, episodes });
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
  };
  addSeries(series);

  const searchResult = options?.skipSearch ? null : await searchAndGrabCompleteSeries(series.id);
  return { series, searchResult };
}

function profileFor(qualityProfileId: string) {
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

  const label = episodeNumber
    ? `${series.title} S${String(seasonNumber).padStart(2, "0")}E${String(episodeNumber).padStart(2, "0")}`
    : `${series.title} S${String(seasonNumber).padStart(2, "0")} (pack)`;

  recordSearchLog("debug", "grab_release.cache_read", `${label} — cache RSS donne ${releases.length} release(s) (${cacheMs}ms)`, cacheMs);

  const tS = performance.now();
  const step1 = releases.map((r) => ({ release: r, parsed: parseRelease(r.title) }));
  const step2 = step1.filter(({ parsed }) => releaseTitleMatches(parsed.title, series.title));
  const step3 = step2.filter(({ parsed }) => seasonEpisodeMatches(parsed, seasonNumber, filterPack ? null : episodeNumber));
  const step4 = step3.filter(({ parsed }) => (filterPack ? parsed.episode == null : true));
  const step5 = step4.filter(({ parsed }) => !parsed.resolution || profile.allowedResolutions.includes(parsed.resolution));
  const step6 = step5.filter(({ release }) => release.score >= profile.minScore);
  const step7 = step6.filter(({ release }) => withinSizeLimit(release.size, filterPack ? "season" : "episode"));
  const step8 = step7.filter(({ release }) => !isRecentlyFailedRelease(release.infoHash));
  const candidates = step8.sort((a, b) => b.release.score - a.release.score);
  const scoreMs = Math.round(performance.now() - tS);
  recordSearchLog("debug", "grab_release.scoring", `${label} — ${candidates.length} candidat(s) sur ${releases.length} brut(s) (${scoreMs}ms), titre:${step2.length}, saison:${step3.length}, pack:${step4.length}, résolution:${step5.length}, score:${step6.length}, taille:${step7.length}, échec:${step8.length}`, scoreMs);

  if (candidates.length > 0) {
    const top = candidates[0];
    recordSearchLog("info", "grab_release.match", `${label} — meilleur candidat: "${top.release.title}" (score:${top.release.score}, indexeur:${top.release.indexerId})`);
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
    const results = await searchTv(ix, { title: series.title, season: seasonNumber, episode: filterPack ? null : episodeNumber }, TV_CATEGORY_IDS).catch(() => [] as IndexerRelease[]);
    directReleases.push(...results);
  }
  const directMs = Math.round(performance.now() - tDirect);
  const newlyLimited = countNewlyRateLimited(indexers);
  recordSearchLog("info", "grab_release.fallback_result", `${label} — recherche directe: ${directReleases.length} release(s) (${directMs}ms)`, directMs);

  const dStep1 = directReleases.map((r) => ({ release: r, parsed: parseRelease(r.title) }));
  const dStep2 = dStep1.filter(({ parsed }) => releaseTitleMatches(parsed.title, series.title));
  const dStep3 = dStep2.filter(({ parsed }) => seasonEpisodeMatches(parsed, seasonNumber, filterPack ? null : episodeNumber));
  const dStep4 = dStep3.filter(({ parsed }) => (filterPack ? parsed.episode == null : true));
  const dStep5 = dStep4.filter(({ parsed }) => !parsed.resolution || profile.allowedResolutions.includes(parsed.resolution));
  const dStep6 = dStep5.filter(({ release }) => release.score >= profile.minScore);
  const dStep7 = dStep6.filter(({ release }) => withinSizeLimit(release.size, filterPack ? "season" : "episode"));
  const dStep8 = dStep7.filter(({ release }) => !isRecentlyFailedRelease(release.infoHash));
  const directCandidates = dStep8.sort((a, b) => b.release.score - a.release.score);

  const topDirect = directCandidates[0];
  if (!topDirect) {
    if (newlyLimited > 0) {
      recordSearchLog("warn", "grab_release.fallback_rate_limited", `${label} — 0 résultat : ${newlyLimited} indexeur(s) ont répondu 429 (rate-limité) pendant cette recherche, pas forcément "rien trouvé"`);
    } else {
      recordSearchLog("warn", "grab_release.no_match", `${label} — 0 candidat sur ${directReleases.length} directs (titre:${dStep2.length}, saison:${dStep3.length}, pack:${dStep4.length}, résolution:${dStep5.length}, score:${dStep6.length}, taille:${dStep7.length}, échec:${dStep8.length})`);
    }
    return { ok: false, error: "no_match", totalReleases: releases.length + directReleases.length };
  }
  recordSearchLog("info", "grab_release.fallback_match", `${label} — meilleur candidat via recherche directe: "${topDirect.release.title}" (score:${topDirect.release.score}, indexeur:${topDirect.release.indexerId})`);
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

  const single = await grabRelease(series, seasonNumber, episodeNumber, profile, false);
  if (single.ok) {
    const sent = await sendToEngine(
      single.release,
      "series",
      encodeLibraryRef({ kind: "episode", seriesId, season: seasonNumber, episode: episodeNumber }),
      series.title
    );
    if ("error" in sent) {
      setEpisodeStatus(series, seasonNumber, episodeNumber, { status: "missing" });
      logActivityV2({ kind: "failed", media, actor: "system", failure: createFailureRef("download_failed", "Le moteur de téléchargement a refusé ou n'a pas pu joindre cette release.") });
      return sent;
    }
    setEpisodeStatus(series, seasonNumber, episodeNumber, { status: "downloading", activeInfoHash: sent.torrent.infoHash });
    void notifySeerrStatus("series", series.tmdbId, "processing").catch(() => {});
    logActivity("grabbed", "system", `${series.title} — ${seasonNumber}x${String(episodeNumber).padStart(2, "0")}`, `/title/series/${series.tmdbId}`, {
      libraryRef: encodeLibraryRef({ kind: "episode", seriesId, season: seasonNumber, episode: episodeNumber }),
      releaseTitle: single.release.title,
      indexer: single.release.indexerId,
      infoHash: sent.torrent.infoHash,
    });
    emitNotification(
      "grab_episode",
      `${series.title} — ${seasonNumber}x${String(episodeNumber).padStart(2, "0")} récupéré`,
      `/title/series/${series.tmdbId}`,
      { title: series.title, code: `${seasonNumber}x${String(episodeNumber).padStart(2, "0")}` }
    );
    return { ok: true as const, release: single.release, torrent: sent.torrent };
  }

  // When called from searchAndGrabSeason's per-episode loop, the season and
  // series pack were already searched for ONCE, right before that loop
  // started, and came up empty — nothing about the cache or indexer
  // availability changes between one episode and the next, so redoing both
  // searches again for every single missing episode is pure waste. Measured
  // live on shows with 40-75+ missing episodes and no pack (old sitcoms):
  // this redundancy, combined with the pacing pauses below (needed for
  // direct calls, where this IS the first attempt), turned a single show
  // into hours of repeated, guaranteed-empty searches. Skipped here; still
  // run for a standalone single-episode search (skipPackRetry unset).
  if (options?.skipPackRetry) {
    setEpisodeStatus(series, seasonNumber, episodeNumber, { status: "missing" });
    logActivityV2({
      kind: "failed",
      media,
      actor: "system",
      failure: createFailureRef(
        single.error === "no_indexers" ? "no_indexers" : "no_release_found",
        `Aucune release exploitable trouvée pour cet épisode (pack de saison et intégrale déjà écartés pour cette série). ${describeGrabFailure(single)}`
      ),
    });
    return single;
  }

  // Same real pause between fallback stages as searchAndGrabSeason — this
  // function has its own 3-stage cascade (episode, then season pack, then
  // series pack) that was equally unpaced.
  await new Promise<void>((resolve) => setTimeout(resolve, ITEM_DELAY_MS));

  // No standalone release — a season pack is worth grabbing every other
  // missing episode of the season from too.
  const pack = await tryGrabSeasonPack(series, seasonNumber, profile, missingEpisodeNumbers);
  if (pack) {
    setEpisodesStatus(series, seasonNumber, missingEpisodeNumbers, { status: "downloading", activeInfoHash: pack.torrent.infoHash });
    void notifySeerrStatus("series", series.tmdbId, "processing").catch(() => {});
    logActivity("grabbed", "system", `${series.title} — saison ${seasonNumber} (${missingEpisodeNumbers.length} ép., via ${seasonNumber}x${String(episodeNumber).padStart(2, "0")})`, `/title/series/${series.tmdbId}`, {
      libraryRef: encodeLibraryRef({ kind: "episode", seriesId, season: seasonNumber, episode: episodeNumber }),
      releaseTitle: pack.release.title,
      indexer: pack.release.indexerId,
      infoHash: pack.torrent.infoHash,
    });
    return { ok: true as const, release: pack.release, torrent: pack.torrent };
  }

  await new Promise<void>((resolve) => setTimeout(resolve, ITEM_DELAY_MS));

  // No season pack either — try a complete-series pack, extracting every
  // missing episode across the whole show while it's being pulled anyway.
  const seriesPack = await tryGrabSeriesPack(series, profile);
  if (seriesPack) {
    setMultiSeasonEpisodesStatus(series, groupTargetsBySeason(seriesPack.targets), { status: "downloading", activeInfoHash: seriesPack.torrent.infoHash });
    void notifySeerrStatus("series", series.tmdbId, "processing").catch(() => {});
    logActivity("grabbed", "system", `${series.title} — ${seasonNumber}x${String(episodeNumber).padStart(2, "0")} (via intégrale)`, `/title/series/${series.tmdbId}`, {
      libraryRef: encodeLibraryRef({ kind: "episode", seriesId, season: seasonNumber, episode: episodeNumber }),
      releaseTitle: seriesPack.release.title,
      indexer: seriesPack.release.indexerId,
      infoHash: seriesPack.torrent.infoHash,
    });
    return { ok: true as const, release: seriesPack.release, torrent: seriesPack.torrent };
  }

  setEpisodeStatus(series, seasonNumber, episodeNumber, { status: "missing" });
  logActivityV2({
    kind: "failed",
    media,
    actor: "system",
    failure: createFailureRef(
      single.error === "no_indexers" ? "no_indexers" : "no_release_found",
      `Aucune release exploitable trouvée, ni pour l'épisode seul, ni pour un pack de saison ou une intégrale. ${describeGrabFailure(single)}`
    ),
  });
  return single;
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
  const episodeTargets = missingEpisodeNumbers.map((episode) => ({ season: seasonNumber, episode }));
  const sent = await sendToEngine(
    packResult.release,
    "series",
    encodeLibraryRef({ kind: "season", seriesId: series.id, season: seasonNumber }),
    series.title,
    undefined,
    episodeTargets
  );
  if (!("ok" in sent)) return null;
  return { release: packResult.release, torrent: sent.torrent };
}

/**
 * Two missing episodes of the same season searched around the same time
 * (e.g. one click per episode, or a single click racing the bulk "search
 * missing" job) would otherwise each run their own indexer search and grab
 * the same season pack twice — two separate torrents of the identical
 * content. In-flight calls for the same series+season share one promise
 * instead: the second caller waits for the first's result and reuses it
 * rather than starting a redundant grab.
 */
const seasonPackInFlight = new Map<string, ReturnType<typeof tryGrabSeasonPackImpl>>();

function tryGrabSeasonPack(
  series: LibrarySeries,
  seasonNumber: number,
  profile: ReturnType<typeof profileFor>,
  missingEpisodeNumbers: number[]
) {
  const key = `${series.id}-${seasonNumber}`;
  const existing = seasonPackInFlight.get(key);
  if (existing) return existing;
  const p = tryGrabSeasonPackImpl(series, seasonNumber, profile, missingEpisodeNumbers).finally(() => {
    seasonPackInFlight.delete(key);
  });
  seasonPackInFlight.set(key, p);
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
  options?: { skipSeriesPackRetry?: boolean }
) {
  const series = getSeries(seriesId);
  if (!series) return { error: "series not found" as const };
  const season = series.seasons.find((s) => s.seasonNumber === seasonNumber);
  if (!season) return { error: "season not found" as const };
  const profile = profileFor(series.qualityProfileId);

  const missing = season.episodes.filter((e) => e.monitored && e.status === "missing");
  if (missing.length === 0) return { ok: true as const, skipped: "nothing missing" };

  setEpisodesStatus(series, seasonNumber, missing.map((e) => e.episodeNumber), { status: "searching" });

  const pack = await tryGrabSeasonPack(series, seasonNumber, profile, missing.map((e) => e.episodeNumber));
  if (pack) {
    setEpisodesStatus(series, seasonNumber, missing.map((e) => e.episodeNumber), {
      status: "downloading",
      activeInfoHash: pack.torrent.infoHash,
    });
    void notifySeerrStatus("series", series.tmdbId, "processing").catch(() => {});
    logActivity("grabbed", "system", `${series.title} — saison ${seasonNumber}`, `/title/series/${series.tmdbId}`, {
      libraryRef: encodeLibraryRef({ kind: "season", seriesId, season: seasonNumber }),
      releaseTitle: pack.release.title,
      indexer: pack.release.indexerId,
      infoHash: pack.torrent.infoHash,
    });
    return { ok: true as const, mode: "pack" as const, release: pack.release, torrent: pack.torrent };
  }

  // Real pause before the next fallback stage — confirmed live as still
  // necessary even with the per-item pacing above: one series with no cache
  // hit chains season-pack, series-pack, then per-episode attempts, each
  // querying every configured indexer in parallel with no gap between
  // stages. That's several near-simultaneous request bursts for a SINGLE
  // series, which alone was enough to trip an indexer's rate limit (a
  // second series barely added to it before the 429 hit).
  await new Promise<void>((resolve) => setTimeout(resolve, ITEM_DELAY_MS));

  // No season pack — try to find a complete-series pack and extract this
  // season from it. Only the targeted episodes' files get selected. Skipped
  // when a prior season in this same searchAndGrabSeries run already searched
  // for this exact pack and found nothing — whether a complete-series pack
  // exists can't change between one season and the next in the same run, so
  // re-searching it per season (measured live: 6 identical, empty direct
  // searches for one 8-season show) is pure wasted indexer load.
  if (!options?.skipSeriesPackRetry) {
    const seriesPack = await tryGrabSeriesPack(series, profile);
    if (seriesPack) {
      setEpisodesStatus(series, seasonNumber, missing.map((e) => e.episodeNumber), {
        status: "downloading",
        activeInfoHash: seriesPack.torrent.infoHash,
      });
      void notifySeerrStatus("series", series.tmdbId, "processing").catch(() => {});
      logActivity("grabbed", "system", `${series.title} — saison ${seasonNumber} (via intégrale)`, `/title/series/${series.tmdbId}`, {
        libraryRef: encodeLibraryRef({ kind: "season", seriesId, season: seasonNumber }),
        releaseTitle: seriesPack.release.title,
        indexer: seriesPack.release.indexerId,
        infoHash: seriesPack.torrent.infoHash,
      });
      return { ok: true as const, mode: "series_pack" as const, release: seriesPack.release, torrent: seriesPack.torrent };
    }

    // Same real pause before moving to the per-episode fallback stage.
    await new Promise<void>((resolve) => setTimeout(resolve, ITEM_DELAY_MS));
  }

  // No pack at all — grab episodes one at a time. skipPackRetry: true since
  // the season pack and series pack were both just searched for, right
  // above, for this exact season — re-searching either one again for every
  // single missing episode found nothing new (same cache, same indexer
  // availability) while multiplying both the request count and the pacing
  // delays by 3x per episode. Confirmed live: a show with dozens of missing
  // episodes took hours under that redundancy.
  const perEpisode = [];
  for (const ep of missing) {
    perEpisode.push(await searchAndGrabEpisode(seriesId, seasonNumber, ep.episodeNumber, { skipPackRetry: true }));
    await new Promise<void>((resolve) => setTimeout(resolve, ITEM_DELAY_MS));
  }
  return { ok: true as const, mode: "per_episode" as const, results: perEpisode };
}

/**
 * Collect every { season, episode } that is monitored + missing across the
 * entire series — used when a complete-series pack is grabbed so the engine
 * knows which files to select.
 */
function collectMissingTargets(series: LibrarySeries): { season: number; episode: number }[] {
  const targets: { season: number; episode: number }[] = [];
  for (const season of series.seasons) {
    if (!season.monitored) continue;
    for (const ep of season.episodes) {
      if (ep.monitored && ep.status === "missing") targets.push({ season: season.seasonNumber, episode: ep.episodeNumber });
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
function extractSeasonRange(rawTitle: string): { lo: number; hi: number } | null {
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
 * a plain "American.Horror.Story.S06..." release. Requires either an
 * explicit pack marker ("Complete", "Intégrale"...) or a season range
 * ("S01-S13") covering essentially the whole show.
 *
 * When targetSeasons is provided, the pack must also cover at least one of
 * the requested seasons — prevents "Intégrale S01-S28" from being grabbed
 * for a Season 29 search (the range doesn't include S29).
 */
function isCompleteSeriesPackTitle(rawTitle: string, seasonCount: number, targetSeasons?: number[]): boolean {
  const range = extractSeasonRange(rawTitle);
  const hasTerm = COMPLETE_SERIES_TERMS_RE.test(rawTitle);

  if (!hasTerm && !range) return false;

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
 */
async function tryGrabSeriesPack(series: LibrarySeries, profile: ReturnType<typeof profileFor>) {
  const seasonCount = series.seasons.filter((s) => s.seasonNumber > 0 && s.monitored).length;
  const targets = collectMissingTargets(series);
  if (targets.length === 0) return null;
  const targetSeasons = [...new Set(targets.map((t) => t.season))];

  const t0 = performance.now();
  const releases = searchFromCache(TV_CATEGORY_IDS);
  const cacheMs = Math.round(performance.now() - t0);
  recordSearchLog("debug", "series_pack.cache_read", `${series.title} (${seasonCount} saisons) — cache RSS donne ${releases.length} release(s) (${cacheMs}ms)`, cacheMs);

  const tS = performance.now();
  const candidates = releases
    .map((r) => ({ release: r, parsed: parseRelease(r.title) }))
    .filter(({ parsed }) => releaseTitleMatches(parsed.title, series.title))
    .filter(({ release }) => isCompleteSeriesPackTitle(release.title, seasonCount, targetSeasons))
    .filter(({ parsed }) => !parsed.resolution || profile.allowedResolutions.includes(parsed.resolution))
    .filter(({ release }) => release.score >= profile.minScore)
    .filter(({ release }) => withinSizeLimit(release.size, "series"))
    .filter(({ release }) => !isRecentlyFailedRelease(release.infoHash))
    .sort((a, b) => b.release.score - a.release.score);
  const scoreMs = Math.round(performance.now() - tS);
  recordSearchLog("debug", "series_pack.scoring", `${series.title} — ${candidates.length} candidat(s) sur ${releases.length} brut(s) (${scoreMs}ms)`, scoreMs);

  let top = candidates[0];
  if (!top) {
    const configuredIndexers = loadIndexers().filter((i) => i.enabled && i.protocol === "torrent");
    const indexers = withoutRateLimited(configuredIndexers);
    const alreadyLimited = configuredIndexers.length - indexers.length;
    if (indexers.length === 0) {
      recordSearchLog("warn", "series_pack.no_match", `${series.title} — aucun pack intégrale trouvé sur ${releases.length} bruts, aucun indexeur disponible : tous rate-limités (${alreadyLimited}/${configuredIndexers.length})`);
      return null;
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
      const results = await searchCompleteSeriesPack(ix, { title: series.title, seasonCount }, TV_CATEGORY_IDS).catch(() => [] as IndexerRelease[]);
      directReleases.push(...results);
    }
    const directMs = Math.round(performance.now() - tDirect);
    const newlyLimited = countNewlyRateLimited(indexers);
    recordSearchLog("info", "series_pack.fallback_result", `${series.title} — recherche directe: ${directReleases.length} release(s) (${directMs}ms)`, directMs);

    const directCandidates = directReleases
      .map((r) => ({ release: r, parsed: parseRelease(r.title) }))
      .filter(({ parsed }) => releaseTitleMatches(parsed.title, series.title))
      .filter(({ release }) => isCompleteSeriesPackTitle(release.title, seasonCount, targetSeasons))
      .filter(({ parsed }) => !parsed.resolution || profile.allowedResolutions.includes(parsed.resolution))
      .filter(({ release }) => release.score >= profile.minScore)
      .filter(({ release }) => withinSizeLimit(release.size, "series"))
      .filter(({ release }) => !isRecentlyFailedRelease(release.infoHash))
      .sort((a, b) => b.release.score - a.release.score);

    top = directCandidates[0];
    if (!top) {
      if (newlyLimited > 0) {
        recordSearchLog("warn", "series_pack.fallback_rate_limited", `${series.title} — 0 résultat : ${newlyLimited} indexeur(s) ont répondu 429 (rate-limité) pendant cette recherche, pas forcément "rien trouvé"`);
      } else {
        recordSearchLog("warn", "series_pack.no_match", `${series.title} — 0 candidat (cache + recherche directe: ${releases.length + directReleases.length} bruts)`);
      }
      return null;
    }
    recordSearchLog("info", "series_pack.fallback_match", `${series.title} — meilleur pack via recherche directe: "${top.release.title}" (score:${top.release.score}, indexeur:${top.release.indexerId})`);
  } else {
    recordSearchLog("info", "series_pack.match", `${series.title} — meilleur pack: "${top.release.title}" (score:${top.release.score}, indexeur:${top.release.indexerId})`);
  }

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
    recordSearchLog("error", "series_pack.engine_rejected", `${series.title} — "${top.release.title}" refusé par le moteur (${detail})`);
    return null;
  }
  recordSearchLog("info", "series_pack.grabbed", `${series.title} — "${top.release.title}" envoyé au moteur (${targets.length} ép. ciblés)`);
  return { release: top.release, torrent: sent.torrent, targets };
}

/**
 * Search + grab a complete-series pack that covers every monitored season.
 * Falls back to searching per-season when no pack is found.
 */
export async function searchAndGrabCompleteSeries(seriesId: string) {
  const series = getSeries(seriesId);
  if (!series) return { error: "series not found" as const };
  const profile = profileFor(series.qualityProfileId);

  const targets = collectMissingTargets(series);
  if (targets.length === 0) return { ok: true as const, skipped: "nothing missing" };

  const seriesPack = await tryGrabSeriesPack(series, profile);
  if (seriesPack) {
    setMultiSeasonEpisodesStatus(series, groupTargetsBySeason(targets), { status: "downloading", activeInfoHash: seriesPack.torrent.infoHash });
    void notifySeerrStatus("series", series.tmdbId, "processing").catch(() => {});
    logActivity("grabbed", "system", `${series.title} — intégrale`, `/title/series/${series.tmdbId}`, {
      libraryRef: encodeLibraryRef({ kind: "series", seriesId }),
      releaseTitle: seriesPack.release.title,
      indexer: seriesPack.release.indexerId,
      infoHash: seriesPack.torrent.infoHash,
    });
    return { ok: true as const, mode: "series_pack" as const, release: seriesPack.release, torrent: seriesPack.torrent };
  }

  // No complete pack — search each season individually
  const results = [];
  for (const season of series.seasons) {
    if (!season.monitored) continue;
    const missing = season.episodes.filter((e) => e.monitored && e.status === "missing");
    if (missing.length === 0) continue;
    results.push(await searchAndGrabSeason(seriesId, season.seasonNumber));
  }
  return { ok: true as const, mode: "per_season" as const, results };
}

/** Below this fraction of monitored episodes actually available, a complete-series pack is tried before going season by season — cheaper than pulling a dozen near-empty season packs for a show nobody's really started yet. */
const LOW_COMPLETION_SERIES_PACK_THRESHOLD = 0.1;

/** Search every monitored season that still has missing episodes — the "search whole series" / "rechercher les manquants" action. */
export async function searchAndGrabSeries(seriesId: string) {
  const series = getSeries(seriesId);
  if (!series) return { error: "series not found" as const };
  const profile = profileFor(series.qualityProfileId);

  const monitoredEpisodes = series.seasons.filter((s) => s.monitored).flatMap((s) => s.episodes.filter((e) => e.monitored));
  const missingCount = monitoredEpisodes.filter((e) => e.status === "missing").length;
  if (missingCount === 0) return { ok: true as const, results: [] };

  const completion = monitoredEpisodes.length ? 1 - missingCount / monitoredEpisodes.length : 1;
  if (completion < LOW_COMPLETION_SERIES_PACK_THRESHOLD) {
    const seriesPack = await tryGrabSeriesPack(series, profile);
    if (seriesPack) {
      setMultiSeasonEpisodesStatus(series, groupTargetsBySeason(seriesPack.targets), { status: "downloading", activeInfoHash: seriesPack.torrent.infoHash });
      void notifySeerrStatus("series", series.tmdbId, "processing").catch(() => {});
      logActivity("grabbed", "system", `${series.title} — intégrale`, `/title/series/${series.tmdbId}`, {
        libraryRef: encodeLibraryRef({ kind: "series", seriesId }),
        releaseTitle: seriesPack.release.title,
        indexer: seriesPack.release.indexerId,
        infoHash: seriesPack.torrent.infoHash,
      });
      return { ok: true as const, mode: "series_pack" as const, release: seriesPack.release, torrent: seriesPack.torrent };
    }
  }

  const results = [];
  // Once one season's fallback proves no complete-series pack exists, every
  // later season here skips re-searching for it (see skipSeriesPackRetry in
  // searchAndGrabSeason) — the answer can't change between seasons within
  // this same run.
  let seriesPackExhausted = false;
  for (const season of series.seasons) {
    if (!season.monitored) continue;
    if (!season.episodes.some((e) => e.monitored && e.status === "missing")) continue;
    const result = await searchAndGrabSeason(seriesId, season.seasonNumber, { skipSeriesPackRetry: seriesPackExhausted });
    if (!seriesPackExhausted && "mode" in result && result.mode === "per_episode") seriesPackExhausted = true;
    results.push(result);
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
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Same idea as autoGrab.ts's searchReleasedMissingMovies — episodes stay
 * "missing" indefinitely once monitored, so this retries any monitored
 * episode whose air date has actually passed a few times a day, catching
 * releases that land on indexers a bit late. Bounded to 14 days so it
 * doesn't degrade into an unbounded retry of every old missing episode.
 */
export async function searchReleasedMissingEpisodes() {
  const now = Date.now();
  const searched: string[] = [];

  // Group qualifying episodes by season so each season is tried as a pack
  // first, same "pack first, then per-episode" rule as a manual season search.
  const bySeason = new Map<string, { series: LibrarySeries; seasonNumber: number; episodeNumbers: number[] }>();
  for (const series of loadSeries()) {
    if (!series.monitored) continue;
    for (const season of series.seasons) {
      for (const ep of season.episodes) {
        if (!ep.monitored || ep.status !== "missing" || !ep.airDate) continue;
        const airedAt = new Date(ep.airDate).getTime();
        if (Number.isNaN(airedAt) || airedAt > now || now - airedAt > 14 * DAY_MS) continue;
        const key = `${series.id}.${season.seasonNumber}`;
        const entry = bySeason.get(key) ?? { series, seasonNumber: season.seasonNumber, episodeNumbers: [] };
        entry.episodeNumbers.push(ep.episodeNumber);
        bySeason.set(key, entry);
      }
    }
  }

  for (const { series, seasonNumber, episodeNumbers } of bySeason.values()) {
    const profile = profileFor(series.qualityProfileId);
    const pack = await tryGrabSeasonPack(series, seasonNumber, profile, episodeNumbers);
    if (pack) {
      setEpisodesStatus(series, seasonNumber, episodeNumbers, {
        status: "downloading",
        activeInfoHash: pack.torrent.infoHash,
      });
      void notifySeerrStatus("series", series.tmdbId, "processing").catch(() => {});
      for (const episodeNumber of episodeNumbers) searched.push(`${series.id}.${seasonNumber}.${episodeNumber}`);
      continue;
    }
    for (const episodeNumber of episodeNumbers) {
      await searchAndGrabEpisode(series.id, seasonNumber, episodeNumber);
      searched.push(`${series.id}.${seasonNumber}.${episodeNumber}`);
      await new Promise<void>((resolve) => setTimeout(resolve, ITEM_DELAY_MS));
    }
  }

  return { searched };
}

/** True if `text` contains CJK characters (Japanese/Chinese kanji, hiragana, katakana). Used to detect when TVDB fell back to Japanese because no French title exists. */
function hasCjkText(text: string): boolean {
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/.test(text);
}

/**
 * Searches every monitored missing episode/season, regardless of air date.
 * Enforces all quality profile rules. Limits batch to avoid hammering indexers.
 */
export async function searchMissingEpisodes(maxSeasons = 30) {
  const searched: string[] = [];
  const bySeason = new Map<string, { series: LibrarySeries; seasonNumber: number; episodeNumbers: number[] }>();
  let seasonCount = 0;

  for (const series of loadSeries()) {
    if (!series.monitored) continue;
    for (const season of series.seasons) {
      if (seasonCount >= maxSeasons) break;
      for (const ep of season.episodes) {
        if (ep.monitored && ep.status === "missing") {
          const key = `${series.id}.${season.seasonNumber}`;
          const entry = bySeason.get(key) ?? { series, seasonNumber: season.seasonNumber, episodeNumbers: [] };
          entry.episodeNumbers.push(ep.episodeNumber);
          bySeason.set(key, entry);
        }
      }
      seasonCount++;
    }
  }

  for (const { series, seasonNumber, episodeNumbers } of bySeason.values()) {
    const profile = profileFor(series.qualityProfileId);
    const pack = await tryGrabSeasonPack(series, seasonNumber, profile, episodeNumbers);
    if (pack) {
      setEpisodesStatus(series, seasonNumber, episodeNumbers, {
        status: "downloading",
        activeInfoHash: pack.torrent.infoHash,
      });
      void notifySeerrStatus("series", series.tmdbId, "processing").catch(() => {});
      for (const episodeNumber of episodeNumbers) searched.push(`${series.id}.${seasonNumber}.${episodeNumber}`);
      continue;
    }
    for (const episodeNumber of episodeNumbers) {
      await searchAndGrabEpisode(series.id, seasonNumber, episodeNumber);
      searched.push(`${series.id}.${seasonNumber}.${episodeNumber}`);
      await new Promise<void>((resolve) => setTimeout(resolve, ITEM_DELAY_MS));
    }
  }

  return { searched };
}
