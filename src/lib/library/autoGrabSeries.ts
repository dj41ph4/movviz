import fs from "node:fs";
import { trackJobProgress } from "@/lib/jobs/cancelScope";
import path from "node:path";
import { isFankaiId } from "@/lib/metadata/fankaiWikitext";
import { getSeries, getSeriesByTmdbId, addSeries, updateSeries, loadSeries, loadMovies } from "@/lib/library/store";
import { DEFAULT_QUALITY_PROFILES } from "@/lib/library/qualityProfiles";
import { configuredQualityProfile } from "@/lib/library/defaultQualityProfile";
import { encodeLibraryRef, decodeLibraryRef, type LibrarySeries, type LibrarySeason, type LibraryEpisode, type LibraryFile } from "@/lib/library/types";
import { planAnimeResync, type CatalogEpisode, type ResyncFile } from "@/lib/library/animeResyncPlan";
import { pathFor } from "@/lib/library/renamePath";
import { renameResyncedFiles } from "@/lib/library/resyncRename";
import { carryMediaProbeEntries } from "@/lib/playback/engine/mediaProbeCache";
import { episodeMediaId } from "@/lib/playback/engine/probeLibrary";
import { loadUsers } from "@/lib/auth/store";
import { getWatchStatus, setWatchedEpisodes } from "@/lib/plex/watchStore";
import { refreshPlexLibraryFor } from "@/lib/plex/librarySync";
import { moveToTrash } from "@/lib/library/trashMove";
import { getTrashConfig, addTrashEntry } from "@/lib/library/trashStore";
import { searchFromCache } from "@/lib/indexers/rssCache";
import type { IndexerRelease } from "@/lib/indexers/types";
import { TV_CATEGORY_IDS } from "@/lib/indexers/categories";
import { parseRelease } from "@/lib/naming/parser";
import type { ReleaseInfo } from "@/lib/naming/types";
import { looksLikeSeriesRelease, releaseTitleMatches, seriesNeedsReleaseYear, seriesYearIsCompatible, partPackInfo, pickSearchTitle, releaseYearTarget, seriesSearchTitles } from "@/lib/library/matching";
import { getReleaseMatchPool } from "@/lib/workers/releaseMatchPool";
import { withinSizeLimit, loadReleaseRules, compareBySizePreference, perceptualSizeBytes, type ReleaseRules } from "@/lib/library/releaseRules";
import { isBlockedForAutoGrab } from "@/lib/library/decisionGuard";
import { isUnrestricted } from "@/lib/library/unrestricted";
import { markManualGrab } from "@/lib/library/manualGrab";
import { recordDecision } from "@/lib/library/decisionLog";
import { trackOp } from "@/lib/blockProbe";
import { buildGrabPayload } from "@/lib/indexers/grabPayload";
import { ENGINE_BASE, engineHeaders, ENGINE_TIMEOUT_MS } from "@/lib/engine/server";
import { getSeries as fetchTmdbSeries, getSeason as fetchTmdbSeason } from "@/lib/metadata/tmdb";
import { emitNotification } from "@/lib/notifications/store";
import { logActivity } from "@/lib/activity/store";
import { logActivityV2, createMediaRef, createFailureRef, createReleaseRef } from "@/lib/activity/v2/store";
import { getTvdbEpisodesFor, getTvdbSeasonNames, groupTvdbEpisodesBySeason, tvdbConfigured, specialsEnabled, type TvdbEpisode } from "@/lib/metadata/tvdb";
import { isRecentlyFailedRelease, isRecentlyFailedSeriesPack } from "@/lib/library/failedReleases";
import { episodeStatus, seasonEpisodeStatuses } from "@/lib/library/releaseSchedule";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import { notifySeerrProcessingOnce } from "@/lib/seerr/mediaMap";
import { searchTv, searchCompleteSeriesPack, COMPLETE_SERIES_TERMS } from "@/lib/indexers/torznab";
import { loadIndexers } from "@/lib/indexers/store";
import { withoutRateLimited, countNewlyRateLimited } from "@/lib/indexers/rateLimit";
import { withKeyLock } from "@/lib/library/locks";
import { runBackground } from "@/lib/priority/lane";
import { yieldToUser } from "@/lib/priority/userActivity";
import { isDueForRetry, recordRetryPass } from "@/lib/library/missingSearchBackoff";
import { BLEACH_TMDB_ID, needsBleachRepair, knownBleachEpisode, bleachCourForEpisode, BLEACH_TYBW_COURS } from "@/lib/metadata/bleachEpisodeOrder";
import { bleachMatchingTitle, bleachReleaseSource, bleachReleaseTargets, bleachIndexerQueries, bleachReleaseYearCompatible, bleachCompletePackCovers } from "@/lib/library/bleachRelease";
import { prepareBleachGrab, markBleachGrabTargets } from "@/lib/library/bleachEngine";
import { withEpisodeTitles, withFanVersionTarget } from "@/lib/library/episodeTargetTitles";
import { scopedBleachSeries, bleachEpisodeInScope, type BleachSeriesPart } from "@/lib/library/bleachScope";

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
    const statuses = seasonEpisodeStatuses(s.episodes);
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
        status: statuses.get(e.episodeNumber) ?? episodeStatus(e.airDate, e.title),
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
  /** Show title the filename carries, empty when it only has numbers. */
  title: string;
  seasonNumber: number;
  episodeNumber: number;
}

const VIDEO_EXTS = /\.(mkv|mp4|avi|ts|m2ts|wmv|mov|webm|flv)$/i;
const SEASON_DIR = /^(?:specials?|S(?:aison|eason)?[. _-]?\d{1,2}\b.*)$/i;

// Real pause between per-episode direct-search attempts — see the matching
// constant/comment in searchMissing.ts. Measured live: an indexer tripped
// its own 429 after ~35 requests in ~35s (one item = one request per
// indexer), so 800ms wasn't a large enough gap; raised here too for the
// same reason.
const ITEM_DELAY_MS = 1500;

/**
 * Every video in a series folder's season directories, with the season and
 * episode its own NAME carries (the folder only fills in a missing season).
 * Unreadable folders yield nothing: an offline share must never look like
 * "no files" — files the library already links are planned regardless.
 */
function scanSeriesDiskFiles(baseDir: string): DiskFile[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(baseDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const out: DiskFile[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !SEASON_DIR.test(entry.name.trim())) continue;
    const isSpecials = /^specials?$/i.test(entry.name.trim());
    const folderSeason = isSpecials ? 0 : parseInt(entry.name.match(/(\d{1,2})/)![1], 10);
    let seasonFiles: fs.Dirent[];
    try {
      seasonFiles = fs.readdirSync(path.join(baseDir, entry.name), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const file of seasonFiles) {
      if (!file.isFile() || !VIDEO_EXTS.test(file.name)) continue;
      const parsed = parseRelease(file.name);
      if (parsed.episode == null) continue;
      out.push({ path: path.join(baseDir, entry.name, file.name), title: parsed.title ?? "", seasonNumber: parsed.season ?? folderSeason, episodeNumber: parsed.episode });
    }
  }
  return out;
}

function diskLibraryFile(filePath: string): LibraryFile {
  const parsed = parseRelease(path.basename(filePath));
  let size = 0;
  try { size = fs.statSync(filePath).size; } catch { /* ignore */ }
  return {
    path: filePath,
    quality: parsed.source ?? "—",
    resolution: parsed.resolution ?? null,
    videoCodec: parsed.videoCodec,
    audioCodec: parsed.audioCodec,
    hdr: parsed.hdr,
    source: parsed.source,
    size,
    addedAt: Date.now(),
  };
}

export type ResyncAnimeResult =
  | { ok: true; oldSeasonCount: number; newSeasonCount: number; source: "tvdb" | "tmdb"; movedFiles: number; duplicatesRemoved: number; duplicatesKept: number; renamedFiles: number; unchanged: boolean; snapshot: string | null }
  | { ok: false; error: "not_found" | "no_tvdb_match" | "active_downloads" | "no_disk_seasons" | "bleach_repair_required" | "tmdb_unavailable" | "tvdb_unavailable" | "combined_files" | "needs_review" | "files_would_be_lost" };

const RESYNC_SNAPSHOT_DIR = path.join(
  process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data"),
  "repair-snapshots"
);

/**
 * Rebuilds an in-library anime on its most precise catalogue (TVDB when it
 * splits the show into more seasons than TMDb, TMDb otherwise) and puts
 * every physical file on the episode it really is — see animeResyncPlan.ts.
 *
 * Nothing is lost on the way: Plex links, monitoring choices and file
 * records travel with their episode; TMDb-announced seasons TVDB doesn't
 * list yet stay; files no catalogue fits stay as extra episodes. Copies of
 * the same episode under both numberings (Blood+ S01E14 = S02E01) are moved
 * to the series trash — only when both placements are proven and the two
 * copies are not tagged with different languages; any doubt keeps the file.
 * The whole previous record is snapshotted before anything is written.
 */
/**
 * A resync rewrites every episode and drops its torrent link, so it must not
 * run while a download is in flight. But an episode that is available, has
 * its file, and still carries the hash of a torrent that is OVER is not a
 * download in progress: taken for one, it kept Naruto Shippuden and Pokémon
 * out of every resync for good (stuck at exactly 500 episodes — the old
 * TVDB page limit — with an 18-episode torrent the engine no longer had).
 */
export function episodeHasLiveDownload(e: LibraryEpisode, settled: ReadonlySet<string>): boolean {
  if (e.status === "downloading" || e.status === "searching") return true;
  if (!e.activeInfoHash) return false;
  return !(e.status === "available" && !!e.file && settled.has(e.activeInfoHash.toLowerCase()));
}

/** A finished transfer is only trusted once its import has had time to run. */
const SETTLED_AFTER_MS = 30 * 60 * 1000;

/** Engine's view of one torrent, reduced to "is this transfer over?". */
export function torrentIsSettled(t: { state?: string; progress?: number; completedAt?: number | null; imported?: boolean } | undefined, now = Date.now()): boolean {
  if (!t) return true; // the engine no longer has it: nothing can still arrive
  if (t.imported) return true;
  if (!(t.progress != null && t.progress >= 1) || !(t.state === "seeding" || t.state === "completed")) return false;
  return t.completedAt != null && now - t.completedAt >= SETTLED_AFTER_MS;
}

/**
 * Among `hashes`, the torrents that are over. Engine unreachable or
 * answering nonsense → none: every hash then still counts as a download.
 */
async function settledTorrents(hashes: string[]): Promise<Set<string>> {
  const wanted = new Set(hashes.map((h) => h.toLowerCase()));
  if (wanted.size === 0) return new Set();
  try {
    const res = await fetch(`${ENGINE_BASE}/torrents`, { headers: engineHeaders(), signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS) });
    if (!res.ok) return new Set();
    const body = await res.json();
    const list: Array<{ infoHash?: string; state?: string; progress?: number; completedAt?: number | null; imported?: boolean }> | null = Array.isArray(body) ? body : Array.isArray(body?.torrents) ? body.torrents : null;
    if (!list) return new Set();
    const byHash = new Map(list.filter((t) => typeof t.infoHash === "string").map((t) => [t.infoHash!.toLowerCase(), t]));
    return new Set([...wanted].filter((h) => torrentIsSettled(byHash.get(h))));
  } catch {
    return new Set();
  }
}

export async function resyncAnimeSeasonsFromTvdb(seriesId: string, opts: { background?: boolean; forceTmdb?: boolean } = {}): Promise<ResyncAnimeResult> {
  const initial = getSeries(seriesId);
  if (!initial) return { error: "not_found", ok: false };
  // « Forcer TMDb » on the title's page: once the series is back in TMDb
  // numbering, nothing automatic resyncs it any more — only the choice
  // itself (opts.forceTmdb) runs. While it is still TVDB-numbered (the
  // conversion could not finish yet), any pass completes it, towards TMDb.
  if (initial.forceTmdbOrder && !opts.forceTmdb && initial.episodeOrder !== "tvdb") {
    return { ok: true, oldSeasonCount: initial.seasons.length, newSeasonCount: initial.seasons.length, source: "tmdb", movedFiles: 0, duplicatesRemoved: 0, duplicatesKept: 0, renamedFiles: 0, unchanged: true, snapshot: null };
  }
  // Bleach has an explicit identity repair; never use positional resync here.
  if (initial.tmdbId === BLEACH_TMDB_ID) return { error: "bleach_repair_required", ok: false };
  // A Fan-Kai version is numbered by its parts (Fan-Kai wiki): TVDB knows
  // only the original series and would renumber it as that one.
  if (isFankaiId(initial.tmdbId)) {
    return { ok: true, oldSeasonCount: initial.seasons.length, newSeasonCount: initial.seasons.length, source: "tmdb", movedFiles: 0, duplicatesRemoved: 0, duplicatesKept: 0, renamedFiles: 0, unchanged: true, snapshot: null };
  }

  // ---- Catalogues (network, outside the lock) ----
  const meta = await fetchTmdbSeries(initial.tmdbId).catch(() => null);
  let tmdb: CatalogEpisode[] | null = null;
  const tmdbSeasonNames = new Map<number, string>();
  if (meta) {
    tmdb = [];
    for (const s of meta.seasons) {
      const detail = await fetchTmdbSeason(initial.tmdbId, s.seasonNumber).catch(() => null);
      if (!detail) { tmdb = null; break; }
      tmdbSeasonNames.set(s.seasonNumber, detail.name || s.name);
      tmdb.push(...detail.episodes.map((e) => ({ seasonNumber: s.seasonNumber, episodeNumber: e.episodeNumber, title: e.title, airDate: e.airDate })));
    }
  }
  // A partial TMDb read would misplace files converted from TMDb numbering.
  if (meta && !tmdb) return { ok: false, error: "tmdb_unavailable" };
  const tvdbId = meta?.tvdbId ?? initial.tvdbId ?? null;
  // Without TVDB, a series kept in TVDB numbering is never rebuilt from TMDb.
  if (!tvdbConfigured() && initial.episodeOrder === "tvdb") return { ok: false, error: "no_tvdb_match" };
  const tvdbEpisodes = await getTvdbEpisodesFor(tvdbId, initial.title, initial.year);
  // A known TVDB id answering nothing is TVDB being unreachable, not a show
  // without episodes: planning without it would undo a TVDB structure.
  // (A series forced to TMDb and already numbered that way needs nothing from TVDB.)
  const tvdbNeeded = !(initial.forceTmdbOrder && initial.episodeOrder !== "tvdb");
  if (tvdbNeeded && tvdbConfigured() && tvdbId && tvdbEpisodes.length === 0) return { ok: false, error: "tvdb_unavailable" };
  if (!tmdb && tvdbEpisodes.length === 0) return { ok: false, error: "no_tvdb_match" };
  const tvdbSeasonNames = tvdbId && tvdbEpisodes.length > 0 ? await getTvdbSeasonNames(tvdbId) : new Map<number, string>();

  // Torrents still referenced by episodes that already have their file:
  // which of them are really over (asked once, outside the lock).
  const settled = await settledTorrents(initial.seasons.flatMap((s) => s.episodes).filter((e) => e.activeInfoHash && e.status === "available" && e.file).map((e) => e.activeInfoHash!));

  return withKeyLock(`series:${seriesId}`, async (): Promise<ResyncAnimeResult> => {
    const series = getSeries(seriesId);
    if (!series) return { error: "not_found", ok: false };
    const oldFlat = series.seasons.flatMap((s) => s.episodes);
    if (oldFlat.some((e) => episodeHasLiveDownload(e, settled))) {
      return { error: "active_downloads", ok: false };
    }

    // ---- Every physical file: library links first, then the season folders ----
    const physical = (f: LibraryFile | null | undefined) => f?.diskPath ?? f?.path ?? null;
    const files = new Map<string, ResyncFile>();
    /** Files left to the other series that also links them (never « lost »). */
    const letGo = new Set<string>();
    const baseDirs = new Set<string>();
    // A file another library series also links, named after another title,
    // is that series' file wrongly shared (Saint Seiya 1986 linked the 39
    // files of The Lost Canvas): it is not this series' and not scanned for.
    const aliases = [series.originalTitle].filter((t): t is string => !!t);
    const elsewhere = new Set(loadSeries().filter((o) => o.id !== seriesId).flatMap((o) => o.seasons.flatMap((s) => s.episodes.flatMap((e) => [e.file?.path, e.file?.diskPath].filter((x): x is string => !!x)))));
    for (const ep of oldFlat) {
      const p = physical(ep.file);
      if (!p) continue;
      const pp = pathFor(p);
      const parsed = parseRelease(pp.basename(p));
      if ((elsewhere.has(p) || (ep.file?.path && elsewhere.has(ep.file.path))) && parsed.title && !releaseTitleMatches(parsed.title, series.title, aliases)) { letGo.add(p); continue; }
      const dir = pp.dirname(p);
      baseDirs.add(SEASON_DIR.test(pp.basename(dir)) ? pp.dirname(dir) : dir);
      if (files.has(p)) continue;
      files.set(p, {
        path: p,
        literal: parsed.episode != null && parsed.season != null ? { seasonNumber: parsed.season, episodeNumber: parsed.episode } : null,
        size: ep.file?.size ?? 0,
      });
    }
    const knownPaths = new Set(oldFlat.flatMap((e) => [e.file?.path, e.file?.diskPath].filter((p): p is string => !!p)));
    for (const dir of baseDirs) {
      for (const f of scanSeriesDiskFiles(dir)) {
        if (knownPaths.has(f.path) || files.has(f.path)) continue;
        // Two shows can share a folder (a franchise kept together on disk):
        // a file named after another title is never pulled into this one.
        if (f.title && !releaseTitleMatches(f.title, series.title, aliases)) continue;
        const diskFile = diskLibraryFile(f.path);
        files.set(f.path, { path: f.path, literal: { seasonNumber: f.seasonNumber, episodeNumber: f.episodeNumber }, size: diskFile.size, diskFile });
      }
    }

    const plan = planAnimeResync({
      oldSeasons: series.seasons,
      tvdb: tvdbEpisodes,
      tmdb,
      tvdbSeasonNames,
      tmdbSeasonNames,
      files: [...files.values()],
      includeSpecials: specialsEnabled(),
      isCjk: hasCjkText,
      statusFor: (eps) => seasonEpisodeStatuses(eps),
      forceTmdb: !!series.forceTmdbOrder,
    });
    if (!plan.ok) return { ok: false, error: plan.error === "no_catalog" ? "no_tvdb_match" : plan.error };
    // ---- Last line of defence: a resync never detaches a file ----
    // Whatever the plan concluded, every file the series links must still be
    // linked afterwards — or be a copy set aside as a duplicate, or a file
    // left to the other series that owns it. Otherwise nothing is written
    // (Naruto Shippuden lost 464 of its 482 links on 2026-11-16, its
    // episodes turning « missing » and searchable again).
    {
      const kept = new Set(plan.seasons.flatMap((x) => x.episodes).flatMap((e) => [e.file?.path, e.file?.diskPath]).filter((p): p is string => !!p));
      const setAside = new Set(plan.duplicates.map((d) => d.droppedPath));
      const detached = [...new Set(oldFlat.map((e) => physical(e.file)).filter((p): p is string => !!p))]
        .filter((p) => !kept.has(p) && !setAside.has(p) && !letGo.has(p));
      if (detached.length > 0) {
        recordSearchLog("warn", "library.resync_refused", `${series.title} : resynchronisation refusée — elle aurait détaché ${detached.length} fichier(s) de la série (ex. ${detached.slice(0, 3).map((p) => pathFor(p).basename(p)).join(", ")}) ; source ${plan.source}, ${series.seasons.length} → ${plan.seasons.length} saisons`);
        return { ok: false, error: "files_would_be_lost" };
      }
    }
    // The daily pass applies everything on its own — new episodes, moved
    // files, renames, the Plex order — except discarding a file: a show
    // holding duplicate copies waits for a click, which alone trashes them
    // (applied here, the extra copy would be unlinked and no longer provable).
    if (opts.background && plan.duplicates.length > 0) {
      return { ok: false, error: "needs_review" };
    }
    const episodeOrder = plan.source === "tvdb" ? "tvdb" as const : undefined;
    const unchanged = stableJson(plan.seasons) === stableJson(series.seasons) && series.episodeOrder === episodeOrder;
    if (unchanged) {
      // Nothing moves, but marks left on TMDb numbers by an earlier resync are
      // still brought onto their TVDB episode.
      if (plan.source === "tvdb") migrateWatchedEpisodes(series, new Map());
      // A click on « resync » also finishes renames an earlier pass had to
      // leave (a name held by another file): every linked file whose name
      // carries another number than its episode. Never in the background.
      let retried = 0;
      if (!opts.background) {
        const before = new Map<string, string>();
        const holders = new Map<string, number>();
        for (const s of series.seasons) for (const e of s.episodes) {
          const p = physical(e.file);
          if (!p) continue;
          before.set(`${s.seasonNumber}-${e.episodeNumber}`, p);
          holders.set(p, (holders.get(p) ?? 0) + 1);
        }
        // A file holding several episodes (one name, two numbers) is never renamed.
        const all = new Set([...before].filter(([, p]) => holders.get(p) === 1).map(([key]) => key));
        const renamed = await renameResyncedFiles(series, series.seasons, all, (m) => console.log(m), new Set(plan.duplicates.map((d) => d.droppedPath)));
        retried = renamed.renamed;
        if (retried > 0) {
          updateSeries(seriesId, { seasons: renamed.seasons });
          const probeMoves: Array<{ fromId: string; fromPath: string; toId: string; toPath: string }> = [];
          for (const s of renamed.seasons) for (const e of s.episodes) {
            const key = `${s.seasonNumber}-${e.episodeNumber}`, toPath = physical(e.file), fromPath = before.get(key);
            const id = episodeMediaId(seriesId, s.seasonNumber, e.episodeNumber);
            if (toPath && fromPath && toPath !== fromPath) probeMoves.push({ fromId: id, fromPath, toId: id, toPath });
          }
          carryMediaProbeEntries(probeMoves);
          void refreshPlexLibraryFor("tv").catch(() => {});
        }
        // Every file now carries its Movviz number: Plex may follow; else it must not.
        updateSeries(seriesId, { plexOrderPending: renamed.kept === 0 ? (retried > 0 || series.plexOrderPending || opts.forceTmdb ? plan.source : series.plexOrderPending) : undefined });
      }
      return { ok: true, oldSeasonCount: series.seasons.length, newSeasonCount: series.seasons.length, source: plan.source, movedFiles: 0, duplicatesRemoved: 0, duplicatesKept: 0, renamedFiles: retried, unchanged: retried === 0, snapshot: null };
    }

    // Episodes whose file changed in this resync: the only ones renamed below.
    const oldKeyOfPath = new Map<string, string>();
    for (const s of series.seasons) for (const e of s.episodes) { const p = physical(e.file); if (p) oldKeyOfPath.set(p, `${s.seasonNumber}-${e.episodeNumber}`); }
    const changedFile = new Set<string>();
    for (const s of plan.seasons) for (const e of s.episodes) {
      const p = physical(e.file);
      const key = `${s.seasonNumber}-${e.episodeNumber}`;
      if (p && oldKeyOfPath.get(p) !== key) changedFile.add(key);
    }

    // ---- Snapshot, then write ----
    fs.mkdirSync(RESYNC_SNAPSHOT_DIR, { recursive: true });
    const snapshot = `anime-resync-${seriesId}-${Date.now()}.json`;
    fs.writeFileSync(path.join(RESYNC_SNAPSHOT_DIR, snapshot), JSON.stringify({ series, plan: { ...plan, seasons: undefined }, createdAt: Date.now() }), { encoding: "utf8", flag: "wx" });
    // Marked TVDB, the daily TMDb episode sync leaves it alone — that sync
    // appending TMDb's long first season next to TVDB's arcs is how these
    // libraries ended up listing every episode twice.
    updateSeries(seriesId, { seasons: plan.seasons, episodeOrder, ...(tvdbId && !series.tvdbId ? { tvdbId } : {}) });

    // ---- Duplicates: proven copies of one episode go to the series trash ----
    let duplicatesRemoved = 0;
    const trashRoot = getTrashConfig().seriesPath;
    const languageOf = (p: string) => oldFlat.find((e) => physical(e.file) === p)?.file?.language ?? null;
    for (const dup of plan.duplicates) {
      const a = languageOf(dup.keptPath), b = languageOf(dup.droppedPath);
      // A file only found on disk (never linked to this series) may belong
      // to another show sharing the folder: it is left alone, never trashed.
      if (!dup.verified || (a && b && a !== b) || !trashRoot || !knownPaths.has(dup.droppedPath)) continue;
      if (!fs.existsSync(dup.droppedPath) || !fs.existsSync(dup.keptPath)) continue;
      if (fileReferencedElsewhere(dup.droppedPath)) continue;
      try {
        const trashedTo = await moveToTrash(dup.droppedPath, trashRoot);
        const label = `${series.title} — S${dup.seasonNumber}E${dup.episodeNumber} (doublon)`;
        addTrashEntry({ id: `episode:${seriesId}:${dup.seasonNumber}:${dup.episodeNumber}:dup:${Date.now()}`, kind: "series", title: label, trashPath: trashedTo, deletedAt: Date.now() });
        duplicatesRemoved++;
      } catch (err) {
        console.warn(`[resyncAnime] doublon non déplacé ${dup.droppedPath}:`, err);
      }
    }

    // ---- Files named after their new number (local only, Plex not needed) ----
    let renamedFiles = 0;
    let renameComplete = true;
    if (changedFile.size > 0) {
      const latest = getSeries(seriesId)!;
      const keptCopies = new Set(plan.duplicates.map((d) => d.droppedPath).filter((p) => fs.existsSync(p)));
      const renamed = await renameResyncedFiles(latest, latest.seasons, changedFile, (m) => console.log(m), keptCopies);
      renamedFiles = renamed.renamed;
      renameComplete = renamed.kept === 0;
      if (renamed.renamed > 0) updateSeries(seriesId, { seasons: renamed.seasons });
    }
    // Plex is optional: the wanted episode order is only recorded here and
    // applied by the next Plex sync that reaches the server. Asked only when
    // every file now carries its Movviz number, or Plex would misread them.
    // Left incomplete, an order recorded by an earlier pass is withdrawn too:
    // Plex must never be switched to an order the file names don't follow.
    updateSeries(seriesId, { plexOrderPending: renameComplete ? plan.source : undefined });

    // ---- « Vu » follow their episode, for every Movviz profile ----
    const moves = new Map<string, string>();
    for (const s of plan.seasons) for (const e of s.episodes) {
      const p = physical(e.file);
      const from = p ? oldKeyOfPath.get(p) : undefined;
      const to = `${s.seasonNumber}-${e.episodeNumber}`;
      if (from && from !== to) moves.set(from, to);
    }
    for (const dup of plan.duplicates) {
      const from = oldKeyOfPath.get(dup.droppedPath);
      if (from) moves.set(from, `${dup.seasonNumber}-${dup.episodeNumber}`);
    }
    migrateWatchedEpisodes(getSeries(seriesId)!, moves);

    // ---- The ffprobe analysis follows its file (new number, new name) ----
    const finalPath = new Map<string, string>();
    for (const s of getSeries(seriesId)!.seasons) for (const e of s.episodes) {
      const p = physical(e.file);
      if (p) finalPath.set(`${s.seasonNumber}-${e.episodeNumber}`, p);
    }
    const probeMoves: Array<{ fromId: string; fromPath: string; toId: string; toPath: string }> = [];
    for (const s of plan.seasons) for (const e of s.episodes) {
      const fromPath = physical(e.file);
      const from = fromPath ? oldKeyOfPath.get(fromPath) : undefined;
      const to = `${s.seasonNumber}-${e.episodeNumber}`;
      const toPath = finalPath.get(to);
      if (!fromPath || !from || !toPath || (from === to && fromPath === toPath)) continue;
      const [fs0, fe0] = from.split("-").map(Number);
      probeMoves.push({ fromId: episodeMediaId(seriesId, fs0, fe0), fromPath, toId: episodeMediaId(seriesId, s.seasonNumber, e.episodeNumber), toPath });
    }
    if (probeMoves.length > 0) carryMediaProbeEntries(probeMoves);
    if (renamedFiles > 0) void refreshPlexLibraryFor("tv").catch(() => {});

    console.log(`[resyncAnime] ${series.title} : ${plan.source}, ${series.seasons.length} → ${plan.seasons.length} saisons, ${plan.movedFiles} fichier(s) replacé(s), ${renamedFiles} renommé(s), ${duplicatesRemoved}/${plan.duplicates.length} doublon(s) en corbeille, ${plan.extras.length} hors catalogue`);
    return {
      renamedFiles,
      unchanged: false,
      ok: true,
      oldSeasonCount: series.seasons.length,
      newSeasonCount: plan.seasons.length,
      source: plan.source,
      movedFiles: plan.movedFiles,
      duplicatesRemoved,
      duplicatesKept: plan.duplicates.length - duplicatesRemoved,
      snapshot,
    };
  });
}

/**
 * Moves every profile's « Vu » onto the episode it belongs to after a
 * resync: `moves` (old "s-e" → new "s-e", from files and duplicates), and
 * any mark still sitting on a number the library no longer has that is a
 * TMDb coordinate of one of its TVDB episodes (libraries resynced before
 * this existed). Written as « legacy_migration », the weakest source: it
 * never overrides a choice a person made and is never pushed to Plex.
 * The old mark is left where it was — it points at no episode any more.
 */
function migrateWatchedEpisodes(series: LibrarySeries, moves: Map<string, string>): void {
  const existing = new Set(series.seasons.flatMap((s) => s.episodes.map((e) => `${s.seasonNumber}-${e.episodeNumber}`)));
  const byTmdb = new Map<string, string>();
  for (const s of series.seasons) for (const e of s.episodes) {
    if (e.tmdbCoordinate) byTmdb.set(`${e.tmdbCoordinate.seasonNumber}-${e.tmdbCoordinate.episodeNumber}`, `${s.seasonNumber}-${e.episodeNumber}`);
  }
  for (const user of loadUsers()) {
    const status = getWatchStatus(user.id);
    if (!status) continue;
    const mine = status.episodes.filter((e) => e.tmdbId === series.tmdbId && e.season > 0);
    const watched = new Set(mine.map((e) => `${e.season}-${e.episode}`));
    const entries: { tmdbId: number; season: number; episode: number; watchedAt: number | null }[] = [];
    for (const e of mine) {
      const from = `${e.season}-${e.episode}`;
      const to = moves.get(from) ?? (!existing.has(from) ? byTmdb.get(from) : undefined);
      if (!to || watched.has(to) || !existing.has(to)) continue;
      const [season, episode] = to.split("-").map(Number);
      entries.push({ tmdbId: series.tmdbId, season, episode, watchedAt: e.at ?? null });
      watched.add(to);
    }
    if (entries.length > 0) setWatchedEpisodes(user.id, entries, true, series.title, "legacy_migration");
  }
}

/** JSON with keys sorted and undefined dropped: equal content, equal text. */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v) => (v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, (v as Record<string, unknown>)[k]])) : v));
}

/** True when another library record (any series or movie) still points at this path. */
function fileReferencedElsewhere(filePath: string): boolean {
  const hit = (f: { path?: string; diskPath?: string } | null | undefined) => !!f && (f.path === filePath || f.diskPath === filePath);
  return loadSeries().some((s) => s.seasons.some((se) => se.episodes.some((e) => hit(e.file))))
    || loadMovies().some((m) => [m.file, ...(m.versions ?? [])].some(hit));
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
  const season0Statuses = seasonEpisodeStatuses(detail?.episodes ?? []);
  const episodes: LibraryEpisode[] = (detail?.episodes ?? []).map((e) => ({
    seasonNumber: e.seasonNumber,
    episodeNumber: e.episodeNumber,
    title: e.title,
    airDate: e.airDate,
    monitored: false,
    status: season0Statuses.get(e.episodeNumber) ?? episodeStatus(e.airDate, e.title),
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
  options?: { skipSearch?: boolean; onAdded?: (series: LibrarySeries) => void }
) {
  const existing = getSeriesByTmdbId(tmdbId);
  if (existing) {
    if (tmdbId !== BLEACH_TMDB_ID || !seasonNumbers?.length) return { series: existing, searchResult: null };
    if (needsBleachRepair(existing)) return { error: "bleach_repair_required" as const };
    return withKeyLock(`series:${existing.id}`, async () => {
      const current = getSeries(existing.id) ?? existing;
      const seasons = [...current.seasons];
      for (const n of seasonNumbers) {
        const found = seasons.find(s => s.seasonNumber === n);
        if (found?.episodes.length) {
          const index = seasons.indexOf(found);
          seasons[index] = { ...found, monitored: true, episodes: found.episodes.map(e => knownBleachEpisode(n, e.episodeNumber) ? { ...e, monitored: true } : e) };
          continue;
        }
        const detail = await fetchTmdbSeason(tmdbId, n);
        if (!detail) continue;
        const statuses = seasonEpisodeStatuses(detail.episodes);
        const filled = { ...found, seasonNumber: n, name: detail.name, monitored: true, episodes: detail.episodes.filter(e => knownBleachEpisode(n, e.episodeNumber)).map(e => ({ seasonNumber: n, episodeNumber: e.episodeNumber, title: e.title, airDate: e.airDate, monitored: true, status: statuses.get(e.episodeNumber) ?? episodeStatus(e.airDate, e.title), file: null, activeInfoHash: null, plexRatingKey: null })) };
        if (found) seasons[seasons.indexOf(found)] = filled; else seasons.push(filled);
      }
      const series = updateSeries(existing.id, { seasons: seasons.sort((a, b) => a.seasonNumber - b.seasonNumber), monitored: true })!;
      options?.onAdded?.(series);
      return { series, searchResult: null };
    });
  }

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
    const seasonStatuses = seasonEpisodeStatuses(detail?.episodes ?? []);
    const episodes: LibraryEpisode[] = (detail?.episodes ?? []).map((e) => ({
      seasonNumber: e.seasonNumber,
      episodeNumber: e.episodeNumber,
      title: e.title,
      airDate: e.airDate,
      monitored: monitoredByDefault,
      // Unaired episodes start "upcoming" — excluded from every search path
      // until releaseDayTask flips them to "missing" on/after air date.
      // Same for TBA placeholders with no date at all (episodeStatus), and
      // for any later undated episode once an earlier one in the season is
      // itself upcoming (seasonEpisodeStatuses) — a show can't have aired
      // episode 6 before episodes 4/5 have.
      status: seasonStatuses.get(e.episodeNumber) ?? episodeStatus(e.airDate, e.title),
      file: null,
      activeInfoHash: null,
      plexRatingKey: null,
    }));
    seasons.push({ seasonNumber: s.seasonNumber, name: s.name, monitored: monitoredByDefault, episodes });
  }

  const finalSeasons = meta.tmdbId !== BLEACH_TMDB_ID && meta.isAnime && tvdbConfigured() && !seasonNumbers?.length
    ? await buildAnimeSeasonsFromTvdb(meta.title, meta.year, meta.tvdbId, seasons)
    : seasons;

  const series: LibrarySeries = {
    id: `sr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    tmdbId: meta.tmdbId,
    ...(meta.tmdbId === BLEACH_TMDB_ID ? { episodeOrder: "tvdb" as const } : {}),
    imdbId: meta.imdbId,
    tvdbId: meta.tvdbId,
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
    qualityProfileId: qualityProfileId ?? configuredQualityProfile().id,
    seasons: finalSeasons,
    addedAt: Date.now(),
    plexRatingKey: null,
    originalTitle: meta.originalTitle,
  };
  addSeries(series);
  // Keep the request/UI lifecycle independent from the best-effort automatic
  // search.  It is now observable immediately, even if an indexer fails.
  options?.onAdded?.(series);

  let searchResult:
    | Awaited<ReturnType<typeof searchAndGrabCompleteSeries>>
    | { error: "search_failed"; detail: string }
    | null = null;
  if (!options?.skipSearch) {
    try {
      searchResult = await searchAndGrabCompleteSeries(series.id);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      recordSearchLog("error", "search_series.add_search_failed", `${series.title} — ajout conservé, auto-recherche interrompue : ${detail}`);
      searchResult = { error: "search_failed" as const, detail };
    }
  }
  return { series, searchResult };
}

export function profileFor(qualityProfileId: string) {
  return DEFAULT_QUALITY_PROFILES.find((p) => p.id === qualityProfileId) ?? DEFAULT_QUALITY_PROFILES[0];
}

type GrabReleaseResult =
  | { ok: true; release: IndexerRelease }
  | { ok: false; error: "no_indexers" | "no_match"; totalReleases?: number; diagnostic?: string };

/** Turns a grabRelease/tryGrabSeriesPack failure into a readable sentence for the activity log. */
function describeGrabFailure(result: { error: "no_indexers" | "no_match"; totalReleases?: number; diagnostic?: string }): string {
  if (result.error === "no_indexers") return "Aucun indexeur torrent activé.";
  if (!result.totalReleases) return result.diagnostic ?? "Aucun résultat trouvé sur les indexeurs pour cette recherche.";
  return `${result.totalReleases} résultat(s) examinés. ${result.diagnostic ?? "Aucun candidat ne satisfait tous les critères du profil."}`;
}

/** Noms des releases (3 au plus) écartées par une étape, pour que l'historique dise CE qui a été refusé. */
function rejectedSample(titles: string[]): string {
  const shown = titles.slice(0, 3).map((t) => `« ${t} »`).join(", ");
  return titles.length > 3 ? `${shown} et ${titles.length - 3} autre(s)` : shown;
}

function grabRejectionDiagnostic(
  stages: Array<[label: string, count: number]>,
  rawCount: number,
  explain: Record<string, string> = {}
): string {
  let previous = rawCount;
  for (const [label, count] of stages) {
    if (count === 0 && previous > 0) {
      const baseLabel = label.replace(/ \(.*\)$/, "");
      return `Blocage au filtre « ${label} » : ${previous} candidat(s) rejeté(s).${explain[baseLabel] ? ` ${explain[baseLabel]}` : ""}`;
    }
    previous = count;
  }
  return `Aucune release retenue après les filtres (${stages.map(([label, count]) => `${label}: ${count}`).join(", ")}).`;
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
      kind === "series" ? seasonCount : undefined,
      series.posterPath
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
  filterPack: boolean,
  bleachCoverage?: number[]
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
  // plenty of hits for the EN one). Unless the original title is itself in a
  // non-Latin script (pickSearchTitle) — no release is ever named in
  // Japanese/Chinese/Korean/etc, so it would be a guaranteed zero-match
  // search target instead of a better one (confirmed live: "BAKI-DOU : Le
  // samouraï invincible", original title "刃牙道", matched 0 of 75 releases).
  const requireYear = seriesNeedsReleaseYear(series, loadSeries());
  const searchTitle = pickSearchTitle(series.title, series.originalTitle);
  const searchAliases = [series.title, series.originalTitle ?? "", ...(series.aliases ?? [])].filter(Boolean);
  const directTitles = seriesSearchTitles(series);

  recordSearchLog("debug", "grab_release.cache_read", `${label} — cache RSS donne ${releases.length} release(s) (${cacheMs}ms)`, cacheMs);

  const tS = performance.now();
  // Parse + title/season/episode matching (the CPU-heavy regex pass over
  // every cached release) runs in a real worker thread, not here — see
  // releaseMatchWorker.mjs for why. Everything after (blocked words,
  // resolution, score, size) stays on the main thread: it's cheap array
  // filtering that needs live store/config state, not worth a round-trip.
  const matched = await getReleaseMatchPool().run({
    releases: releases.map((r) => ({ title: series.tmdbId === BLEACH_TMDB_ID ? bleachMatchingTitle(r.title, seasonNumber, filterPack) : r.title })),
    targetTitle: searchTitle,
    aliases: searchAliases,
    seasonNumber,
    episodeNumber: filterPack ? null : (episodeNumber ?? null),
    filterPack,
    partTotalEpisodes: singleSeasonTotalEpisodes,
  });
  const coversTarget = (release: IndexerRelease) => series.tmdbId !== BLEACH_TMDB_ID || bleachReleaseTargets((bleachCoverage ?? (episodeNumber != null ? [episodeNumber] : series.seasons.find(s => s.seasonNumber === seasonNumber)?.episodes.map(e => e.episodeNumber) ?? [])).map(episode => ({ season: seasonNumber, episode })), release.title).length > 0;
  const step4 = matched.survivors.map(({ idx, parsed }) => ({ release: releases[idx], parsed })).filter(({ release }) => coversTarget(release));
  // Known homonyms require the exact debut year, including for yearless releases.
  const stepYear = step4.filter(({ parsed, release }) => series.tmdbId === BLEACH_TMDB_ID ? bleachReleaseYearCompatible(release.title, seasonNumber) : seriesYearIsCompatible(parsed.year, releaseYearTarget(series), requireYear));
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
    return { ok: false, error: "no_match", totalReleases: releases.length, diagnostic: `Aucun indexeur disponible pour la recherche directe (${alreadyLimited}/${configuredIndexers.length} en pause après limitation).` };
  }

  const tDirect = performance.now();
  recordSearchLog(
    "info",
    "grab_release.fallback_direct",
    `${label} — cache vide, recherche directe sur ${indexers.length} indexeur(s)` +
      (alreadyLimited > 0 ? ` (${alreadyLimited} exclu(s), déjà rate-limité(s))` : "")
  );
  const directReleases: IndexerRelease[] = [];
  const scoreDirect = async () => {
    const matched = await getReleaseMatchPool().run({
      releases: directReleases.map((r) => ({ title: series.tmdbId === BLEACH_TMDB_ID ? bleachMatchingTitle(r.title, seasonNumber, filterPack) : r.title })),
      targetTitle: searchTitle,
      aliases: searchAliases,
      seasonNumber,
      episodeNumber: filterPack ? null : (episodeNumber ?? null),
      filterPack,
      partTotalEpisodes: singleSeasonTotalEpisodes,
    });
    const target = matched.survivors.map(({ idx, parsed }) => ({ release: directReleases[idx], parsed })).filter(({ release }) => coversTarget(release));
    const year = target.filter(({ parsed, release }) => series.tmdbId === BLEACH_TMDB_ID ? bleachReleaseYearCompatible(release.title, seasonNumber) : seriesYearIsCompatible(parsed.year, releaseYearTarget(series), requireYear));
    const blocked = year.map(({ release }) => isBlockedForAutoGrab(release.title, rules, series.title));
    const allowed = year.filter((_, index) => !blocked[index].blocked);
    const preferred = allowed.filter(({ parsed }) => !parsed.resolution || profile.allowedResolutions.includes(parsed.resolution));
    // Repli : rien dans les résolutions du profil → on prend ce qui existe plutôt que de ne rien télécharger du tout.
    const resolutionFallback = rules.resolutionFallbackEnabled && preferred.length === 0 && allowed.length > 0;
    const resolutions = resolutionFallback ? allowed : preferred;
    const scores = resolutions.filter(({ release }) => release.score >= (resolutionFallback ? 1 : profile.minScore));
    const sizes = scores.filter(({ release }) => withinSizeLimit(release.size, filterPack ? "season" : "episode"));
    const eligible = sizes.filter(({ release }) => !isRecentlyFailedRelease(release.infoHash));
    if (resolutionFallback && eligible.length > 0) {
      recordSearchLog("info", "grab_release.resolution_fallback", `${label} — aucune release en ${profile.allowedResolutions.join("/")} : repli sur une résolution inférieure (${eligible[0].parsed.resolution ?? "inconnue"})`);
    }
    const explain: Record<string, string> = {};
    const forbidden = year.filter((_, index) => blocked[index].blocked);
    if (forbidden.length) {
      explain["mots interdits"] = `Écarté : ${rejectedSample(forbidden.map(({ release }) => release.title))} — mot interdit dans les règles de release.`;
    }
    const badRes = allowed.filter(({ parsed }) => parsed.resolution && !profile.allowedResolutions.includes(parsed.resolution));
    if (badRes.length) {
      explain["résolution"] = `Écarté : ${rejectedSample(badRes.map(({ release, parsed }) => `${release.title} (${parsed.resolution})`))} — le profil de qualité « ${profile.name} » de cette série n'accepte que ${profile.allowedResolutions.join(", ")}.`;
    }
    const lowScore = resolutions.filter(({ release }) => release.score < (resolutionFallback ? 1 : profile.minScore));
    if (lowScore.length) {
      explain["score minimum"] = `Écarté : ${rejectedSample(lowScore.map(({ release }) => `${release.title} (score ${release.score})`))} — le profil « ${profile.name} » exige un score d'au moins ${profile.minScore}.`;
    }
    const tooBig = scores.filter(({ release }) => !withinSizeLimit(release.size, filterPack ? "season" : "episode"));
    if (tooBig.length) {
      explain["taille maximale"] = `Écarté : ${rejectedSample(tooBig.map(({ release }) => `${release.title} (${(release.size / 1e9).toFixed(1)} Go)`))} — hors des limites de taille.`;
    }
    return {
      explain,
      candidates: eligible.sort((a, b) => compareBySizePreference(rules.sizePreference, { ...a.release, videoCodec: a.parsed.videoCodec }, { ...b.release, videoCodec: b.parsed.videoCodec })),
      stages: [
        ["titre", matched.titleCount], ["saison", matched.secondCount], ["épisode/pack", matched.packCount],
        ["cible", target.length], ["année", year.length], ["mots interdits", allowed.length],
        ["résolution", resolutions.length], ["score minimum", scores.length], ["taille maximale", sizes.length],
        ["releases déjà échouées", eligible.length],
      ] as Array<[string, number]>,
      blockedTerms: [...new Set(blocked.map((result) => result.matchedTerm).filter((term): term is string => !!term))],
    };
  };
  let directAnalysis: Awaited<ReturnType<typeof scoreDirect>> | null = null;
  const titles = series.tmdbId === BLEACH_TMDB_ID ? [searchTitle] : directTitles;
  for (const [variantIndex, directTitle] of titles.entries()) {
    for (const ix of indexers) {
      const cour = seasonNumber === 17 && bleachCoverage?.length ? bleachCourForEpisode(bleachCoverage[0])?.part : undefined;
      const queries = series.tmdbId === BLEACH_TMDB_ID ? bleachIndexerQueries(seasonNumber, filterPack ? null : episodeNumber, cour) : [{ title: directTitle, season: seasonNumber, episode: filterPack ? null : episodeNumber, tvdbId: variantIndex === 0 ? series.tvdbId ?? null : null, tmdbId: variantIndex === 0 && !isFankaiId(series.tmdbId) ? series.tmdbId : null, imdbId: variantIndex === 0 ? series.imdbId : null }];
      for (const query of queries) directReleases.push(...await searchTv(ix, query, TV_CATEGORY_IDS).catch(() => [] as IndexerRelease[]));
    }
    directAnalysis = await scoreDirect();
    if (directAnalysis.candidates.length > 0) break;
  }
  directAnalysis ??= await scoreDirect();
  const directMs = Math.round(performance.now() - tDirect);
  const newlyLimited = countNewlyRateLimited(indexers);
  recordSearchLog("info", "grab_release.fallback_result", `${label} — recherche directe: ${directReleases.length} release(s) (${directMs}ms, titres: ${titles.join(" / ")})`, directMs);
  const topDirect = directAnalysis.candidates[0];
  if (!topDirect) {
    if (newlyLimited > 0) {
      recordSearchLog("warn", "grab_release.fallback_rate_limited", `${label} — 0 résultat : ${newlyLimited} indexeur(s) ont répondu 429 (rate-limité) pendant cette recherche, pas forcément "rien trouvé"`);
    } else {
      recordSearchLog("warn", "grab_release.no_match", `${label} — 0 candidat sur ${directReleases.length} directs (${directAnalysis.stages.map(([stage, count]) => `${stage}:${count}`).join(", ")})`);
    }
    return { ok: false, error: "no_match", totalReleases: releases.length + directReleases.length, diagnostic: newlyLimited > 0
      ? `${newlyLimited} indexeur(s) ont limité la recherche directe.`
      : grabRejectionDiagnostic(directAnalysis.stages.map(([stage, count]) => [stage === "mots interdits" && directAnalysis.blockedTerms.length ? `${stage} (${directAnalysis.blockedTerms.join(", ")})` : stage, count]), directReleases.length, directAnalysis.explain) };
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
  episodeTargets?: { season: number; episode: number }[],
  rejectMissingSeriesPack = false
) {
  const payload = await buildGrabPayload({
    magnetUrl: release.magnetUrl,
    downloadUrl: release.downloadUrl,
    indexerId: release.indexerId,
  });
  if ("error" in payload) return { error: "grab_failed" as const, detail: payload.error };
  try {
    const planned = await prepareBleachGrab(libraryRef, release.title, episodeTarget, episodeTargets);
    const single = planned.targets ? planned.single : withFanVersionTarget(libraryRef, planned.single);
    const multiple = planned.targets ? planned.multiple : withEpisodeTitles(libraryRef, planned.multiple);
    const res = await fetch(`${ENGINE_BASE}/torrents`, {
      method: "POST",
      headers: engineHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ ...payload, category, libraryRef, title, episodeTarget: single, episodeTargets: multiple, rejectMissingSeriesPack, autoPackReleaseTitle: rejectMissingSeriesPack ? release.title : undefined }),
      signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS),
    });
    const torrent = await res.json();
    if (!res.ok) return { error: "engine_rejected" as const, detail: torrent };
    if (torrent.state === "completed" && [single, ...(multiple ?? [])].some(t => t && "fanVersion" in t && t.fanVersion === true)) {
      return { error: "engine_rejected" as const, detail: "fankai_no_new_parts" };
    }
    // Téléchargement sans restriction : l'import ne doit pas rejeter le fichier sur un mot interdit.
    if (isUnrestricted() && typeof torrent.infoHash === "string") markManualGrab(torrent.infoHash);
    const ref = decodeLibraryRef(libraryRef);
    if (planned.targets && ref && ref.kind !== "movie") markBleachGrabTargets(ref.seriesId, torrent.infoHash, planned.targets);
    return { ok: true as const, torrent, coverage: planned.targets?.map(t => t.library!) };
  } catch (error) {
    return { error: "engine_unreachable" as const, detail: error instanceof Error ? error.message : "engine_unreachable" };
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
  if (series.tmdbId === BLEACH_TMDB_ID) series = getSeries(series.id) ?? series;
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
  if (series.tmdbId === BLEACH_TMDB_ID) series = getSeries(series.id) ?? series;
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
  const stored = getSeries(seriesId);
  if (!stored) return { error: "series not found" as const };
  const series = stored.tmdbId === BLEACH_TMDB_ID ? scopedBleachSeries(stored, seasonNumber === 17 ? "tybw" : "original") : stored;
  if (needsBleachRepair(series)) return { error: "bleach_repair_required" as const };
  if (series.tmdbId === BLEACH_TMDB_ID && !knownBleachEpisode(seasonNumber, episodeNumber)) return { error: "bleach_episode_unmapped" as const };
  const profile = profileFor(series.qualityProfileId);
  const media = createMediaRef("series", seriesId, series.tmdbId, series.title, seasonNumber, episodeNumber, undefined, undefined, series.posterPath);

  // Snapshot the season's missing episodes before flipping this one to
  // "searching" — otherwise it drops out of its own "missing" filter below.
  const season = series.seasons.find((s) => s.seasonNumber === seasonNumber);
  const missingInSeason = new Set(
    (season?.episodes ?? []).filter((e) => e.monitored && e.status === "missing" && (series.tmdbId !== BLEACH_TMDB_ID || bleachEpisodeInScope(seasonNumber, e.episodeNumber, undefined, seasonNumber === 17 ? bleachCourForEpisode(episodeNumber)?.part : undefined))).map((e) => e.episodeNumber)
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
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    recordSearchLog("error", "grab_episode.unhandled_error", `${series.title} S${seasonNumber}E${String(episodeNumber).padStart(2, "0")} — recherche interrompue : ${detail}`);
    return { error: "search_failed" as const, detail };
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
  // Les recherches groupées gèrent elles-mêmes les packs.
  if (!options?.skipPackRetry) {
    // Un pack de saison peut contenir les autres épisodes manquants.
    const pack = await tryGrabSeasonPack(series, seasonNumber, profile, missingEpisodeNumbers);
    if (pack && (series.tmdbId !== BLEACH_TMDB_ID || pack.coverage.includes(episodeNumber))) {
      setEpisodesStatus(series, seasonNumber, pack.coverage, { status: "downloading", activeInfoHash: pack.torrent.infoHash });
      void notifySeerrProcessingOnce("series", series.tmdbId).catch(() => {});
      logActivity("grabbed", "system", `${series.title} — saison ${seasonNumber} (${missingEpisodeNumbers.length} ép., via ${seasonNumber}x${String(episodeNumber).padStart(2, "0")})`, `/title/series/${series.tmdbId}`, {
        libraryRef: encodeLibraryRef({ kind: "season", seriesId, season: seasonNumber }),
        releaseTitle: pack.release.title,
        indexer: pack.release.indexerId,
        infoHash: pack.torrent.infoHash,
      });
      logSeriesGrabV2(series, "season", pack.release, pack.coverage.length, 1, seasonNumber);
      return { ok: true as const, release: pack.release, torrent: pack.torrent };
    }

    await new Promise<void>((resolve) => setTimeout(resolve, ITEM_DELAY_MS));
  }

  // Si aucun pack de saison ne convient, rechercher l'épisode seul.
  const single = await grabRelease(series, seasonNumber, episodeNumber, profile, false);
  if (single.ok) {
    // Same season-part translation as tryGrabSeasonPackImpl: a part release
    // (single-season series, DVD ordering) names its files in its own
    // numbering — the engine target must follow or no file is selected.
    const partPack = partPackInfo(series, parseRelease(single.release.title));
    let episodeTarget = { season: seasonNumber, episode: episodeNumber };
    const bleachSource = series.tmdbId === BLEACH_TMDB_ID ? bleachReleaseSource(single.release.title, seasonNumber, episodeNumber) : null;
    if (bleachSource) episodeTarget = { season: bleachSource.seasonNumber, episode: bleachSource.episodeNumber };
    if (partPack) {
      const k = episodeNumber - (partPack.partNumber - 1) * partPack.partSize;
      if (k >= 1 && k <= partPack.partSize) episodeTarget = { season: partPack.partNumber, episode: k };
    }
    const sent = await sendToEngine(
      single.release,
      "series",
      encodeLibraryRef({ kind: "episode", seriesId, season: seasonNumber, episode: episodeNumber }),
      series.title,
      episodeTarget,
      undefined,
      // Le contenu est lu dès les métadonnées : une release sans l'épisode est écartée
      // avant tout téléchargement et une autre est cherchée.
      true
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

  if (!options?.skipPackRetry && series.tmdbId !== BLEACH_TMDB_ID) {
    const fresh = getSeries(seriesId);
    if (fresh) {
      const seriesPack = await tryGrabSeriesPack(fresh, profile, new Set([seasonNumber]));
      if (seriesPack) {
        setMultiSeasonEpisodesStatus(fresh, groupTargetsBySeason(seriesPack.targets), { status: "downloading", activeInfoHash: seriesPack.torrent.infoHash });
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

    }
  }

  setEpisodeStatus(series, seasonNumber, episodeNumber, { status: "missing" });
  logActivityV2({
    kind: "failed",
    media,
    actor: "system",
    failure: createFailureRef(
      single.error === "no_indexers" ? "no_indexers" : "no_release_found",
      options?.skipPackRetry
        ? `Aucune release exploitable trouvée pour cet épisode. ${describeGrabFailure(single)}`
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
  const packResult = await grabRelease(series, seasonNumber, undefined, profile, true, missingEpisodeNumbers);
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
    episodeTargets,
    // Pack de saison : si aucun fichier ne correspond aux épisodes voulus, le pack est
    // écarté sur ses seules métadonnées, sans rien télécharger, puis une autre release est cherchée.
    true
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
    `${series.title} — Saison ${seasonNumber} récupérée (${sent.coverage?.length ?? missingEpisodeNumbers.length} ép.)`,
    `/title/series/${series.tmdbId}`,
    { title: series.title, season: seasonNumber, count: sent.coverage?.length ?? missingEpisodeNumbers.length }
  );
  return { release: packResult.release, torrent: sent.torrent, coverage: sent.coverage?.map(t => t.episode) ?? missingEpisodeNumbers };
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
  const key = `${series.id}-${seasonNumber}${series.tmdbId === BLEACH_TMDB_ID ? `-${missingEpisodeNumbers.join(",")}` : ""}`;
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
type SeasonSearchOptions = { skipSeriesPackRetry?: boolean; shouldCancel?: () => boolean; bleachPart?: number };
export async function searchAndGrabSeason(seriesId: string, seasonNumber: number, options?: SeasonSearchOptions) {
  const series = getSeries(seriesId);
  if (series?.tmdbId === BLEACH_TMDB_ID && seasonNumber === 17 && options?.bleachPart == null) {
    const results = [];
    for (const cour of BLEACH_TYBW_COURS) {
      if (options?.shouldCancel?.()) break;
      results.push(await searchAndGrabSeasonOne(seriesId, seasonNumber, { ...options, bleachPart: cour.part, skipSeriesPackRetry: true }));
    }
    return { ok: true as const, mode: "bleach_parts" as const, results };
  }
  return searchAndGrabSeasonOne(seriesId, seasonNumber, options);
}
async function searchAndGrabSeasonOne(
  seriesId: string,
  seasonNumber: number,
  options?: { skipSeriesPackRetry?: boolean; shouldCancel?: () => boolean; bleachPart?: number }
) {
  const stored = getSeries(seriesId);
  if (!stored) return { error: "series not found" as const };
  const series = stored.tmdbId === BLEACH_TMDB_ID ? scopedBleachSeries(stored, seasonNumber === 17 ? "tybw" : "original", options?.bleachPart) : stored;
  if (needsBleachRepair(series)) return { error: "bleach_repair_required" as const };
  const season = series.seasons.find((s) => s.seasonNumber === seasonNumber);
  if (!season) return { error: "season not found" as const };
  const profile = profileFor(series.qualityProfileId);

  const missing = season.episodes.filter((e) => e.monitored && e.status === "missing" && (series.tmdbId !== BLEACH_TMDB_ID || bleachEpisodeInScope(seasonNumber, e.episodeNumber, undefined, options?.bleachPart)));
  if (missing.length === 0) return { ok: true as const, skipped: "nothing missing" };

  setEpisodesStatus(series, seasonNumber, missing.map((e) => e.episodeNumber), { status: "searching" });

  // try/finally safety net — same contract as searchAndGrabEpisode: the
  // season-wide flip must come back to "missing" no matter what throws
  // inside the cascade (the per-episode fallback restores each episode it
  // touches, but any exception before that would leave the whole season
  // stuck on "searching" — see restoreStaleSeasonSearch).
  try {
    return await searchAndGrabSeasonCascade(series, seriesId, seasonNumber, profile, missing, options);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    recordSearchLog("error", "grab_season.unhandled_error", `${series.title} — saison ${seasonNumber} : recherche interrompue : ${detail}`);
    return { error: "search_failed" as const, detail };
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
  options?: { skipSeriesPackRetry?: boolean; shouldCancel?: () => boolean; bleachPart?: number }
) {
  // Chercher d’abord le pack de la saison demandée.
  const pack = await tryGrabSeasonPack(series, seasonNumber, profile, missing.map((e) => e.episodeNumber));
  if (pack) {
    if (series.tmdbId === BLEACH_TMDB_ID) setEpisodesStatus(series, seasonNumber, missing.filter(e => !pack.coverage.includes(e.episodeNumber)).map(e => e.episodeNumber), { status: "missing" });
    setEpisodesStatus(series, seasonNumber, pack.coverage, {
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
    logSeriesGrabV2(series, "season", pack.release, pack.coverage.length, 1, seasonNumber);
    if (missing.every((episode) => pack.coverage.includes(episode.episodeNumber))) {
      return { ok: true as const, mode: "pack" as const, release: pack.release, torrent: pack.torrent };
    }
  }

  // Real pause before moving to the per-episode fallback stage.
  await new Promise<void>((resolve) => setTimeout(resolve, ITEM_DELAY_MS));

  // Ensuite les épisodes un par un, sans répéter les recherches de packs.
  const perEpisode = [];
  for (const ep of missing) {
    if (pack?.coverage.includes(ep.episodeNumber)) continue;
    // Cancellation checkpoint between episodes — see searchAndGrabSeries's
    // season loop. Remaining episodes stay "missing" (restored by the
    // finally in searchAndGrabSeason) and are retried on a later run.
    if (options?.shouldCancel?.()) break;
    perEpisode.push(await searchAndGrabEpisode(seriesId, seasonNumber, ep.episodeNumber, { skipPackRetry: true }));
    await new Promise<void>((resolve) => setTimeout(resolve, ITEM_DELAY_MS));
  }
  // L’intégrale ne vise que les épisodes toujours manquants de cette saison.
  if (!options?.skipSeriesPackRetry && !options?.shouldCancel?.() && series.tmdbId !== BLEACH_TMDB_ID) {
    const fresh = getSeries(seriesId);
    if (fresh) {
      const seriesPack = await tryGrabSeriesPack(fresh, profile, new Set([seasonNumber]));
      if (seriesPack) {
        setMultiSeasonEpisodesStatus(fresh, groupTargetsBySeason(seriesPack.targets), { status: "downloading", activeInfoHash: seriesPack.torrent.infoHash });
        void notifySeerrProcessingOnce("series", fresh.tmdbId).catch(() => {});
        logSeriesGrabV2(fresh, "series", seriesPack.release, seriesPack.targets.length, new Set(seriesPack.targets.map(t => t.season)).size);
        return { ok: true as const, mode: "series_pack" as const, release: seriesPack.release, torrent: seriesPack.torrent };
      }
    }
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
      if (ep.monitored && (ep.status === "missing" || ep.status === "searching") && (series.tmdbId !== BLEACH_TMDB_ID || knownBleachEpisode(season.seasonNumber, ep.episodeNumber))) targets.push({ season: season.seasonNumber, episode: ep.episodeNumber });
    }
  }
  return targets;
}

/** Tous les épisodes suivis et sortis, spéciales exclues : la portée d'une intégrale qui remplace l'existant. */
function collectReplaceTargets(series: LibrarySeries): { season: number; episode: number }[] {
  const targets: { season: number; episode: number }[] = [];
  for (const season of series.seasons) {
    if (!season.monitored || season.seasonNumber <= 0) continue;
    for (const ep of season.episodes) if (ep.monitored && ep.status !== "upcoming") targets.push({ season: season.seasonNumber, episode: ep.episodeNumber });
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
  // Seulement quand le NOM porte vraiment une saison : le parseur Fan-Kai range en
  // saison 1 toute intégrale d'un titre finissant par « Kai » (Dragon Ball Kai,
  // Higurashi Kai…) sans que le nom en indique aucune — ce n'est pas un pack de saison.
  if (!range && parsedSeason != null && looksLikeSeriesRelease(rawTitle)) return false;

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
  seasonFilter?: Set<number>,
  replaceExisting = false
): Promise<{ candidates: CompleteSeriesCandidate[]; targets: { season: number; episode: number }[]; seasonCount: number; targetSeasons: number[] } | null> {
  if (needsBleachRepair(series)) return null;
  const seasonCount = series.seasons.filter((s) => s.seasonNumber > 0 && s.monitored).length;
  // Mode « remplacer » : la couverture se juge sur tous les épisodes suivis (hors Spéciales), pas
  // seulement sur ceux qui manquent. Sans cela, une série déjà complète n'offrait aucune intégrale.
  const targets = (replaceExisting && series.tmdbId !== BLEACH_TMDB_ID ? collectReplaceTargets(series) : collectMissingTargets(series))
    .filter((t) => !seasonFilter || seasonFilter.has(t.season));
  if (targets.length === 0) return null;
  const targetSeasons = [...new Set(targets.map((t) => t.season))];
  // Same original-title preference (and non-Latin-script guard) as
  // grabRelease — see pickSearchTitle's own comment.
  const requireYear = seriesNeedsReleaseYear(series, loadSeries());
  const searchTitle = pickSearchTitle(series.title, series.originalTitle);
  const searchAliases = [series.title, series.originalTitle ?? "", ...(series.aliases ?? [])].filter(Boolean);
  const directTitles = seriesSearchTitles(series);

  const t0 = performance.now();
  const releases = searchFromCache(TV_CATEGORY_IDS);
  const cacheMs = Math.round(performance.now() - t0);
  const rules = loadReleaseRules();
  recordSearchLog("debug", "series_pack.cache_read", `${series.title} (${seasonCount} saisons) — cache RSS donne ${releases.length} release(s) (${cacheMs}ms)`, cacheMs);

  const tS = performance.now();
  const candidates: CompleteSeriesCandidate[] = releases
    .map((r) => ({ release: r, parsed: parseRelease(r.title) }))
    .filter(({ release }) => series.tmdbId !== BLEACH_TMDB_ID || bleachReleaseTargets(targets, release.title).length === targets.length)
    .filter(({ parsed }) => releaseTitleMatches(parsed.title, searchTitle, searchAliases))
    // A same-titled reboot/remake from a different year (e.g. Avatar: The
    // Last Airbender 2005 animated vs. 2024 live-action) has an identical
    // title — with no season/episode numbers to disambiguate an intégrale
    // (unlike a regular episode/season search), title similarity alone can
    // never tell them apart. Known library homonyms require an explicit debut
    // year; unrelated series keep the existing year tolerance.
    .filter(({ parsed }) => series.tmdbId === BLEACH_TMDB_ID || seriesYearIsCompatible(parsed.year, releaseYearTarget(series), requireYear))
    .filter(({ release, parsed }) => series.tmdbId === BLEACH_TMDB_ID ? bleachCompletePackCovers(release.title, targets) : isCompleteSeriesPackTitle(release.title, seasonCount, targetSeasons, parsed.episode, parsed.season))
    // Decision Guard: a blocked term is a hard veto here — no score, however high, can rescue a release an admin explicitly forbade.
    .filter(({ release }) => !isBlockedForAutoGrab(release.title, rules, series.title).blocked)
    .filter(({ parsed }) => !parsed.resolution || profile.allowedResolutions.includes(parsed.resolution))
    .filter(({ release }) => release.score >= profile.minScore)
    .filter(({ release }) => withinSizeLimit(release.size, "series"))
    .filter(({ release }) => !isRecentlyFailedSeriesPack(series.id, release))
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
    const directReleases: IndexerRelease[] = [];
    let directCandidates: CompleteSeriesCandidate[] = [];
    for (const directTitle of series.tmdbId === BLEACH_TMDB_ID ? [searchTitle] : directTitles) {
      for (const ix of indexers) {
        directReleases.push(...await searchCompleteSeriesPack(ix, { title: directTitle, seasonCount }, TV_CATEGORY_IDS).catch(() => [] as IndexerRelease[]));
      }
      directCandidates = directReleases
        .map((r) => ({ release: r, parsed: parseRelease(r.title) }))
        .filter(({ release }) => series.tmdbId !== BLEACH_TMDB_ID || bleachReleaseTargets(targets, release.title).length === targets.length)
        .filter(({ parsed }) => releaseTitleMatches(parsed.title, searchTitle, searchAliases))
    // A same-titled reboot/remake from a different year (e.g. Avatar: The
    // Last Airbender 2005 animated vs. 2024 live-action) has an identical
    // title — with no season/episode numbers to disambiguate an intégrale
    // (unlike a regular episode/season search), title similarity alone can
    // never tell them apart. Known library homonyms require an explicit debut
    // year; unrelated series keep the existing year tolerance.
    .filter(({ parsed }) => series.tmdbId === BLEACH_TMDB_ID || seriesYearIsCompatible(parsed.year, releaseYearTarget(series), requireYear))
    .filter(({ release, parsed }) => series.tmdbId === BLEACH_TMDB_ID ? bleachCompletePackCovers(release.title, targets) : isCompleteSeriesPackTitle(release.title, seasonCount, targetSeasons, parsed.episode, parsed.season))
    .filter(({ release }) => !isBlockedForAutoGrab(release.title, rules, series.title).blocked)
      .filter(({ parsed }) => !parsed.resolution || profile.allowedResolutions.includes(parsed.resolution))
      .filter(({ release }) => release.score >= profile.minScore)
      .filter(({ release }) => withinSizeLimit(release.size, "series"))
      .filter(({ release }) => !isRecentlyFailedSeriesPack(series.id, release))
        .sort(compareCompletePackCandidates);
      if (directCandidates.length > 0) break;
    }
    const directMs = Math.round(performance.now() - tDirect);
    const newlyLimited = countNewlyRateLimited(indexers);
    recordSearchLog("info", "series_pack.fallback_result", `${series.title} — recherche directe: ${directReleases.length} release(s) (${directMs}ms, titres: ${directTitles.join(" / ")})`, directMs);
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
    targets,
    true
  );
  if (!("ok" in sent)) {
    const detail = JSON.stringify(sent.detail);
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
  return { release: top.release, torrent: sent.torrent, targets: sent.coverage ?? targets };
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
 * Search each monitored season and its missing episodes before trying an
 * integral for the remaining targets. Serialized per series.
 */
export async function searchAndGrabCompleteSeries(seriesId: string, part?: BleachSeriesPart | null) {
  return withSearchLock(`series:${seriesId}`, async () => {
    const stored = getSeries(seriesId);
    if (!stored) return { error: "series not found" as const };
    const series = stored.tmdbId === BLEACH_TMDB_ID ? scopedBleachSeries(stored, part) : stored;
    if (needsBleachRepair(series)) return { error: "bleach_repair_required" as const };
    const profile = profileFor(series.qualityProfileId);

    const targets = collectMissingTargets(series);
    if (targets.length === 0) return { ok: true as const, skipped: "nothing missing" };


    // One integral search after all seasons avoids repeating it per season.
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
    const current = getSeries(seriesId);
    const fresh = current?.tmdbId === BLEACH_TMDB_ID ? scopedBleachSeries(current, part) : current;
    if (fresh) {
      const seriesPack = await tryGrabSeriesPack(fresh, profile);
      if (seriesPack) {
        setMultiSeasonEpisodesStatus(fresh, groupTargetsBySeason(seriesPack.targets), { status: "downloading", activeInfoHash: seriesPack.torrent.infoHash });
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

    }
    return { ok: true as const, mode: "per_season" as const, results };
  });
}

/**
 * Search every monitored season that still has missing episodes — the "search
 * whole series" / "rechercher les manquants" action: season packs, then
 * individual episodes, then a single integral for any remaining targets.
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
  options?: { onSeasonDone?: () => void; shouldCancel?: () => boolean; seriesPart?: BleachSeriesPart }
) {
  return withSearchLock(`series:${seriesId}`, async () => {
    const stored = getSeries(seriesId);
    if (!stored) return { error: "series not found" as const };
    const series = stored.tmdbId === BLEACH_TMDB_ID ? scopedBleachSeries(stored, options?.seriesPart) : stored;
    if (needsBleachRepair(series)) return { error: "bleach_repair_required" as const };
    const profile = profileFor(series.qualityProfileId);

    const monitoredEpisodes = series.seasons.filter((s) => s.monitored).flatMap((s) => s.episodes.filter((e) => e.monitored));
    const missingCount = monitoredEpisodes.filter((e) => e.status === "missing").length;
    if (missingCount === 0) return { ok: true as const, results: [] };

    const results = [];
    // Rechercher l'intégrale une seule fois après les saisons.
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
    const current = getSeries(seriesId);
    const fresh = current?.tmdbId === BLEACH_TMDB_ID ? scopedBleachSeries(current, options?.seriesPart) : current;
    if (fresh && !options?.shouldCancel?.()) {
      const seriesPack = series.tmdbId === BLEACH_TMDB_ID && series.seasons.some(s => s.seasonNumber === 17) ? null : await tryGrabSeriesPack(fresh, profile);
      if (seriesPack) {
        setMultiSeasonEpisodesStatus(fresh, groupTargetsBySeason(seriesPack.targets), { status: "downloading", activeInfoHash: seriesPack.torrent.infoHash });
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
 * undated TBA can never "air"). seasonEpisodeStatuses() additionally keeps
 * any later undated episode "upcoming" as long as an earlier one in the same
 * season still is — without it, this daily pass would flip an episode like
 * #6 (no date) back to "missing" even though #4/#5 (dated, unaired) haven't
 * released yet, which can't be true chronologically.
 */
export function transitionUpcomingEpisodes() {
  const transitioned: string[] = [];
  for (const series of loadSeries()) {
    let changed = false;
    const seasons = series.seasons.map((season) => {
      const seasonTargets = seasonEpisodeStatuses(season.episodes);
      const episodes = season.episodes.map((ep) => {
        if (ep.status !== "upcoming" && ep.status !== "missing") return ep;
        const target = seasonTargets.get(ep.episodeNumber) ?? episodeStatus(ep.airDate, ep.title);
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
    await yieldToUser("recherche épisodes récents");
    await withSearchLock(`series:${series.id}`, async () => {
      // Re-derive from fresh state: an earlier pass on this series (bulk job,
      // manual button) may have grabbed some of it while we waited on the
      // lock — re-searching what it just grabbed would be pure wasted load.
      const current = stillMissingFromFresh(series.id, seasons);
      if (!current) return;
      const { series: fresh, seasons: freshSeasons } = current;
      const profile = profileFor(fresh.qualityProfileId);

      // Pack de saison, puis épisodes individuels.
      for (const [seasonNumber, episodeNumbers] of freshSeasons) {
        const pack = await tryGrabSeasonPack(fresh, seasonNumber, profile, episodeNumbers);
        if (pack) {
          setEpisodesStatus(fresh, seasonNumber, pack.coverage, {
            status: "downloading",
            activeInfoHash: pack.torrent.infoHash,
          });
          void notifySeerrProcessingOnce("series", fresh.tmdbId).catch(() => {});
          for (const episodeNumber of pack.coverage) searched.push(`${fresh.id}.${seasonNumber}.${episodeNumber}`);
        }
        for (const episodeNumber of episodeNumbers) {
          if (pack?.coverage.includes(episodeNumber)) continue;
          await searchAndGrabEpisode(fresh.id, seasonNumber, episodeNumber, { skipPackRetry: true });
          searched.push(`${fresh.id}.${seasonNumber}.${episodeNumber}`);
          await new Promise<void>((resolve) => setTimeout(resolve, ITEM_DELAY_MS));
        }
      }
      const remaining = getSeries(fresh.id);
      if (remaining) {
        // Les autres saisons ne font pas partie de cette recherche.
        const seriesPack = await tryGrabSeriesPack(remaining, profile, new Set(freshSeasons.keys()));
        if (seriesPack) {
          setMultiSeasonEpisodesStatus(remaining, groupTargetsBySeason(seriesPack.targets), {
            status: "downloading",
            activeInfoHash: seriesPack.torrent.infoHash,
          });
          void notifySeerrProcessingOnce("series", fresh.tmdbId).catch(() => {});
          for (const [seasonNumber, episodeNumbers] of freshSeasons) {
            for (const episodeNumber of episodeNumbers) searched.push(`${fresh.id}.${seasonNumber}.${episodeNumber}`);
          }
          return;
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

  // Every season with a missing monitored episode, across the whole library.
  // The season budget is applied AFTER the shuffle below: counting it during
  // this walk (every season of every monitored series, complete or not, in
  // library order) meant only the first few series of the library were ever
  // retried.
  for (const series of loadSeries()) {
    if (!series.monitored) continue;
    for (const season of series.seasons) {
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
    }
  }
  const activeKeys = new Set([...bySeries.keys()].map((id) => `series:${id}`));

  // Series this retry already searched in vain wait 1 then 3 days (see
  // missingSearchBackoff.ts) — the RSS scan still grabs them meanwhile.
  // Randomize series order so the same shows don't get re-searched every pass.
  const due = [...bySeries.values()].filter(({ series }) => isDueForRetry(`series:${series.id}`));
  for (let i = due.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [due[i], due[j]] = [due[j], due[i]];
  }
  const entries: typeof due = [];
  let seasonCount = 0;
  for (const entry of due) {
    if (seasonCount >= maxSeasons) break;
    const budget = maxSeasons - seasonCount;
    const seasons = new Map([...entry.seasons].slice(0, budget));
    entries.push({ series: entry.series, seasons });
    seasonCount += seasons.size;
  }

  const tick = trackJobProgress(entries.length);
  for (const { series, seasons } of entries) {
    tick();
    await yieldToUser("recherche épisodes manquants");
    await withSearchLock(`series:${series.id}`, async () => {
      // Re-derive from fresh state: an earlier pass on this series (bulk job,
      // manual button) may have grabbed some of it while we waited on the
      // lock — re-searching what it just grabbed would be pure wasted load.
      const current = stillMissingFromFresh(series.id, seasons);
      if (!current) return;
      const { series: fresh, seasons: freshSeasons } = current;
      const profile = profileFor(fresh.qualityProfileId);

      // Pack de saison, puis épisodes individuels.
      for (const [seasonNumber, episodeNumbers] of freshSeasons) {
        const pack = await trackOp<Awaited<ReturnType<typeof tryGrabSeasonPack>>>(`relance pack : ${fresh.title} S${seasonNumber}`, () => tryGrabSeasonPack(fresh, seasonNumber, profile, episodeNumbers));
        if (pack) {
          setEpisodesStatus(fresh, seasonNumber, pack.coverage, {
            status: "downloading",
            activeInfoHash: pack.torrent.infoHash,
          });
          void notifySeerrProcessingOnce("series", fresh.tmdbId).catch(() => {});
          for (const episodeNumber of pack.coverage) searched.push(`${fresh.id}.${seasonNumber}.${episodeNumber}`);
        }
        for (const episodeNumber of episodeNumbers) {
          if (pack?.coverage.includes(episodeNumber)) continue;
          await trackOp(`relance épisode : ${fresh.title} S${seasonNumber}E${episodeNumber}`, () => searchAndGrabEpisode(fresh.id, seasonNumber, episodeNumber, { skipPackRetry: true }));
          searched.push(`${fresh.id}.${seasonNumber}.${episodeNumber}`);
          await new Promise<void>((resolve) => setTimeout(resolve, ITEM_DELAY_MS));
        }
      }
      const remaining = getSeries(fresh.id);
      if (remaining) {
        // Intégrale limitée aux saisons du budget (seasonFilter) :
        //    l'engine ne sélectionne que les fichiers de ces saisons.
        const seasonFilter = new Set(freshSeasons.keys());
        const seriesPack = await trackOp(`relance intégrale : ${fresh.title}`, () => tryGrabSeriesPack(remaining, profile, seasonFilter));
        if (seriesPack) {
          setMultiSeasonEpisodesStatus(remaining, groupTargetsBySeason(seriesPack.targets), {
            status: "downloading",
            activeInfoHash: seriesPack.torrent.infoHash,
          });
          void notifySeerrProcessingOnce("series", fresh.tmdbId).catch(() => {});
          for (const [seasonNumber, episodeNumbers] of freshSeasons) {
            for (const episodeNumber of episodeNumbers) searched.push(`${fresh.id}.${seasonNumber}.${episodeNumber}`);
          }
          return;
        }

      }

    });
  }

  // One more attempt for every series whose searched seasons are still
  // missing something after this pass.
  const stillMissing = entries
    .filter(({ series, seasons }) => {
      const fresh = getSeries(series.id);
      return !!fresh?.seasons.some((s) => seasons.has(s.seasonNumber) && s.episodes.some((e) => e.monitored && e.status === "missing"));
    })
    .map(({ series }) => `series:${series.id}`);
  recordRetryPass("series:", stillMissing, activeKeys);

  return { searched };
}
