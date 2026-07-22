import fs from "node:fs";
import { ENGINE_BASE, engineHeaders, ENGINE_TIMEOUT_MS } from "@/lib/engine/server";
import { loadMovies, loadSeries, getMovieByTmdbId, getSeriesByTmdbId } from "@/lib/library/store";
import { parseRelease } from "@/lib/naming/parser";
import { searchMovies, searchTv } from "@/lib/metadata/tmdb";
import { mapWithConcurrency } from "@/lib/concurrency";
import { enqueueJob, getJobsByType, isSourceActive } from "@/lib/jobs/queue";
import { trashRoots } from "@/lib/library/trashStore";
import { pathFor } from "@/lib/library/renamePath";
import type { Job } from "@/lib/jobs/types";

export const VIDEO_EXT = /\.(mkv|mp4|avi|ts|m2ts|m4v)$/i;

export interface IndexMatch {
  tmdbId: number;
  title: string;
  year: number | null;
  posterPath: string | null;
  /** Already tracked elsewhere in the Movviz library — importing links into that entry instead of creating a duplicate. */
  existing: boolean;
}

export interface IndexCandidate {
  /** Stable id derived from the folder path — safe to round-trip through the API/URL. */
  id: string;
  folderPath: string;
  folderName: string;
  match: IndexMatch | null;
  fileCount: number;
}

function encodeCandidateId(folderPath: string): string {
  return Buffer.from(folderPath, "utf8").toString("base64url");
}
export function decodeCandidateId(id: string): string {
  return Buffer.from(id, "base64url").toString("utf8");
}

export function walkVideoFiles(dir: string): string[] {
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

function trackedMoviePaths(): Set<string> {
  const set = new Set<string>();
  for (const m of loadMovies()) if (m.file) set.add(pathFor(m.file.path).normalize(m.file.path));
  return set;
}
function trackedSeriesPaths(): Set<string> {
  const set = new Set<string>();
  for (const s of loadSeries()) for (const season of s.seasons) for (const ep of season.episodes) if (ep.file) set.add(pathFor(ep.file.path).normalize(ep.file.path));
  return set;
}

/** A trashed file isn't "untracked" — it's deliberately awaiting purge, not a candidate to re-import. */
function isInTrash(p: string): boolean {
  const pp = pathFor(p);
  const norm = pp.normalize(p).toLowerCase();
  return trashRoots().some((root) => {
    const rp = pathFor(root);
    const r = rp.normalize(root).toLowerCase();
    return norm === r || norm.startsWith(r.endsWith(rp.sep) ? r : r + rp.sep);
  });
}

export async function engineRoots(category: "movie" | "series"): Promise<string[]> {
  const instances = await fetch(`${ENGINE_BASE}/instances`, {
    headers: engineHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS),
  })
    .then((r) => (r.ok ? r.json() : { instances: [] }))
    .then((d) => d.instances ?? [])
    .catch(() => []);
  return (instances as { category: string; completedPath: string }[])
    .filter((i) => i.category === category)
    .map((i) => i.completedPath)
    .filter(Boolean);
}

/** Untracked movie folders (or loose video files) directly under the movie library root(s). */
async function findMovieCandidates(): Promise<{ folderPath: string; folderName: string; fileCount: number }[]> {
  const tracked = trackedMoviePaths();
  const roots = await engineRoots("movie");
  const out: { folderPath: string; folderName: string; fileCount: number }[] = [];

  for (const root of roots) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = pathFor(root).join(root, entry.name);
      if (isInTrash(full)) continue;
      if (entry.isDirectory()) {
        const videos = walkVideoFiles(full);
        if (videos.length === 0) continue;
        const primary = [...videos].sort((a, b) => fs.statSync(b).size - fs.statSync(a).size)[0];
        if (tracked.has(primary)) continue;
        out.push({ folderPath: full, folderName: entry.name, fileCount: videos.length });
      } else if (VIDEO_EXT.test(entry.name)) {
        if (tracked.has(full)) continue;
        out.push({ folderPath: full, folderName: entry.name.replace(VIDEO_EXT, ""), fileCount: 1 });
      }
    }
  }
  return out;
}

/** Series folders with at least one video file not yet linked to any tracked episode. */
async function findSeriesCandidates(): Promise<{ folderPath: string; folderName: string; fileCount: number }[]> {
  const tracked = trackedSeriesPaths();
  const roots = await engineRoots("series");
  const out: { folderPath: string; folderName: string; fileCount: number }[] = [];

  for (const root of roots) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(root, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const full = pathFor(root).join(root, entry.name);
      if (isInTrash(full)) continue;
      const videos = walkVideoFiles(full);
      const untracked = videos.filter((v) => !tracked.has(v));
      if (untracked.length === 0) continue;
      out.push({ folderPath: full, folderName: entry.name, fileCount: untracked.length });
    }
  }
  return out;
}

async function matchMovie(folderName: string): Promise<IndexMatch | null> {
  const parsed = parseRelease(folderName);
  const query = parsed.title.trim();
  if (!query) return null;
  const { results } = await searchMovies(query);
  if (results.length === 0) return null;
  const year = parsed.year ? Number(parsed.year) : null;
  const best = (year ? results.find((r) => r.year === year) : null) ?? results[0];
  return {
    tmdbId: best.tmdbId,
    title: best.title,
    year: best.year,
    posterPath: best.posterPath,
    existing: getMovieByTmdbId(best.tmdbId) != null,
  };
}

async function matchSeries(folderName: string): Promise<IndexMatch | null> {
  const parsed = parseRelease(folderName);
  const query = parsed.title.trim();
  if (!query) return null;
  const { results } = await searchTv(query);
  if (results.length === 0) return null;
  const year = parsed.year ? Number(parsed.year) : null;
  const best = (year ? results.find((r) => r.year === year) : null) ?? results[0];
  return {
    tmdbId: best.tmdbId,
    title: best.title,
    year: best.year,
    posterPath: best.posterPath,
    existing: getSeriesByTmdbId(best.tmdbId) != null,
  };
}

const g = globalThis as typeof globalThis & {
  __movvizIndexScan?: { movie: IndexCandidate[]; series: IndexCandidate[] };
};
const state = (g.__movvizIndexScan ??= { movie: [], series: [] });

export function getIndexCandidates(type: "movie" | "series"): IndexCandidate[] {
  return state[type];
}

export function isIndexScanRunning(type: "movie" | "series"): boolean {
  return isSourceActive(`indexScan-${type}`);
}

export function getLatestIndexScanJob(type: "movie" | "series"): Job | null {
  return getJobsByType("libraryIndex").find((j) => j.sourceId === `indexScan-${type}`) ?? null;
}

/** Scans the library root(s) for the given type and matches each untracked folder against TMDb — runs as a background job (many TMDb lookups). */
export function startIndexScan(type: "movie" | "series"): Job {
  return enqueueJob(
    "libraryIndex",
    type === "movie" ? "Indexation des films" : "Indexation des séries",
    1,
    async (setProgress) => {
      const found = type === "movie" ? await findMovieCandidates() : await findSeriesCandidates();
      setProgress(0, found.length);
      let done = 0;
      const candidates = await mapWithConcurrency(found, 3, async (f) => {
        const match = type === "movie" ? await matchMovie(f.folderName) : await matchSeries(f.folderName);
        done++;
        setProgress(done, found.length);
        const candidate: IndexCandidate = {
          id: encodeCandidateId(f.folderPath),
          folderPath: f.folderPath,
          folderName: f.folderName,
          match,
          fileCount: f.fileCount,
        };
        return candidate;
      });
      state[type] = candidates;
    },
    `indexScan-${type}`
  );
}
