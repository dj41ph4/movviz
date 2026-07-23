import fs from "node:fs";
import { pathFor } from "@/lib/library/renamePath";
import {
  getMovieByTmdbId, addMovie, updateMovie,
  getSeriesByTmdbId, addSeries, updateSeries,
} from "@/lib/library/store";
import { defaultQualityProfile } from "@/lib/library/qualityProfiles";
import type { LibraryMovie, LibraryFile, LibrarySeries, LibrarySeason, LibraryEpisode } from "@/lib/library/types";
import { parseRelease } from "@/lib/naming/parser";
import { getMovie as fetchTmdbMovie, getSeries as fetchTmdbSeries, getSeason as fetchTmdbSeason } from "@/lib/metadata/tmdb";
import { decodeCandidateId } from "@/lib/library/indexScan";
import { enqueueJob, getJobsByType, isSourceActive } from "@/lib/jobs/queue";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { Job } from "@/lib/jobs/types";
import { notifySeerrStatus } from "@/lib/seerr/mediaMap";

const VIDEO_EXT = /\.(mkv|mp4|avi|ts|m2ts)$/i;

function walkVideoFiles(dir: string): string[] {
  try {
    const p = pathFor(dir);
    const entries = fs.readdirSync(dir, { recursive: true, withFileTypes: false }) as unknown as string[];
    return entries
      .map((rel) => p.normalize(p.join(dir, String(rel))))
      .filter((full) => VIDEO_EXT.test(full) && fs.existsSync(full) && fs.statSync(full).isFile());
  } catch {
    return [];
  }
}

function buildFile(filePath: string): LibraryFile {
  const parsed = parseRelease(pathFor(filePath).basename(filePath));
  const quality = [parsed.source, parsed.resolution].filter(Boolean).join(" ") || "—";
  return {
    path: filePath,
    quality,
    resolution: parsed.resolution,
    videoCodec: parsed.videoCodec,
    audioCodec: parsed.audioCodec,
    hdr: parsed.hdr,
    source: parsed.source,
    size: fs.statSync(filePath).size,
    addedAt: Date.now(),
  };
}

export type IndexImportResult =
  | { ok: true; kind: "movie" | "series"; id: string }
  | { ok: false; error: string };

export async function importMovieCandidate(
  candidateId: string,
  tmdbId: number,
  qualityProfileId: string | undefined,
  monitored: boolean
): Promise<IndexImportResult> {
  const folderPath = decodeCandidateId(candidateId);
  const stat = fs.existsSync(folderPath) ? fs.statSync(folderPath) : null;
  if (!stat) return { ok: false, error: "folder_not_found" };

  const videos = stat.isDirectory() ? walkVideoFiles(folderPath) : VIDEO_EXT.test(folderPath) ? [folderPath] : [];
  if (videos.length === 0) return { ok: false, error: "no_video_file" };
  const primary = [...videos].sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
  const file = buildFile(primary);

  const existing = getMovieByTmdbId(tmdbId);
  if (existing) {
    updateMovie(existing.id, { status: "available", file, monitored });
    void notifySeerrStatus("movie", tmdbId, "available").catch(() => {});
    return { ok: true, kind: "movie", id: existing.id };
  }

  const meta = await fetchTmdbMovie(tmdbId);
  if (!meta) return { ok: false, error: "movie not found on TMDb" };

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
    monitored,
    qualityProfileId: qualityProfileId ?? defaultQualityProfile().id,
    status: "available",
    file,
    activeInfoHash: null,
    addedAt: Date.now(),
    tags: [],
    plexRatingKey: null,
    plexMediaInfo: null,
    tmdbCollectionId: meta.collectionId,
  };
  addMovie(movie);
  void notifySeerrStatus("movie", tmdbId, "available").catch(() => {});
  return { ok: true, kind: "movie", id: movie.id };
}

export async function importSeriesCandidate(
  candidateId: string,
  tmdbId: number,
  qualityProfileId: string | undefined,
  monitored: boolean
): Promise<IndexImportResult> {
  const folderPath = decodeCandidateId(candidateId);
  if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) return { ok: false, error: "folder_not_found" };

  const videos = walkVideoFiles(folderPath);
  // season -> episode -> file, from whatever season/episode markers the filenames carry (SxxExx, 1x01, …).
  const byEpisode = new Map<string, string>();
  for (const v of videos) {
    const parsed = parseRelease(pathFor(v).basename(v));
    if (parsed.season == null || parsed.episode == null) continue; // ambiguous — left for a later reconciliation pass
    byEpisode.set(`${parsed.season}.${parsed.episode}`, v);
  }
  if (byEpisode.size === 0) return { ok: false, error: "no_episode_files" };

  const existing = getSeriesByTmdbId(tmdbId);
  if (existing) {
    const seasons = existing.seasons.map((season) => ({
      ...season,
      episodes: season.episodes.map((ep) => {
        const match = byEpisode.get(`${season.seasonNumber}.${ep.episodeNumber}`);
        return match ? { ...ep, status: "available" as const, file: buildFile(match) } : ep;
      }),
    }));
    updateSeries(existing.id, { seasons, monitored });
    return { ok: true, kind: "series", id: existing.id };
  }

  const meta = await fetchTmdbSeries(tmdbId);
  if (!meta) return { ok: false, error: "series not found on TMDb" };

  const seasonNumbers = [...new Set([...byEpisode.keys()].map((k) => Number(k.split(".")[0])))];
  const seasons: LibrarySeason[] = [];
  for (const s of meta.seasons.filter((s) => s.seasonNumber > 0)) {
    const detail = await fetchTmdbSeason(tmdbId, s.seasonNumber);
    const episodes: LibraryEpisode[] = (detail?.episodes ?? []).map((e) => {
      const match = byEpisode.get(`${e.seasonNumber}.${e.episodeNumber}`);
      return {
        seasonNumber: e.seasonNumber,
        episodeNumber: e.episodeNumber,
        title: e.title,
        airDate: e.airDate,
        monitored: true,
        status: match ? ("available" as const) : ("missing" as const),
        file: match ? buildFile(match) : null,
        activeInfoHash: null,
        plexRatingKey: null,
      };
    });
    seasons.push({ seasonNumber: s.seasonNumber, name: s.name, monitored: seasonNumbers.includes(s.seasonNumber), episodes });
  }

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
    monitored,
    qualityProfileId: qualityProfileId ?? defaultQualityProfile().id,
    seasons,
    addedAt: Date.now(),
    tags: [],
    plexRatingKey: null,
  };
  addSeries(series);
  return { ok: true, kind: "series", id: series.id };
}

export interface IndexImportItem {
  candidateId: string;
  tmdbId: number;
}

const g = globalThis as typeof globalThis & {
  __movvizIndexImport?: { movie: IndexImportResult[]; series: IndexImportResult[] };
};
const importState = (g.__movvizIndexImport ??= { movie: [], series: [] });

export function getIndexImportResults(type: "movie" | "series"): IndexImportResult[] {
  return importState[type];
}
export function isIndexImportRunning(type: "movie" | "series"): boolean {
  return isSourceActive(`indexImport-${type}`);
}
export function getLatestIndexImportJob(type: "movie" | "series"): Job | null {
  return getJobsByType("libraryIndex").find((j) => j.sourceId === `indexImport-${type}`) ?? null;
}

/** Links the selected on-disk candidates into the library — background job since series metadata fetches (one TMDb call per season) add up for a large batch. */
export function startIndexImport(
  type: "movie" | "series",
  items: IndexImportItem[],
  qualityProfileId: string | undefined,
  monitored: boolean
): Job {
  return enqueueJob(
    "libraryIndex",
    type === "movie" ? `Import de ${items.length} film(s)` : `Import de ${items.length} série(s)`,
    items.length,
    async (setProgress) => {
      let done = 0;
      const results = await mapWithConcurrency(items, 3, async (item) => {
        const result =
          type === "movie"
            ? await importMovieCandidate(item.candidateId, item.tmdbId, qualityProfileId, monitored)
            : await importSeriesCandidate(item.candidateId, item.tmdbId, qualityProfileId, monitored);
        done++;
        setProgress(done, items.length);
        return result;
      });
      importState[type] = results;
    },
    `indexImport-${type}`
  );
}
