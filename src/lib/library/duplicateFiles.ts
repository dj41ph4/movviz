import fs from "node:fs";
import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import { loadMovies, loadSeries, updateMovies, updateSeriesList } from "@/lib/library/store";
import type { LibraryMovie, LibrarySeries } from "@/lib/library/types";
import { parseRelease } from "@/lib/naming/parser";
import { titleSimilarity } from "@/lib/library/matching";
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
  /** Ancien rapport uniquement : un fichier récent ne bloque plus. */
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
  /** L'original (nom sans « (n) ») est lui aussi utilisé par la bibliothèque. */
  originalInUse?: boolean;
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
  void now;
  const state: DuplicateState = referenced.has(norm(filePath))
    ? "in_use"
    : originalSize !== null
      ? "duplicate"
      : "no_original";
  return {
    path: filePath, name, size: st.size, mtimeMs: st.mtimeMs, ctimeMs: st.ctimeMs, state, originalPath, originalSize,
    originalInUse: referenced.has(norm(originalPath)),
  };
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
      if (item.state === "in_use") throw new Error(item.state);
      const st = await fs.promises.lstat(item.path).catch(() => null);
      if (!st) throw new Error("already_gone");
      if (!st.isFile() || st.size !== item.size || st.mtimeMs !== item.mtimeMs) throw new Error("file_changed");
      if (referenced.has(norm(item.path))) throw new Error("in_use");
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

/** Un « (n) » dont l'original existe aussi : le plus récent est gardé sous le nom propre, l'autre est supprimé. */
export const isMergeable = (item: Pick<DuplicateItem, "originalSize">): boolean => item.originalSize !== null;

/** Un « (n) » seul (pas d'original) : il reprend le nom propre et se rattache à la bibliothèque. */
export const isLinkable = (item: Pick<DuplicateItem, "originalSize">): boolean => item.originalSize === null;

const lastSegment = (p: string) => p.split(/[\\/]/).pop() ?? p;

/**
 * Nouveau chemin d'une référence bibliothèque après la fusion : le fichier retenu
 * porte le nom de l'original. Le chemin vu par Plex peut différer du disque : on ne
 * remplace que le dernier segment quand il porte le nom du fichier « (n) ».
 */
function repointedPath(p: string | undefined, fromPath: string, fromName: string, toPath: string, toName: string): string | undefined {
  if (!p) return p;
  if (norm(p) === norm(fromPath)) return toPath;
  if (lastSegment(p) === fromName) return p.slice(0, p.length - fromName.length) + toName;
  return p;
}

const refersTo = (file: { path?: string; diskPath?: string } | null | undefined, p: string) =>
  !!file && [file.path, file.diskPath].some((x) => x && norm(x) === norm(p));

/**
 * Repointe toutes les références bibliothèque vers `toPath` (le fichier qui reste) :
 * celles qui visaient `fromPath` (le « (n) ») ou `toPath` lui-même. La taille suit le
 * fichier réellement conservé.
 */
function repointLibrary(fromPath: string, toPath: string, size: number): number {
  const fromName = path.basename(fromPath);
  const toName = path.basename(toPath);
  const hits = (f: { path?: string; diskPath?: string } | null | undefined) => refersTo(f, fromPath) || refersTo(f, toPath);
  const fix = <T extends { path: string; diskPath?: string; size: number }>(file: T): T => ({
    ...file,
    path: repointedPath(file.path, fromPath, fromName, toPath, toName) ?? file.path,
    ...(file.diskPath !== undefined ? { diskPath: repointedPath(file.diskPath, fromPath, fromName, toPath, toName) } : {}),
    size,
  });
  let touched = 0;
  const moviePatches = new Map<string, Partial<LibraryMovie>>();
  for (const movie of loadMovies()) {
    if (!hits(movie.file) && !(movie.versions ?? []).some(hits)) continue;
    const file = movie.file && hits(movie.file) ? fix(movie.file) : movie.file;
    let versions = movie.versions?.map((v) => (hits(v) ? fix(v) : v));
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
        if (!hits(ep.file)) return ep;
        changed = true;
        touched++;
        return { ...ep, file: fix(ep.file!) };
      }),
    }));
    if (changed) seriesPatches.set(series.id, { seasons });
  }
  if (seriesPatches.size > 0) updateSeriesList(seriesPatches);
  return touched;
}

/**
 * Fusionne un « (n) » avec son original : le fichier le plus RÉCENT reste sous le nom
 * propre, le moins récent est supprimé, la bibliothèque est repointée sur ce qui reste.
 * Un fichier récent ne bloque pas. Quand le « (n) » est retenu, l'original est d'abord
 * mis de côté puis effacé seulement une fois le renommage réussi (remis en place en
 * cas d'échec). Seul un fichier modifié depuis le balayage est refusé.
 */
export async function mergeDuplicateFiles(
  paths: string[],
  roots: string[],
  username: string
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
      const st = await fs.promises.lstat(item.path).catch(() => null);
      if (!st) throw new Error("already_gone");
      if (!st.isFile() || st.size !== item.size || st.mtimeMs !== item.mtimeMs) throw new Error("file_changed");
      const orig = await fs.promises.lstat(item.originalPath).catch(() => null);
      if (!orig?.isFile()) throw new Error("original_missing");
      const keepNew = st.mtimeMs >= orig.mtimeMs;
      if (keepNew) {
        // Mettre l'original de côté d'abord : rien n'est effacé avant que le renommage ait réussi.
        await fs.promises.rename(item.originalPath, backup);
        backedUp = true;
        await fs.promises.rename(item.path, item.originalPath);
        repointLibrary(item.path, item.originalPath, st.size);
        await deleteLibraryFile(backup, roots);
        backedUp = false;
        result.freedBytes += orig.size;
      } else {
        // L'original est le plus récent : le « (n) » moins récent est supprimé.
        await deleteLibraryFile(item.path, roots);
        repointLibrary(item.path, item.originalPath, orig.size);
        result.freedBytes += st.size;
      }
      result.done.push(item.path);
      logActivity("removed", username, path.basename(item.originalPath), null);
    } catch (err) {
      if (backedUp) {
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

const SIMILARITY = 0.8;

/** Un film ou un épisode de la bibliothèque qui n'a pas (ou plus) de fichier sur le disque. */
const missingOnDisk = (file: { path?: string; diskPath?: string } | null | undefined): boolean => {
  if (!file) return true;
  const target = file.diskPath || file.path;
  return !target || !fs.existsSync(target);
};

type LinkTarget =
  | { kind: "movie"; id: string }
  | { kind: "episode"; id: string; season: number; episode: number };

function findLinkTarget(fileName: string, canonicalName: string, folderName: string): LinkTarget | null {
  const parsed = parseRelease(canonicalName);
  const season = parsed.season;
  const episode = parsed.episode;
  const titleOk = (title: string) =>
    titleSimilarity(parsed.title ?? "", title) >= SIMILARITY || titleSimilarity(folderName, title) >= SIMILARITY;
  if (season != null && episode != null) {
    for (const s of loadSeries()) {
      if (!titleOk(s.title)) continue;
      const ep = s.seasons.find((x) => x.seasonNumber === season)?.episodes.find((e) => e.episodeNumber === episode);
      if (ep && missingOnDisk(ep.file)) return { kind: "episode", id: s.id, season, episode };
    }
    return null;
  }
  void fileName;
  for (const m of loadMovies()) {
    if (!titleOk(m.title)) continue;
    if (parsed.year && m.year && Number(parsed.year) !== m.year) continue;
    if (missingOnDisk(m.file)) return { kind: "movie", id: m.id };
  }
  return null;
}

/**
 * Rattache un « (n) » seul (aucun original, utilisé par personne) : il prend le nom propre
 * et la bibliothèque le lie au film ou à l'épisode correspondant qui n'a pas de fichier.
 * Aucune cible sûre → le fichier n'est pas touché.
 */
export async function linkDuplicateFiles(
  paths: string[],
  roots: string[],
  username: string
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
      const st = await fs.promises.lstat(item.path).catch(() => null);
      if (!st) throw new Error("already_gone");
      if (!st.isFile() || st.size !== item.size || st.mtimeMs !== item.mtimeMs) throw new Error("file_changed");
      const inUse = referenced.has(norm(item.path));
      if (await fs.promises.lstat(item.originalPath).catch(() => null)) throw new Error("original_exists");
      const target = inUse ? null : findLinkTarget(item.name, path.basename(item.originalPath), path.basename(path.dirname(item.path)));
      const parsed = parseRelease(path.basename(item.originalPath));
      const file = {
        path: item.originalPath,
        diskPath: item.originalPath,
        quality: [parsed.source, parsed.resolution].filter(Boolean).join(" ") || "—",
        resolution: parsed.resolution,
        videoCodec: parsed.videoCodec,
        audioCodec: parsed.audioCodec,
        hdr: parsed.hdr,
        source: parsed.source,
        size: st.size,
        addedAt: Date.now(),
      };
      // Le nom propre est libre (pas d'original) : on renomme sans écraser.
      await fs.promises.rename(item.path, item.originalPath);
      // Utilisé par la bibliothèque : on la repointe. Sans cible : le fichier garde au moins son nom propre.
      if (inUse) repointLibrary(item.path, item.originalPath, st.size);
      else if (!target) { /* nom propre seulement */ }
      else if (target.kind === "movie") {
        updateMovies(new Map([[target.id, { status: "available", activeInfoHash: null, file }]]));
      } else {
        const series = loadSeries().find((s) => s.id === target.id)!;
        const seasons = series.seasons.map((season) => season.seasonNumber !== target.season ? season : {
          ...season,
          episodes: season.episodes.map((ep) => ep.episodeNumber !== target.episode ? ep : { ...ep, status: "available" as const, activeInfoHash: null, file }),
        });
        updateSeriesList(new Map([[series.id, { seasons }]]));
      }
      result.done.push(item.path);
      logActivity("imported", username, path.basename(item.originalPath), null);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.failed.push({ path: p, error: message });
    }
  }
  if (result.done.length > 0) {
    saveDuplicateReport({ ...report, items: report.items.filter((i) => !result.done.includes(i.path)) });
  }
  return result;
}
