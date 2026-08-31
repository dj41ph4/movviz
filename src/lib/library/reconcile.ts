import fs from "node:fs";
import { loadMovies, loadSeries, pruneMovies, pruneSeries } from "@/lib/library/store";
import type { LibraryMovie, LibrarySeries, LibraryStatus } from "@/lib/library/types";
import { ENGINE_BASE, engineHeaders, ENGINE_TIMEOUT_MS } from "@/lib/engine/server";
import { trashRoots } from "@/lib/library/trashStore";
import { pathFor } from "@/lib/library/renamePath";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";

const VIDEO_EXT = /\.(mkv|mp4|avi|ts|m2ts)$/i;

function walk(dir: string): string[] {
  try {
    return fs.readdirSync(dir, { recursive: true, withFileTypes: false }) as unknown as string[];
  } catch {
    return [];
  }
}

export interface RescanIssue {
  kind: "missing" | "untracked" | "duplicate";
  path: string;
}

const STATUS_RANK: Record<LibraryStatus, number> = { available: 4, downloading: 3, searching: 2, missing: 1, upcoming: 0 };

/**
 * Merges library entries that share the same tmdbId — should never happen
 * given addMovie()/addSeries() both guard against it at creation time, but a
 * duplicate can still exist from data created before that guard, or from a
 * gap in some other add path. Keeps the "best" entry (available beats
 * downloading beats searching beats missing beats upcoming; a real file
 * beats none; oldest addedAt as the final tiebreak — the one the user has
 * had longest) and silently drops the rest via pruneMovies/pruneSeries
 * (no Trash entry — nothing was actually deleted, the title just collapses
 * back into a single entry).
 */
function mergeDuplicateMovies(): RescanIssue[] {
  const movies = loadMovies();
  const byTmdbId = new Map<number, LibraryMovie[]>();
  for (const m of movies) {
    const list = byTmdbId.get(m.tmdbId) ?? [];
    list.push(m);
    byTmdbId.set(m.tmdbId, list);
  }

  const toRemove = new Set<string>();
  const issues: RescanIssue[] = [];
  for (const [tmdbId, dups] of byTmdbId) {
    if (dups.length < 2) continue;
    const sorted = [...dups].sort((a, b) =>
      (STATUS_RANK[b.status] - STATUS_RANK[a.status]) || (Number(!!b.file) - Number(!!a.file)) || (a.addedAt - b.addedAt)
    );
    const [keep, ...drop] = sorted;
    for (const d of drop) toRemove.add(d.id);
    issues.push({ kind: "duplicate", path: `movie:${tmdbId} "${keep.title}" — ${drop.length} doublon(s) fusionné(s)` });
    recordSearchLog("info", "reconcile.duplicate_movie_merged", `${keep.title} (tmdbId ${tmdbId}) — ${drop.length} entrée(s) en double fusionnée(s), conservé: ${keep.id} (${keep.status})`);
  }
  if (toRemove.size > 0) pruneMovies(toRemove);
  return issues;
}

function countAvailableEpisodes(s: LibrarySeries): number {
  return s.seasons.reduce((sum, season) => sum + season.episodes.filter((e) => e.status === "available").length, 0);
}

function mergeDuplicateSeries(): RescanIssue[] {
  const seriesList = loadSeries();
  const byTmdbId = new Map<number, LibrarySeries[]>();
  for (const s of seriesList) {
    const list = byTmdbId.get(s.tmdbId) ?? [];
    list.push(s);
    byTmdbId.set(s.tmdbId, list);
  }

  const toRemove = new Set<string>();
  const issues: RescanIssue[] = [];
  for (const [tmdbId, dups] of byTmdbId) {
    if (dups.length < 2) continue;
    const sorted = [...dups].sort((a, b) => (countAvailableEpisodes(b) - countAvailableEpisodes(a)) || (a.addedAt - b.addedAt));
    const [keep, ...drop] = sorted;
    for (const d of drop) toRemove.add(d.id);
    issues.push({ kind: "duplicate", path: `series:${tmdbId} "${keep.title}" — ${drop.length} doublon(s) fusionné(s)` });
    recordSearchLog("info", "reconcile.duplicate_series_merged", `${keep.title} (tmdbId ${tmdbId}) — ${drop.length} entrée(s) en double fusionnée(s), conservé: ${keep.id} (${countAvailableEpisodes(keep)} ép. disponibles)`);
  }
  if (toRemove.size > 0) pruneSeries(toRemove);
  return issues;
}

/** Case-insensitive on Windows/macOS-style filesystems; exact elsewhere isn't worth the complexity here. */
function isUnderRoot(p: string, root: string): boolean {
  const sep = pathFor(root).sep;
  const a = p.toLowerCase();
  const b = root.toLowerCase().replace(/[/\\]+$/, "");
  return a === b || a.startsWith(b + sep);
}

/**
 * Reconcile what the library thinks it has against what's actually on disk in
 * the engine's completed-media folders. Shared by the manual "reconcile"
 * button and the scheduled maintenance task.
 *
 * A library entry's `file.path` isn't always local — Plex library sync fills
 * it in with whatever path *Plex* reports, which can be a different machine's
 * view entirely (e.g. Plex on a NAS, Movviz downloading on a separate host).
 * Only paths that fall under one of the engine's own completedPath roots can
 * actually be verified against this filesystem, so anything else is skipped
 * rather than misreported as "missing".
 */
export async function reconcileLibrary(): Promise<RescanIssue[]> {
  const instances = await fetch(`${ENGINE_BASE}/instances`, { headers: engineHeaders(), cache: "no-store", signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS) })
    .then((r) => (r.ok ? r.json() : { instances: [] }))
    .then((d) => d.instances ?? [])
    .catch(() => []);

  const roots = (instances as { completedPath: string }[])
    .map((inst) => inst.completedPath)
    .filter(Boolean);

  // Merge first so the rest of this pass (and the "N titres" counts shown
  // everywhere in the app) reflects the deduped state, not a stale one.
  const duplicateIssues = [...mergeDuplicateMovies(), ...mergeDuplicateSeries()];

  const trackedPaths = new Set<string>();
  for (const movie of loadMovies()) if (movie.file) trackedPaths.add(pathFor(movie.file.path).normalize(movie.file.path));
  for (const series of loadSeries())
    for (const season of series.seasons)
      for (const ep of season.episodes) if (ep.file) trackedPaths.add(pathFor(ep.file.path).normalize(ep.file.path));

  const issues: RescanIssue[] = [];
  for (const p of trackedPaths) {
    if (!roots.some((root) => isUnderRoot(p, root))) continue; // not verifiable from this filesystem — skip
    if (!fs.existsSync(p)) issues.push({ kind: "missing", path: p });
  }

  const trashPrefixes = trashRoots();
  const isInTrash = (p: string) => trashPrefixes.some((root) => isUnderRoot(p, root));

  const onDisk = new Set<string>();
  for (const inst of instances as { completedPath: string }[]) {
    const base = inst.completedPath;
    for (const rel of walk(base)) {
      const full = pathFor(base).join(base, String(rel));
      if (isInTrash(full)) continue; // a trashed file isn't "untracked" — it's deliberately awaiting purge, not a stray
      if (VIDEO_EXT.test(full) && fs.existsSync(full) && fs.statSync(full).isFile()) onDisk.add(full);
    }
  }
  for (const p of onDisk) {
    if (!trackedPaths.has(p)) issues.push({ kind: "untracked", path: p });
  }

  return [...duplicateIssues, ...issues];
}
