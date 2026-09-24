import fs from "node:fs";
import { loadMovies, loadSeries, pruneMovies, pruneSeries } from "@/lib/library/store";
import type { LibraryMovie, LibrarySeries, LibraryStatus } from "@/lib/library/types";
import { ENGINE_BASE, engineHeaders, ENGINE_TIMEOUT_MS } from "@/lib/engine/server";
import { trashRoots } from "@/lib/library/trashStore";
import { pathFor } from "@/lib/library/renamePath";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import { loadPathMappings, type PathMapping } from "@/lib/plex/pathMappingStore";
import { mapWithConcurrency } from "@/lib/concurrency";

const VIDEO_EXT = /\.(mkv|mp4|avi|ts|m2ts)$/i;

// Disk checks run on the libuv threadpool, never on the main thread: the sync
// versions (readdirSync of the whole completed folder + existsSync/statSync
// per file) froze the event loop for 30+ s on the NAS, so every API request —
// even a bare 401 — timed out while a pass was running.
const DISK_CONCURRENCY = 8;

async function walk(dir: string): Promise<string[]> {
  try {
    return await fs.promises.readdir(dir, { recursive: true });
  } catch {
    return [];
  }
}

async function isFile(p: string): Promise<boolean> {
  try {
    return (await fs.promises.stat(p)).isFile();
  } catch {
    return false;
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await fs.promises.access(p);
    return true;
  } catch {
    return false;
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

/**
 * Collapses same-tmdbId duplicates only — no disk access. For callers that
 * just added titles and only need the dedupe, not the full disk reconcile.
 */
export function mergeLibraryDuplicates(): RescanIssue[] {
  return [...mergeDuplicateMovies(), ...mergeDuplicateSeries()];
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
  // Clé insensible aux mounts (dossier parent + nom de fichier) : le même
  // fichier physique vu via Plex (/volume1/docker/plex/film/X.mkv) et via
  // Movviz (/data/film/X.mkv) ne doit compter ni comme "missing" ni comme
  // "untracked" — sinon chaque titre Plex-importé génère des anomalies
  // fantômes (des milliers de notifs) jusqu'au prochain rescan complet.
  const trackedSuffixes = new Set<string>();
  const mountAgnosticKey = (p: string): string => {
    const parts = p.replace(/[\\/]+/g, "/").toLowerCase().split("/").filter(Boolean);
    return parts.slice(-2).join("/");
  };
  // Mappings chargés une fois (un stat disque), réutilisés en mémoire pure
  // pour chaque path suivi — voir le même piège documenté dans librarySync.
  let cachedMappings: PathMapping[] = [];
  try { cachedMappings = loadPathMappings(); } catch { cachedMappings = []; }
  const translateCached = (p: string, mappings: PathMapping[]): string[] => {
    if (mappings.length === 0) return [p];
    const out = new Set<string>([p]);
    try {
      // Même logique longest-prefix que applyLearnedPathMapping, sans I/O.
      const withSep = (s: string) => (s.includes("\\") && !s.includes("/") ? "\\" : "/");
      const sep = withSep(p);
      const normalized = p.replace(/[\\/]/g, sep);
      const lower = normalized.toLowerCase();
      let best: PathMapping | null = null;
      for (const m of mappings) {
        const prefix = m.plexPrefix.replace(/[\\/]/g, sep);
        if (lower.startsWith(prefix.toLowerCase())) {
          if (!best || m.plexPrefix.length > best.plexPrefix.length) best = m;
        }
      }
      if (best) {
        const rest = normalized.slice(best.plexPrefix.replace(/[\\/]/g, sep).length);
        const movvizSep = withSep(best.movvizPrefix);
        out.add(best.movvizPrefix + rest.split(sep).join(movvizSep));
      }
    } catch { /* on garde au moins le path brut */ }
    return [...out];
  };
  const track = (raw: string) => {
    const n = pathFor(raw).normalize(raw);
    trackedPaths.add(n);
    trackedSuffixes.add(mountAgnosticKey(n));
    // Vue traduite via les mappings validés (Réglages → Plex) : comparaison
    // exacte possible même avec des mounts différents. Mappings chargés une
    // fois pour toute la passe (pas un stat disque par fichier suivi, sinon
    // l'event loop se bloque et les API timeout pendant le rescan).
    for (const mapped of translateCached(n, cachedMappings)) {
      if (mapped === n) continue;
      const mn = pathFor(mapped).normalize(mapped);
      trackedPaths.add(mn);
      trackedSuffixes.add(mountAgnosticKey(mn));
    }
  };
  for (const movie of loadMovies()) if (movie.file) track(movie.file.path);
  for (const series of loadSeries())
    for (const season of series.seasons)
      for (const ep of season.episodes) if (ep.file) track(ep.file.path);

  const issues: RescanIssue[] = [];
  const verifiable = [...trackedPaths].filter((p) => roots.some((root) => isUnderRoot(p, root))); // others aren't checkable from this filesystem — skip
  const present = await mapWithConcurrency(verifiable, DISK_CONCURRENCY, exists);
  verifiable.forEach((p, i) => { if (!present[i]) issues.push({ kind: "missing", path: p }); });

  const trashPrefixes = trashRoots();
  const isInTrash = (p: string) => trashPrefixes.some((root) => isUnderRoot(p, root));

  const onDisk = new Set<string>();
  for (const inst of instances as { completedPath: string }[]) {
    const base = inst.completedPath;
    const candidates = (await walk(base))
      .map((rel) => pathFor(base).join(base, String(rel)))
      // a trashed file isn't "untracked" — it's deliberately awaiting purge, not a stray
      .filter((full) => VIDEO_EXT.test(full) && !isInTrash(full));
    const files = await mapWithConcurrency(candidates, DISK_CONCURRENCY, isFile);
    candidates.forEach((full, i) => { if (files[i]) onDisk.add(full); });
  }
  for (const p of onDisk) {
    // Égalité exacte d'abord (cas normal), puis clé insensible aux mounts
    // (même fichier vu via Plex et via Movviz). Faux négatif théorique : deux
    // vrais fichiers différents partageant parent+nom sous deux racines
    // distinctes — rare et bénin (une notif "untracked" manquée, rien de
    // supprimé ni modifié).
    if (!trackedPaths.has(p) && !trackedSuffixes.has(mountAgnosticKey(p))) issues.push({ kind: "untracked", path: p });
  }

  return [...duplicateIssues, ...issues];
}
