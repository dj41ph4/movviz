import { loadPlexConfig, savePlexConfig } from "./store";
import { loadSyncState, saveSyncState } from "./syncState";
import { getLibrarySections, getSectionItems, getShowEpisodes, getServerIdentity, refreshSection, batchTmdbIds } from "./client";
import type { PlexServerConfig, PlexSection, PlexLibraryItem } from "./types";
import {
  getMovieByTmdbId, addMovie, updateMovie,
  getSeriesByTmdbId, addSeries, updateSeries,
} from "@/lib/library/store";
import { defaultQualityProfile } from "@/lib/library/qualityProfiles";
import type { LibraryFile, LibraryMovie, LibrarySeason, LibraryEpisode } from "@/lib/library/types";
import { getMovie as fetchTmdbMovie, getSeries as fetchTmdbSeries, getSeason as fetchTmdbSeason } from "@/lib/metadata/tmdb";

// A run does hundreds of sequential awaited TMDb/Plex calls, so two overlapping
// triggers (manual + scheduled, or a double click) would otherwise interleave
// and both see "not in library yet" for the same title, creating duplicates.
let syncInFlight = false;

/**
 * Match/import a real Plex library into Movviz — an "import existing"
 * root-folder scan: anything already in Movviz's library
 * gets confirmed available (with the real file path/size/resolution Plex
 * reports), and anything Plex has that Movviz doesn't know about gets
 * created directly as available (no search/grab — it's already on disk).
 * Never downgrades an existing "available" entry, so a legitimate fresh grab
 * that Plex hasn't scanned yet is left alone.
 *
 * Incremental by default (a "recently added" poll) — only scans
 * items Plex has touched (added or updated, e.g. a newly aired episode)
 * since the last run, instead of re-walking the whole library every time.
 * Pass `force: true` for a one-off full rescan (e.g. after fixing a bug).
 */
export async function syncPlexLibrary(opts?: { force?: boolean }) {
  const cfg = loadPlexConfig();
  if (!cfg.hostname || !cfg.adminToken) return null;
  if (syncInFlight) return { moviesAdded: 0, moviesMatched: 0, seriesAdded: 0, seriesMatched: 0, alreadyRunning: true as const };
  syncInFlight = true;

  try {
    if (!cfg.machineIdentifier) {
      const machineIdentifier = await getServerIdentity(cfg);
      if (machineIdentifier) savePlexConfig({ ...cfg, machineIdentifier });
    }
    return await runSync(cfg, cfg.adminToken, !!opts?.force);
  } finally {
    syncInFlight = false;
  }
}

async function runSync(cfg: PlexServerConfig, adminToken: string, force: boolean) {
  const sections = await getLibrarySections(cfg, adminToken);
  const state = loadSyncState();
  const runStartedAt = Math.floor(Date.now() / 1000);
  let moviesAdded = 0, moviesMatched = 0, seriesAdded = 0, seriesMatched = 0;

  const moviesSince = force ? undefined : state.moviesLastSyncedAt || undefined;
  for (const section of sections.filter((s) => s.type === "movie")) {
    const r = await syncMovieSection(cfg, adminToken, section, moviesSince);
    moviesAdded += r.added;
    moviesMatched += r.matched;
  }

  const seriesSince = force ? undefined : state.seriesLastSyncedAt || undefined;
  for (const section of sections.filter((s) => s.type === "show")) {
    const r = await syncShowSection(cfg, adminToken, section, seriesSince);
    seriesAdded += r.added;
    seriesMatched += r.matched;
  }

  // After the main sync pass, backfill plexMediaInfo for any movie that has
  // a plexRatingKey but no media detail yet. The incremental sync only
  // processes recently-changed items, so older movies never get their media
  // info populated until a full reconcile runs.
  await backfillMissingMediaInfo(cfg, adminToken);

  saveSyncState({ moviesLastSyncedAt: runStartedAt, seriesLastSyncedAt: runStartedAt });
  return { moviesAdded, moviesMatched, seriesAdded, seriesMatched };
}

function toLibraryFile(plex: PlexLibraryItem): LibraryFile | null {
  if (!plex.file) return null;
  return {
    path: plex.file.path,
    quality: plex.file.resolution ?? "",
    resolution: plex.file.resolution,
    videoCodec: plex.videoCodec,
    audioCodec: plex.audioCodec,
    hdr: plex.hdr,
    source: null,
    size: plex.file.size,
    addedAt: Date.now(),
  };
}

/**
 * Backfills plexMediaInfo for every library movie that has a plexRatingKey
 * but no media detail yet. The incremental sync only processes recently-
 * changed Plex items, so older movies never get their stream/chapter/container
 * data populated until a full reconcile runs. This fills the gap cheaply by
 * batching ratingKeys through the existing metadata endpoint.
 */
async function backfillMissingMediaInfo(cfg: PlexServerConfig, token: string) {
  const { getMovieByTmdbId, loadMovies, updateMovie } = await import("@/lib/library/store");
  const missing = loadMovies().filter((m) => m.plexRatingKey && !m.plexMediaInfo);
  if (missing.length === 0) return;
  const keys = missing.map((m) => m.plexRatingKey!).filter(Boolean);
  const unique = [...new Set(keys)];
  const infos = await batchTmdbIds(cfg, token, unique);
  for (const movie of missing) {
    if (!movie.plexRatingKey) continue;
    const info = infos.get(movie.plexRatingKey);
    if (info?.mediaDetail) {
      updateMovie(movie.id, { plexMediaInfo: info.mediaDetail });
    }
  }
}

async function syncMovieSection(cfg: PlexServerConfig, token: string, section: PlexSection, since: number | undefined) {
  const items = await getSectionItems(cfg, section.key, token, { sinceUnixSeconds: since });
  let added = 0, matched = 0;

  for (const item of items) {
    if (item.tmdbId == null) continue;
    const file = toLibraryFile(item);
    const existing = getMovieByTmdbId(item.tmdbId);

    if (existing) {
      const patch: Partial<LibraryMovie> = {};
      if (existing.status !== "available") patch.status = "available";
      if (file) patch.file = file;
      if (!existing.plexRatingKey) patch.plexRatingKey = item.ratingKey;
      if (item.mediaDetail) patch.plexMediaInfo = item.mediaDetail;
      if (Object.keys(patch).length > 0) {
        updateMovie(existing.id, patch);
        matched++;
      }
      continue;
    }

    const meta = await fetchTmdbMovie(item.tmdbId);
    if (!meta) continue;
    const movie: LibraryMovie = {
      id: `mv_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      tmdbId: meta.tmdbId,
      imdbId: meta.imdbId,
      title: meta.title,
      year: meta.year,
      releaseDate: meta.releaseDate,
      vfReleaseDate: meta.vfReleaseDate,
      overview: meta.overview,
      posterPath: meta.posterPath,
      backdropPath: meta.backdropPath,
      rating: meta.rating,
      runtime: meta.runtime,
      genres: meta.genres,
      monitored: true,
      qualityProfileId: defaultQualityProfile().id,
      status: "available",
      file,
      activeInfoHash: null,
      addedAt: Date.now(),
      tags: ["plex"],
      plexRatingKey: item.ratingKey,
      plexMediaInfo: item.mediaDetail ?? null,
      tmdbCollectionId: meta.collectionId,
    };
    addMovie(movie);
    added++;
  }

  return { added, matched };
}

async function syncShowSection(cfg: PlexServerConfig, token: string, section: PlexSection, since: number | undefined) {
  const shows = await getSectionItems(cfg, section.key, token, { sinceUnixSeconds: since });
  let added = 0, matched = 0;

  for (const show of shows) {
    if (show.tmdbId == null) continue;
    const episodes = await getShowEpisodes(cfg, show.ratingKey, token);
    const existing = getSeriesByTmdbId(show.tmdbId);

    if (!existing) {
      const meta = await fetchTmdbSeries(show.tmdbId);
      if (!meta) continue;
      const seasons: LibrarySeason[] = [];
      for (const s of meta.seasons) {
        const detail = await fetchTmdbSeason(show.tmdbId, s.seasonNumber);
        const eps: LibraryEpisode[] = (detail?.episodes ?? []).map((e) => {
          const plexEp = episodes.find((pe) => pe.seasonNumber === e.seasonNumber && pe.episodeNumber === e.episodeNumber);
          return {
            seasonNumber: e.seasonNumber,
            episodeNumber: e.episodeNumber,
            title: e.title,
            airDate: e.airDate,
            monitored: true,
            status: plexEp ? "available" : "missing",
            file: plexEp ? toLibraryFile(plexEp) : null,
            activeInfoHash: null,
            plexRatingKey: plexEp?.ratingKey ?? null,
          };
        });
        seasons.push({ seasonNumber: s.seasonNumber, name: s.name, monitored: true, episodes: eps });
      }
      addSeries({
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
        qualityProfileId: defaultQualityProfile().id,
        seasons,
        addedAt: Date.now(),
        tags: ["plex"],
        plexRatingKey: show.ratingKey,
      });
      added++;
      continue;
    }

    let changed = false;
    if (!existing.plexRatingKey) changed = true;
    const newSeasons = existing.seasons.map((season) => ({
      ...season,
      episodes: season.episodes.map((ep) => {
        if (ep.status === "available" && ep.plexRatingKey) return ep;
        const plexEp = episodes.find((pe) => pe.seasonNumber === season.seasonNumber && pe.episodeNumber === ep.episodeNumber);
        if (!plexEp) return ep;
        changed = true;
        return { ...ep, status: "available" as const, file: toLibraryFile(plexEp) ?? ep.file, plexRatingKey: plexEp.ratingKey };
      }),
    }));
    if (changed) {
      updateSeries(existing.id, { seasons: newSeasons, plexRatingKey: existing.plexRatingKey ?? show.ratingKey });
      matched++;
    }
  }

  return { added, matched };
}

/**
 * Tell Plex to rescan its movie/show sections right after a fresh grab lands
 * in the library folder, instead of waiting for Plex's own scan interval
 * (which can be minutes to hours) to notice it. Best-effort and
 * fire-and-forget by design — a slow or unreachable Plex server should never
 * hold up the import callback that triggers this.
 */
export async function refreshPlexLibraryFor(kind: "movie" | "tv"): Promise<void> {
  const cfg = loadPlexConfig();
  if (!cfg.hostname || !cfg.adminToken) return;
  const sections = await getLibrarySections(cfg, cfg.adminToken);
  const targetType = kind === "movie" ? "movie" : "show";
  await Promise.all(
    sections.filter((s) => s.type === targetType).map((s) => refreshSection(cfg, cfg.adminToken!, s.key))
  );
}
