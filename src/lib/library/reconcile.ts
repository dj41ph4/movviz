import fs from "node:fs";
import { loadMovies, loadSeries } from "@/lib/library/store";
import { ENGINE_BASE, engineHeaders, ENGINE_TIMEOUT_MS } from "@/lib/engine/server";
import { trashRoots } from "@/lib/library/trashStore";
import { pathFor } from "@/lib/library/renamePath";

const VIDEO_EXT = /\.(mkv|mp4|avi|ts|m2ts)$/i;

function walk(dir: string): string[] {
  try {
    return fs.readdirSync(dir, { recursive: true, withFileTypes: false }) as unknown as string[];
  } catch {
    return [];
  }
}

export interface RescanIssue {
  kind: "missing" | "untracked";
  path: string;
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

  return issues;
}
