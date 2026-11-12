import fs from "node:fs";
import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import { loadMovies, loadSeries, updateMovies, updateSeriesList } from "@/lib/library/store";
import type { LibraryMovie, LibrarySeries } from "@/lib/library/types";
import { deleteLibraryFile, stripCollisionSuffix } from "@/lib/library/applyImportedFiles";
import { logActivity } from "@/lib/activity/store";

/**
 * Doublons « (2) », « (3)… » laissés dans les dossiers de la bibliothèque.
 *
 * Quand le nom final d'un fichier importé est déjà pris, le moteur écrit le
 * nouveau fichier sous « Nom (2).mkv » ; la bibliothèque le renomme ensuite
 * (l'ancien part) une fois le remplacement validé. Si l'import échoue ou est
 * abandonné, ce fichier reste sur le disque sans que rien ne le référence.
 * Le balayage les retrouve ; la suppression ne touche JAMAIS un fichier que la
 * bibliothèque utilise, ni un fichier récent (import peut-être en cours).
 */

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "duplicate-files.json");

const VIDEO_EXT_RE = /\.(mkv|mp4|m4v|avi|mov|wmv|ts|m2ts|mpg|mpeg|webm)$/i;
/** Un fichier touché depuis moins longtemps est peut-être en cours d'import : jamais proposé. */
export const RECENT_WINDOW_MS = 30 * 60 * 1000;
/** Garde-fou : profondeur maximale d'exploration sous une racine de bibliothèque. */
const MAX_DEPTH = 8;

export type DuplicateState =
  /** Non utilisé, l'original (même nom sans « (n) ») existe : doublon à supprimer. */
  | "duplicate"
  /** Non utilisé, mais l'original n'existe pas : peut être la seule copie. */
  | "no_original"
  /** Utilisé par la bibliothèque : jamais supprimé d'ici. */
  | "in_use"
  /** Modifié il y a moins de 30 minutes : import peut-être en cours. */
  | "recent";

export interface DuplicateItem {
  path: string;
  name: string;
  size: number;
  mtimeMs: number;
  ctimeMs: number;
  state: DuplicateState;
  originalPath: string;
  originalSize: number | null;
}

export interface DuplicateReport {
  scannedAt: number | null;
  /** Fichiers vidéo parcourus. */
  checked: number;
  items: DuplicateItem[];
}

export function loadDuplicateReport(): DuplicateReport {
  return readJsonCached<DuplicateReport>(FILE, { scannedAt: null, checked: 0, items: [] });
}

function saveDuplicateReport(report: DuplicateReport): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, report);
}

const norm = (p: string) => (process.platform === "win32" ? path.resolve(p).toLowerCase() : path.resolve(p));

/** Tous les chemins que la bibliothèque utilise comme fichier d'un film ou d'un épisode. */
export function libraryReferencedPaths(): Set<string> {
  const used = new Set<string>();
  const add = (file: { path?: string; diskPath?: string } | null | undefined) => {
    if (!file) return;
    for (const p of [file.path, file.diskPath]) if (p) used.add(norm(p));
  };
  for (const movie of loadMovies()) {
    add(movie.file);
    for (const version of movie.versions ?? []) add(version);
  }
  for (const series of loadSeries()) {
    for (const season of series.seasons) for (const ep of season.episodes) add(ep.file);
  }
  return used;
}

/** Nom du fichier d'origine : « Série - S01E01 (2).mkv » → « Série - S01E01.mkv ». */
function originalNameOf(fileName: string): string | null {
  if (!VIDEO_EXT_RE.test(fileName)) return null;
  const stripped = stripCollisionSuffix(fileName, path.posix);
  return stripped === fileName ? null : stripped;
}

function classify(
  filePath: string,
  st: fs.Stats,
  referenced: Set<string>,
  now: number
): DuplicateItem | null {
  const name = path.basename(filePath);
  const originalName = originalNameOf(name);
  if (!originalName) return null;
  const originalPath = path.join(path.dirname(filePath), originalName);
  let originalSize: number | null = null;
  try {
    const original = fs.lstatSync(originalPath);
    if (original.isFile()) originalSize = original.size;
  } catch { /* pas d'original */ }
  const last = Math.max(st.mtimeMs, st.ctimeMs);
  const state: DuplicateState = referenced.has(norm(filePath))
    ? "in_use"
    : now - last < RECENT_WINDOW_MS
      ? "recent"
      : originalSize !== null
        ? "duplicate"
        : "no_original";
  return { path: filePath, name, size: st.size, mtimeMs: st.mtimeMs, ctimeMs: st.ctimeMs, state, originalPath, originalSize };
}

/** Dossiers jamais explorés : métadonnées NAS, corbeilles, dossiers cachés. */
const skipDir = (name: string) => name.startsWith(".") || name.startsWith("@") || name.startsWith("#") || name === "$RECYCLE.BIN";

/**
 * Parcourt les racines de la bibliothèque et liste les fichiers vidéo dont le nom
 * porte un suffixe « (n) » de collision. Lecture seule ; rien n'est modifié.
 */
export async function scanDuplicateFiles(
  roots: string[],
  onProgress?: (current: number, total: number) => void,
  opts?: { shouldCancel?: () => boolean; now?: number }
): Promise<DuplicateReport> {
  const referenced = libraryReferencedPaths();
  const now = opts?.now ?? Date.now();
  const items: DuplicateItem[] = [];
  let checked = 0;
  let visited = 0;
  const stack: Array<{ dir: string; depth: number }> = roots.map((dir) => ({ dir, depth: 0 }));
  while (stack.length > 0) {
    if (opts?.shouldCancel?.()) break;
    const { dir, depth } = stack.pop()!;
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      continue; // dossier illisible ou disparu : ignoré
    }
    visited++;
    onProgress?.(visited, visited + stack.length);
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (depth < MAX_DEPTH && !skipDir(entry.name)) stack.push({ dir: full, depth: depth + 1 });
        continue;
      }
      if (!entry.isFile() || !VIDEO_EXT_RE.test(entry.name)) continue;
      checked++;
      if (!originalNameOf(entry.name)) continue;
      const st = await fs.promises.lstat(full).catch(() => null);
      if (!st?.isFile()) continue;
      const item = classify(full, st, referenced, now);
      if (item) items.push(item);
    }
  }
  items.sort((a, b) => a.path.localeCompare(b.path));
  const report: DuplicateReport = { scannedAt: Date.now(), checked, items };
  saveDuplicateReport(report);
  return report;
}

export interface DuplicateResolveResult {
  done: string[];
  failed: { path: string; error: string }[];
  freedBytes: number;
}

/**
 * Supprime les doublons choisis. Chaque fichier doit figurer dans le dernier
 * rapport, être EXACTEMENT celui du balayage (taille + date), ne plus être utilisé
 * par la bibliothèque et ne pas être récent. La suppression elle-même passe par les
 * gardes habituelles (sous une racine de bibliothèque, jamais récursive).
 */
export async function resolveDuplicateFiles(
  paths: string[],
  roots: string[],
  username: string,
  now = Date.now()
): Promise<DuplicateResolveResult> {
  const report = loadDuplicateReport();
  const result: DuplicateResolveResult = { done: [], failed: [], freedBytes: 0 };
  if (roots.length === 0) {
    for (const p of paths) result.failed.push({ path: p, error: "no_roots" });
    return result;
  }
  const referenced = libraryReferencedPaths();
  for (const p of paths) {
    const item = report.items.find((i) => i.path === p);
    if (!item) { result.failed.push({ path: p, error: "not_in_report" }); continue; }
    try {
      if (item.state === "in_use" || item.state === "recent") throw new Error(item.state);
      const st = await fs.promises.lstat(item.path).catch(() => null);
      if (!st) throw new Error("already_gone");
      if (!st.isFile() || st.size !== item.size || st.mtimeMs !== item.mtimeMs) throw new Error("file_changed");
      if (referenced.has(norm(item.path))) throw new Error("in_use");
      if (now - Math.max(st.mtimeMs, st.ctimeMs) < RECENT_WINDOW_MS) throw new Error("recent");
      await deleteLibraryFile(item.path, roots);
      result.done.push(item.path);
      result.freedBytes += item.size;
      logActivity("removed", username, item.name, null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      // Déjà disparu : le résultat voulu est atteint, la ligne sort simplement du rapport.
      if (message === "already_gone") result.done.push(item.path);
      else result.failed.push({ path: p, error: message.startsWith("Remplacement refusé") ? "outside_library" : message });
    }
  }
  if (result.done.length > 0) {
    saveDuplicateReport({ ...report, items: report.items.filter((i) => !result.done.includes(i.path)) });
  }
  return result;
}

/** Un fichier « (n) » utilisé par la bibliothèque dont l'original existe aussi peut être fusionné. */
export const isMergeable = (item: Pick<DuplicateItem, "state" | "originalSize">): boolean =>
  item.state === "in_use" && item.originalSize !== null;

const lastSegment = (p: string) => p.split(/[\\/]/).pop() ?? p;

/**
 * Nouveau chemin d'une référence bibliothèque après la fusion : le fichier « (n) »
 * prend le nom de l'original. Le chemin vu par Plex peut différer du disque : on ne
 * remplace que le dernier segment quand il porte le nom du fichier « (n) ».
 */
function repointedPath(p: string | undefined, fromPath: string, fromName: string, toPath: string, toName: string): string | undefined {
  if (!p) return p;
  if (norm(p) === norm(fromPath)) return toPath;
  if (lastSegment(p) === fromName) return p.slice(0, p.length - fromName.length) + toName;
  return p;
}

function repointFile<T extends { path: string; diskPath?: string }>(file: T, fromPath: string, fromName: string, toPath: string, toName: string): T {
  const newPath = repointedPath(file.path, fromPath, fromName, toPath, toName) ?? file.path;
  const diskPath = repointedPath(file.diskPath, fromPath, fromName, toPath, toName);
  return { ...file, path: newPath, ...(file.diskPath !== undefined ? { diskPath } : {}) };
}

const refersTo = (file: { path?: string; diskPath?: string } | null | undefined, p: string) =>
  !!file && [file.path, file.diskPath].some((x) => x && norm(x) === norm(p));

/** Met à jour toutes les références bibliothèque de `fromPath` vers `toPath`. */
function repointLibrary(fromPath: string, toPath: string): number {
  const fromName = path.basename(fromPath);
  const toName = path.basename(toPath);
  let touched = 0;
  const moviePatches = new Map<string, Partial<LibraryMovie>>();
  for (const movie of loadMovies()) {
    const hit = refersTo(movie.file, fromPath) || refersTo(movie.file, toPath) ||
      (movie.versions ?? []).some((v) => refersTo(v, fromPath) || refersTo(v, toPath));
    if (!hit) continue;
    const file = movie.file ? repointFile(movie.file, fromPath, fromName, toPath, toName) : movie.file;
    let versions = movie.versions?.map((v) => repointFile(v, fromPath, fromName, toPath, toName));
    if (versions) {
      // Deux versions sur le même fichier après la fusion : on garde la principale (ou la première).
      const seen = new Map<string, number>();
      const kept: typeof versions = [];
      for (const v of versions) {
        const key = norm(v.diskPath || v.path);
        const at = seen.get(key);
        if (at === undefined) { seen.set(key, kept.length); kept.push(v); }
        else if (v.primary && !kept[at].primary) kept[at] = v;
      }
      versions = kept;
    }
    moviePatches.set(movie.id, { file, ...(versions ? { versions } : {}) });
    touched++;
  }
  if (moviePatches.size > 0) updateMovies(moviePatches);

  const seriesPatches = new Map<string, Partial<LibrarySeries>>();
  for (const series of loadSeries()) {
    let changed = false;
    const seasons = series.seasons.map((season) => ({
      ...season,
      episodes: season.episodes.map((ep) => {
        if (!refersTo(ep.file, fromPath)) return ep;
        changed = true;
        touched++;
        return { ...ep, file: repointFile(ep.file!, fromPath, fromName, toPath, toName) };
      }),
    }));
    if (changed) seriesPatches.set(series.id, { seasons });
  }
  if (seriesPatches.size > 0) updateSeriesList(seriesPatches);
  return touched;
}

/**
 * Fusionne un fichier « (n) » utilisé avec son original : le fichier « (n) » (le plus
 * récent, celui du remplacement) prend le nom de l'original, l'ancien est supprimé et
 * la bibliothèque est repointée. L'original est d'abord mis de côté puis effacé
 * seulement une fois le renommage réussi ; en cas d'échec il est remis en place.
 */
export async function mergeDuplicateFiles(
  paths: string[],
  roots: string[],
  username: string,
  now = Date.now()
): Promise<DuplicateResolveResult> {
  const report = loadDuplicateReport();
  const result: DuplicateResolveResult = { done: [], failed: [], freedBytes: 0 };
  if (roots.length === 0) {
    for (const p of paths) result.failed.push({ path: p, error: "no_roots" });
    return result;
  }
  const referenced = libraryReferencedPaths();
  for (const p of paths) {
    const item = report.items.find((i) => i.path === p);
    if (!item) { result.failed.push({ path: p, error: "not_in_report" }); continue; }
    const backup = `${item.originalPath}.movviz-merge-bak`;
    let backedUp = false;
    try {
      if (!isMergeable(item)) throw new Error("not_mergeable");
      const st = await fs.promises.lstat(item.path).catch(() => null);
      if (!st) throw new Error("already_gone");
      if (!st.isFile() || st.size !== item.size || st.mtimeMs !== item.mtimeMs) throw new Error("file_changed");
      if (!referenced.has(norm(item.path))) throw new Error("not_mergeable");
      const orig = await fs.promises.lstat(item.originalPath).catch(() => null);
      if (!orig?.isFile()) throw new Error("original_missing");
      if (now - Math.max(st.mtimeMs, st.ctimeMs, orig.mtimeMs, orig.ctimeMs) < RECENT_WINDOW_MS) throw new Error("recent");
      if (orig.mtimeMs > st.mtimeMs) throw new Error("original_newer");
      // Mettre l'original de côté d'abord : rien n'est effacé avant que le renommage ait réussi.
      await fs.promises.rename(item.originalPath, backup);
      backedUp = true;
      await fs.promises.rename(item.path, item.originalPath);
      repointLibrary(item.path, item.originalPath);
      await deleteLibraryFile(backup, roots);
      backedUp = false;
      result.done.push(item.path);
      result.freedBytes += orig.size;
      logActivity("removed", username, path.basename(item.originalPath), null);
    } catch (err) {
      if (backedUp) {
        // Échec après la mise de côté : on remet l'original en place s'il manque.
        const missing = !(await fs.promises.lstat(item.originalPath).catch(() => null));
        if (missing) await fs.promises.rename(backup, item.originalPath).catch(() => {});
      }
      const message = err instanceof Error ? err.message : String(err);
      result.failed.push({ path: p, error: message.startsWith("Remplacement refusé") ? "outside_library" : message });
    }
  }
  if (result.done.length > 0) {
    saveDuplicateReport({ ...report, items: report.items.filter((i) => !result.done.includes(i.path)) });
  }
  return result;
}
