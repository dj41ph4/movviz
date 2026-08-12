import fs from "node:fs";
import { loadPlexConfig, savePlexConfig } from "./store";
import { loadSyncState, saveSyncState } from "./syncState";
import { getLibrarySections, getSectionItems, getShowEpisodes, getServerIdentity, refreshSection, batchTmdbIds } from "./client";
import type { PlexServerConfig, PlexSection, PlexLibraryItem } from "./types";
import {
  getMovieByTmdbId, addMovie, updateMovie, updateMovies, loadMovies,
  getSeriesByTmdbId, addSeries, updateSeries, loadSeries,
} from "@/lib/library/store";
import { defaultQualityProfile } from "@/lib/library/qualityProfiles";
import type { LibraryFile, LibraryFileVersion, LibraryMovie, LibrarySeason, LibraryEpisode } from "@/lib/library/types";
import { episodeStatus } from "@/lib/library/releaseSchedule";
import { detectFileLanguage } from "@/lib/library/detectLanguage";
import { getMovie as fetchTmdbMovie, getSeries as fetchTmdbSeries, getSeason as fetchTmdbSeason } from "@/lib/metadata/tmdb";
import { commonSuffixDepth, splitAtSuffixDepth } from "@/lib/library/pathSuffix";
import { learnPathMapping, applyLearnedPathMapping } from "./pathMappingStore";

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

  const seenMovieTmdbIds = new Set<number>();
  const moviesSince = force ? undefined : state.moviesLastSyncedAt || undefined;
  for (const section of sections.filter((s) => s.type === "movie")) {
    const r = await syncMovieSection(cfg, adminToken, section, moviesSince, seenMovieTmdbIds);
    moviesAdded += r.added;
    moviesMatched += r.matched;
  }

  const seenSeriesTmdbIds = new Set<number>();
  const seriesSince = force ? undefined : state.seriesLastSyncedAt || undefined;
  for (const section of sections.filter((s) => s.type === "show")) {
    const r = await syncShowSection(cfg, adminToken, section, seriesSince, seenSeriesTmdbIds);
    seriesAdded += r.added;
    seriesMatched += r.matched;
  }

  // Full reconcile: mark items missing if Plex no longer has them
  if (force) {
    markMissingFromPlex(seenMovieTmdbIds, seenSeriesTmdbIds);
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
  const raw: LibraryFile = {
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
  raw.language = detectFileLanguage(raw, plex.mediaDetail);
  return raw;
}

/**
 * Reconciles a tracked file's recorded path against what Plex reports for
 * the SAME library entry — this is what protects a working, Movviz-owned
 * path from being clobbered by Plex's own filesystem view (separate
 * containers, different volume mounts for the same physical media).
 *
 * When the existing path still verifies on disk, Plex's raw report is only
 * ever used to LEARN a prefix mapping (via the shared suffix-match logic
 * repairPaths.ts already uses) — never to overwrite directly. Every write
 * of a translated path, existing or brand-new, is gated on
 * `fs.existsSync(mapped)` first: a wrong or stale mapping must never
 * silently store a path to nothing — the worst acceptable outcome is a
 * false "missing" flag in Réparer les chemins, recoverable by hand.
 */
export function reconcileFilePath(existingPath: string | null | undefined, plexPath: string): string {
  const existingVerified = !!existingPath && fs.existsSync(existingPath);

  if (existingVerified && existingPath !== plexPath) {
    const depth = commonSuffixDepth(existingPath!, plexPath);
    if (depth > 0) {
      const { prefix: movvizPrefix } = splitAtSuffixDepth(existingPath!, depth);
      const { prefix: plexPrefix } = splitAtSuffixDepth(plexPath, depth);
      learnPathMapping(plexPrefix, movvizPrefix);
    }
  }

  if (existingVerified) {
    const mapped = applyLearnedPathMapping(plexPath);
    if (mapped !== existingPath && fs.existsSync(mapped)) return mapped;
    return existingPath!;
  }

  // Fresh Plex-only item (never downloaded by Movviz itself, e.g. a plain
  // library import) — apply any mapping already learned from other titles,
  // but only if the translated path itself verifies; an unverified guess is
  // worse than storing Plex's raw (unmapped) path, today's exact behavior.
  const mapped = applyLearnedPathMapping(plexPath);
  if (mapped !== plexPath && fs.existsSync(mapped)) return mapped;
  return plexPath;
}

function toLibraryFileReconciled(plex: PlexLibraryItem, existingPath: string | null | undefined): LibraryFile | null {
  const file = toLibraryFile(plex);
  if (!file) return null;
  file.path = reconcileFilePath(existingPath, file.path);
  return file;
}

/**
 * Merges Plex's `mediaVersions` (LOT6.4 — one entry per `<Media>` Plex
 * reports for this item) into the movie's own `versions[]`, matched by
 * `path` so a version Movviz already knows about keeps its id/history
 * instead of being recreated. A path Plex no longer lists but Movviz still
 * has is KEPT (never deleted) — same caution as the rest of the sync
 * (Plex's incremental response only ever covers recently-changed items,
 * never a full "this is everything" snapshot). Two versions are only ever
 * merged under the SAME tmdbId — this never creates a second library entry.
 */
function stripVersionFields(v: LibraryFileVersion): LibraryFile {
  const { id: _id, versionSource: _versionSource, reason: _reason, primary: _primary, ...file } = v;
  return file;
}

function mergePlexVersions(existing: LibraryMovie, item: PlexLibraryItem): { file: LibraryFile; versions?: LibraryFileVersion[] } | null {
  if (!item.mediaVersions || item.mediaVersions.length === 0) return null;

  const priorByPath = new Map<string, LibraryFileVersion>();
  for (const v of existing.versions ?? []) priorByPath.set(v.path, v);
  if (existing.versions === undefined && existing.file) priorByPath.set(existing.file.path, { ...existing.file, id: "legacy_primary", versionSource: "unknown", reason: "Acquisition initiale", primary: true });

  const versions: LibraryFileVersion[] = item.mediaVersions.map((v, i) => {
    // Look up by the raw Plex path first (matches today's behavior when no
    // mapping has been learned yet), falling back to the mapped path so a
    // version stored translated in a previous run is still recognized.
    const mappedRawPath = applyLearnedPathMapping(v.file.path);
    const prior = priorByPath.get(v.file.path) ?? priorByPath.get(mappedRawPath);
    priorByPath.delete(v.file.path);
    priorByPath.delete(mappedRawPath);
    const resolvedPath = reconcileFilePath(prior?.path, v.file.path);
    const versionLang = prior?.language ?? (i === 0 && item.mediaDetail
      ? detectFileLanguage({
          path: v.file.path,
          quality: v.file.resolution ?? prior?.quality ?? "",
          resolution: v.file.resolution,
          videoCodec: v.videoCodec,
          audioCodec: v.audioCodec,
          hdr: v.hdr,
          source: prior?.source ?? null,
          size: v.file.size,
          addedAt: prior?.addedAt ?? Date.now(),
        } as LibraryFile, item.mediaDetail)
      : undefined);
    return {
      path: resolvedPath,
      quality: v.file.resolution ?? prior?.quality ?? "",
      resolution: v.file.resolution,
      videoCodec: v.videoCodec,
      audioCodec: v.audioCodec,
      hdr: v.hdr,
      source: prior?.source ?? null,
      size: v.file.size,
      addedAt: prior?.addedAt ?? Date.now(),
      language: versionLang,
      id: prior?.id ?? `plex_${item.ratingKey}_${i}`,
      versionSource: "plex",
      reason: prior?.reason ?? (i === 0 ? "Détecté via Plex" : "Version supplémentaire détectée via Plex"),
      primary: i === 0,
    };
  });

  // Anything left in priorByPath is a version Plex's response didn't mention
  // this time around — kept, demoted to non-primary since Plex's index 0 wins.
  for (const leftover of priorByPath.values()) versions.push({ ...leftover, primary: false });

  const primaryEntry = versions.find((v) => v.primary) ?? versions[0];
  return { file: stripVersionFields(primaryEntry), versions };
}

/**
 * Backfills plexMediaInfo for every library movie that has a plexRatingKey
 * but no media detail yet. The incremental sync only processes recently-
 * changed Plex items, so older movies never get their stream/chapter/container
 * data populated until a full reconcile runs. This fills the gap cheaply by
 * batching ratingKeys through the existing metadata endpoint.
 */
async function backfillMissingMediaInfo(cfg: PlexServerConfig, token: string) {
  const { getMovieByTmdbId, loadMovies, updateMovies } = await import("@/lib/library/store");
  const missing = loadMovies().filter((m) => m.plexRatingKey && !m.plexMediaInfo);
  if (missing.length === 0) return;
  const keys = missing.map((m) => m.plexRatingKey!).filter(Boolean);
  const unique = [...new Set(keys)];
  const infos = await batchTmdbIds(cfg, token, unique);
  const patches = new Map<string, Partial<LibraryMovie>>();
  for (const movie of missing) {
    if (!movie.plexRatingKey) continue;
    const info = infos.get(movie.plexRatingKey);
    if (info?.mediaDetail) {
      const patch: Partial<LibraryMovie> & { file?: Partial<LibraryFile> } = { plexMediaInfo: info.mediaDetail };
      if (movie.file) {
        const lang = detectFileLanguage(movie.file, info.mediaDetail);
        if (lang) patch.file = { ...movie.file, language: lang };
      }
      patches.set(movie.id, patch as Partial<LibraryMovie>);
    }
  }
  if (patches.size > 0) {
    updateMovies(patches);
  }
}

async function syncMovieSection(cfg: PlexServerConfig, token: string, section: PlexSection, since: number | undefined, seenTmdbIds: Set<number>) {
  const items = await getSectionItems(cfg, section.key, token, { sinceUnixSeconds: since });
  let added = 0, matched = 0;

  for (const item of items) {
    if (item.tmdbId == null) continue;
    seenTmdbIds.add(item.tmdbId);
    const existing = getMovieByTmdbId(item.tmdbId);
    const file = toLibraryFileReconciled(item, existing?.file?.path);

    if (existing) {
      const patch: Partial<LibraryMovie> = {};
      if (existing.status !== "available") patch.status = "available";
      const merged = mergePlexVersions(existing, item);
      if (merged) {
        patch.file = merged.file;
        patch.versions = merged.versions;
      } else if (file) {
        patch.file = file;
      }
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

    // Brand-new movie with several Plex Media entries already at add time —
    // no prior version history to preserve, just build versions[] directly.
    const initialVersions: LibraryFileVersion[] | undefined = item.mediaVersions?.length
      ? item.mediaVersions.map((v, i) => {
          const base = {
            path: reconcileFilePath(null, v.file.path),
            quality: v.file.resolution ?? "",
            resolution: v.file.resolution,
            videoCodec: v.videoCodec,
            audioCodec: v.audioCodec,
            hdr: v.hdr,
            source: null,
            size: v.file.size,
            addedAt: Date.now(),
            language: undefined as string | null | undefined,
            id: `plex_${item.ratingKey}_${i}`,
            versionSource: "plex" as const,
            reason: i === 0 ? "Détecté via Plex" : "Version supplémentaire détectée via Plex",
            primary: i === 0,
          };
          if (i === 0 && item.mediaDetail) {
            base.language = detectFileLanguage(base as LibraryFile, item.mediaDetail);
          }
          return base as LibraryFileVersion;
        })
      : undefined;

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
      file: initialVersions ? stripVersionFields(initialVersions[0]) : file,
      versions: initialVersions,
      activeInfoHash: null,
      addedAt: Date.now(),
      tags: ["plex"],
      plexRatingKey: item.ratingKey,
      plexMediaInfo: item.mediaDetail ?? null,
      tmdbCollectionId: meta.collectionId,
      originalTitle: meta.originalTitle,
    };
    addMovie(movie);
    added++;
  }

  return { added, matched };
}

async function syncShowSection(cfg: PlexServerConfig, token: string, section: PlexSection, since: number | undefined, seenTmdbIds: Set<number>) {
  const shows = await getSectionItems(cfg, section.key, token, { sinceUnixSeconds: since });
  let added = 0, matched = 0;

  for (const show of shows) {
    if (show.tmdbId == null) continue;
    seenTmdbIds.add(show.tmdbId);
    const episodes = await getShowEpisodes(cfg, show.ratingKey, token);
    const existing = getSeriesByTmdbId(show.tmdbId);

    if (!existing) {
      const meta = await fetchTmdbSeries(show.tmdbId);
      if (!meta) continue;
      const seasons: LibrarySeason[] = [];
      for (const s of meta.seasons) {
        // Same opt-in-by-default rule as every other series-creation path —
        // specials (season 0) start unmonitored, regular seasons unaffected.
        const monitoredByDefault = s.seasonNumber !== 0;
        const detail = await fetchTmdbSeason(show.tmdbId, s.seasonNumber);
        const eps: LibraryEpisode[] = (detail?.episodes ?? []).map((e) => {
          const plexEp = episodes.find((pe) => pe.seasonNumber === e.seasonNumber && pe.episodeNumber === e.episodeNumber);
          return {
            seasonNumber: e.seasonNumber,
            episodeNumber: e.episodeNumber,
            title: e.title,
            airDate: e.airDate,
            monitored: monitoredByDefault,
            status: plexEp ? "available" : episodeStatus(e.airDate, e.title),
            file: plexEp ? toLibraryFileReconciled(plexEp, null) : null,
            activeInfoHash: null,
            plexRatingKey: plexEp?.ratingKey ?? null,
          };
        });
        seasons.push({ seasonNumber: s.seasonNumber, name: s.name, monitored: monitoredByDefault, episodes: eps });
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
        originalTitle: meta.originalTitle,
      });
      added++;
      continue;
    }

    let changed = false;
    if (!existing.plexRatingKey) changed = true;

    // First pass: detect changes without deep-cloning the whole episode tree.
    // Also flag episodes whose language hasn't been set yet.
    let needsLanguageBackfill = false;
    if (!changed) {
      for (const season of existing.seasons) {
        for (const ep of season.episodes) {
          const plexEp = episodes.find((pe) => pe.seasonNumber === season.seasonNumber && pe.episodeNumber === ep.episodeNumber);
          if (plexEp) {
            if (ep.status !== "available" || !ep.plexRatingKey) { changed = true; break; }
            if (ep.file && ep.file.language === undefined) needsLanguageBackfill = true;
          } else {
            if (ep.status === "available" || ep.file || ep.plexRatingKey) { changed = true; break; }
          }
        }
        if (changed) break;
      }
    }

    if (changed || needsLanguageBackfill) {
      const newSeasons = existing.seasons.map((season) => ({
        ...season,
        episodes: season.episodes.map((ep) => {
          const plexEp = episodes.find((pe) => pe.seasonNumber === season.seasonNumber && pe.episodeNumber === ep.episodeNumber);
          if (plexEp) {
            if (ep.status !== "available" || !ep.plexRatingKey || (ep.file && ep.file.language === undefined)) {
              return { ...ep, status: "available" as const, file: toLibraryFileReconciled(plexEp, ep.file?.path) ?? ep.file, plexRatingKey: plexEp.ratingKey };
            }
            return ep;
          }
          if (ep.status === "available" || ep.file || ep.plexRatingKey) {
            return { ...ep, status: episodeStatus(ep.airDate, ep.title), file: null, activeInfoHash: null, plexRatingKey: null };
          }
          return ep;
        }),
      }));
      updateSeries(existing.id, { seasons: newSeasons, plexRatingKey: existing.plexRatingKey ?? show.ratingKey });
      matched++;
    }
  }

  return { added, matched };
}

/**
 * Full-reconcile step: find movies & series that Movviz knows from Plex but
 * Plex no longer reports at all (deleted from disk). Mark their episodes as
 * missing instead of showing stale "available" counts.  Never removes the
 * series/movie record — the user keeps their history, monitoring and tags.
 */
function markMissingFromPlex(seenMovieTmdbIds: Set<number>, seenSeriesTmdbIds: Set<number>) {
  for (const movie of loadMovies()) {
    if (movie.plexRatingKey && !seenMovieTmdbIds.has(movie.tmdbId)) {
      updateMovie(movie.id, {
        status: "missing",
        file: null,
        activeInfoHash: null,
        plexRatingKey: null,
        plexMediaInfo: null,
      });
    }
  }

  for (const series of loadSeries()) {
    if (series.plexRatingKey && !seenSeriesTmdbIds.has(series.tmdbId)) {
      const newSeasons = series.seasons.map((s) => ({
        ...s,
        episodes: s.episodes.map((ep) => ({
          ...ep,
          status: "missing" as const,
          file: null,
          activeInfoHash: null,
          plexRatingKey: null,
        })),
      }));
      updateSeries(series.id, { seasons: newSeasons, plexRatingKey: null });
    }
  }
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
