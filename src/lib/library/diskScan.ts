import fs from "node:fs";
import path from "node:path";
import { loadMovies, loadSeries, updateMovies, updateSeriesList } from "./store";
import { parseRelease } from "@/lib/naming/parser";
import { titleSimilarity } from "./matching";
import { engineRoots } from "./indexScan";
import { pathFor } from "./renamePath";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import type { LibraryMovie, LibrarySeries } from "./types";
import { mapWithConcurrency } from "@/lib/concurrency";
import { yieldToEventLoop } from "@/lib/jobs/cancelScope";

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

// Parcours ASYNCHRONE : la version précédente (readdirSync récursif + deux
// statSync par fichier vidéo, sans aucune pause) figeait tout le serveur le
// temps de parcourir la bibliothèque sur le NAS, toutes les heures.
const STAT_CONCURRENCY = 8;
/** Pause toutes les N comparaisons de titres (boucle CPU synchrone sinon). */
const MATCH_YIELD_EVERY = 50;

interface VideoFile {
  path: string;
  mtimeMs: number;
}

async function walkVideoFiles(root: string): Promise<VideoFile[]> {
  try {
    const p = pathFor(root);
    const entries = (await fs.promises.readdir(root, { recursive: true })) as string[];
    const videos = entries
      .filter((rel) => VIDEO_EXT.test(String(rel)))
      .map((rel) => p.normalize(p.join(root, String(rel))));
    // Un seul stat par fichier : sert à la fois à vérifier que c'est un
    // fichier et à lire sa date de modification.
    const stats = await mapWithConcurrency(videos, STAT_CONCURRENCY, async (full) => {
      try {
        const st = await fs.promises.stat(full);
        return st.isFile() ? { path: full, mtimeMs: st.mtimeMs } : null;
      } catch {
        return null;
      }
    });
    return stats.filter((v): v is VideoFile => v != null);
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

  // Fichiers déjà rattachés à un titre : rien à faire pour eux (le
  // rapprochement ne fait que remplir un diskPath manquant), inutile de les
  // comparer à toute la bibliothèque.
  const knownPaths = new Set<string>();
  for (const m of movies) if (m.file?.diskPath) knownPaths.add(m.file.diskPath);
  for (const s of seriesList) for (const se of s.seasons) for (const ep of se.episodes) if (ep.file?.diskPath) knownPaths.add(ep.file.diskPath);

  let compared = 0;
  for (const root of allRoots) {
    const videoFiles = await walkVideoFiles(root);
    for (const { path: filePath, mtimeMs } of videoFiles) {
      scanned++;
      if (sinceMs != null && mtimeMs <= sinceMs) continue;
      if (knownPaths.has(filePath)) continue;
      if (++compared % MATCH_YIELD_EVERY === 0) await yieldToEventLoop();

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
