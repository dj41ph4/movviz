import fs from "node:fs";
import path from "node:path";
import { loadMovies, loadSeries, updateMovies, updateSeriesList } from "./store";
import { parseRelease } from "@/lib/naming/parser";
import { titleSimilarity } from "./matching";
import { engineRoots } from "./indexScan";
import { pathFor } from "./renamePath";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import type { LibraryMovie, LibrarySeries } from "./types";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const STATE_FILE = path.join(CONFIG_DIR, "disk-scan-state.json");
const VIDEO_EXT = /\.(mkv|mp4|avi|ts|m2ts)$/i;
const MATCH_THRESHOLD = 0.8;

export interface DiskScanResult {
  scanned: number;
  matched: number;
  updated: number;
}

export interface DiskScanState {
  lastScanAt: number | null;
  lastFullScanAt: number | null;
}

export function getScanState(): DiskScanState {
  return readJsonCached<DiskScanState>(STATE_FILE, { lastScanAt: null, lastFullScanAt: null });
}

function saveScanState(patch: Partial<DiskScanState>) {
  const state = getScanState();
  writeJsonCached(STATE_FILE, { ...state, ...patch });
}

function parentFolderMatches(folderName: string, targetTitle: string): boolean {
  if (titleSimilarity(folderName, targetTitle) >= MATCH_THRESHOLD) return true;
  const parsed = parseRelease(folderName);
  if (parsed.title && titleSimilarity(parsed.title, targetTitle) >= MATCH_THRESHOLD) return true;
  return false;
}

function findMovieMatch(parentDir: string, folderName: string, movies: LibraryMovie[]): string | null {
  for (const movie of movies) {
    if (!movie.file) continue;
    if (parentFolderMatches(folderName, movie.title)) return movie.id;
  }
  return null;
}

interface SeriesEpisodeMatch {
  seriesId: string;
  season: number;
  episode: number;
}

function findSeriesMatch(parentDir: string, folderName: string, fileName: string, seriesList: LibrarySeries[]): SeriesEpisodeMatch | null {
  for (const s of seriesList) {
    if (!parentFolderMatches(folderName, s.title)) continue;
    const parsed = parseRelease(fileName);
    if (parsed.season != null && parsed.episode != null) {
      return { seriesId: s.id, season: parsed.season, episode: parsed.episode };
    }
    const parentParsed = parseRelease(folderName);
    if (parentParsed.season != null && parentParsed.episode != null) {
      return { seriesId: s.id, season: parentParsed.season, episode: parentParsed.episode };
    }
  }
  return null;
}

interface SeriesEpisodePatch {
  season: number;
  episode: number;
  diskPath: string;
}

function walkVideoFiles(root: string): string[] {
  try {
    const p = pathFor(root);
    const entries = fs.readdirSync(root, { recursive: true, withFileTypes: false }) as unknown as string[];
    return entries
      .map((rel) => p.normalize(p.join(root, String(rel))))
      .filter((full) => {
        if (!VIDEO_EXT.test(full)) return false;
        try { return fs.statSync(full).isFile(); } catch { return false; }
      });
  } catch {
    return [];
  }
}

async function runScan(sinceMs?: number): Promise<DiskScanResult> {
  let scanned = 0;
  let matched = 0;
  let updated = 0;

  const [movieRoots, seriesRoots] = await Promise.all([
    engineRoots("movie").catch(() => [] as string[]),
    engineRoots("series").catch(() => [] as string[]),
  ]);
  const allRoots = [...new Set([...movieRoots, ...seriesRoots])];
  if (allRoots.length === 0) return { scanned: 0, matched: 0, updated: 0 };

  const movies = loadMovies();
  const seriesList = loadSeries();

  const moviePatches = new Map<string, Partial<LibraryMovie>>();
  const seriesEpisodePatches = new Map<string, SeriesEpisodePatch[]>();

  for (const root of allRoots) {
    const videoFiles = walkVideoFiles(root);
    for (const filePath of videoFiles) {
      scanned++;
      if (sinceMs != null) {
        try {
          const stat = fs.statSync(filePath);
          if (stat.mtimeMs <= sinceMs) continue;
        } catch {
          continue;
        }
      }

      const pp = pathFor(filePath);
      const parentDir = pp.dirname(filePath);
      const folderName = pp.basename(parentDir);
      const fileName = pp.basename(filePath);

      const movieId = findMovieMatch(parentDir, folderName, movies);
      if (movieId) {
        matched++;
        const movie = movies.find((m) => m.id === movieId);
        if (movie?.file && !movie.file.diskPath) {
          moviePatches.set(movieId, { file: { ...movie.file, diskPath: filePath } });
          updated++;
        }
        continue;
      }

      const seriesMatch = findSeriesMatch(parentDir, folderName, fileName, seriesList);
      if (seriesMatch) {
        matched++;
        const s = seriesList.find((s) => s.id === seriesMatch.seriesId);
        if (s) {
          const ep = s.seasons
            .find((se) => se.seasonNumber === seriesMatch.season)
            ?.episodes.find((e) => e.episodeNumber === seriesMatch.episode);
          if (ep?.file && !ep.file.diskPath) {
            const key = `${seriesMatch.season}-${seriesMatch.episode}`;
            const existing = seriesEpisodePatches.get(seriesMatch.seriesId) ?? [];
            if (!existing.some((p) => p.season === seriesMatch.season && p.episode === seriesMatch.episode)) {
              existing.push({ season: seriesMatch.season, episode: seriesMatch.episode, diskPath: filePath });
              seriesEpisodePatches.set(seriesMatch.seriesId, existing);
              updated++;
            }
          }
        }
      }
    }
  }

  if (moviePatches.size > 0) updateMovies(moviePatches);

  if (seriesEpisodePatches.size > 0) {
    const seriesPatches = new Map<string, Partial<LibrarySeries>>();
    for (const [seriesId, patches] of seriesEpisodePatches) {
      const s = seriesList.find((s) => s.id === seriesId);
      if (!s) continue;
      const newSeasons = s.seasons.map((season) => ({
        ...season,
        episodes: season.episodes.map((ep) => {
          const patch = patches.find((p) => p.season === ep.seasonNumber && p.episode === ep.episodeNumber);
          if (patch && ep.file) {
            return { ...ep, file: { ...ep.file, diskPath: patch.diskPath } };
          }
          return ep;
        }),
      }));
      seriesPatches.set(seriesId, { seasons: newSeasons });
    }
    updateSeriesList(seriesPatches);
  }

  const now = Date.now();
  if (sinceMs == null) {
    saveScanState({ lastScanAt: now, lastFullScanAt: now });
  } else {
    saveScanState({ lastScanAt: now });
  }

  return { scanned, matched, updated };
}

export async function fullDiskScan(): Promise<DiskScanResult> {
  return runScan();
}

export async function incrementalDiskScan(): Promise<DiskScanResult> {
  const state = getScanState();
  return runScan(state.lastScanAt ?? void 0);
}
