import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { pathFor } from "./renamePath";
import { loadMovies, loadSeries, updateMovie, updateSeriesList } from "./store";
import { getTitleInLanguage } from "@/lib/metadata/tmdb";
import { loadNamingTemplates } from "@/lib/naming/store";
import { renderSegment } from "@/lib/naming/render";
import { parseRelease } from "@/lib/naming/parser";
import { refreshPlexLibraryFor } from "@/lib/plex/librarySync";
import type { LibraryFile } from "./types";
import type { NamingContext } from "@/lib/naming/types";

export interface RenameResult {
  success: boolean;
  id: string;
  type: "movie" | "series";
  title: string;
  error?: string;
  skipped?: boolean;
}

type LogFn = (msg: string) => void;

// ---- helpers ----

interface WalkEntry { rel: string; size: number; }

function walkRelative(dir: string): WalkEntry[] {
  const p = pathFor(dir);
  const results: WalkEntry[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = p.join(dir, e.name);
    if (e.isDirectory()) {
      for (const sub of walkRelative(full)) results.push(sub);
    } else if (e.isFile()) {
      results.push({ rel: p.relative(dir, full), size: fs.statSync(full).size });
    }
  }
  return results;
}

function verifyCopy(src: string, dst: string, log: LogFn): void {
  const srcStat = fs.statSync(src);
  const dstStat = fs.statSync(dst);
  if (srcStat.isFile()) {
    if (!dstStat.isFile()) throw new Error(`Destination is not a file: ${dst}`);
    if (srcStat.size !== dstStat.size) throw new Error(`Size mismatch: ${src} (${srcStat.size}) vs ${dst} (${dstStat.size})`);
    log(`[VERIFY] file size OK (${srcStat.size} bytes)`);
    return;
  }
  // Directory verification
  const srcFiles = walkRelative(src);
  const dstFiles = walkRelative(dst);
  if (srcFiles.length !== dstFiles.length) throw new Error(
    `Copy incomplete: ${srcFiles.length} source files, ${dstFiles.length} destination files`
  );
  // Compare relative paths and sizes
  const dstMap = new Map(dstFiles.map((f) => [f.rel, f.size]));
  for (const sf of srcFiles) {
    const ds = dstMap.get(sf.rel);
    if (ds === undefined) throw new Error(`Missing after copy: ${dst}/${sf.rel}`);
    if (ds !== sf.size) throw new Error(`Size mismatch: ${sf.rel} (source ${sf.size}, dest ${ds})`);
  }
  log(`[VERIFY] ${srcFiles.length} files, ${srcFiles.reduce((a, f) => a + f.size, 0)} bytes OK`);
}

function buildMovieCtx(file: LibraryFile | null | undefined, year: number | null | undefined, title: string): NamingContext {
  return {
    title, year: year ? String(year) : null,
    season: null, episode: null, episodeTitle: null,
    quality: file?.quality ?? "", resolution: file?.resolution ?? null,
    source: null, videoCodec: null, audioCodec: null, hdr: null, group: null,
  };
}

async function rmRetry(src: string, log: LogFn, maxRetries = 3): Promise<void> {
  for (let i = 1; i <= maxRetries; i++) {
    try {
      await fs.promises.rm(src, { recursive: true, force: true });
      return;
    } catch (err: any) {
      log(`[RM] attempt ${i}/${maxRetries} failed: ${err.message}`);
      if (i < maxRetries) await new Promise((r) => setTimeout(r, 1000 * i));
      else throw err;
    }
  }
}

function rmShellFallback(src: string, log: LogFn): void {
  // SAFETY: never delete a filesystem root. rd /s /q on "D:\" would wipe everything.
  const p = pathFor(src);
  const resolved = p.resolve(src);
  const depth = resolved.split(p.sep).filter(Boolean).length;
  if (depth <= 1) {
    throw new Error(`[SECURITY] Refusing to delete root-level directory: ${resolved}`);
  }
  try {
    const win = process.platform === "win32";
    if (win) {
      log(`[RM] shell fallback: rd /s /q "${src}"`);
      execFileSync("cmd.exe", ["/c", "rd", "/s", "/q", src], { timeout: 30000 });
    } else {
      log(`[RM] shell fallback: rm -rf "${src}"`);
      execFileSync("rm", ["-rf", src], { timeout: 30000 });
    }
  } catch (err: any) {
    log(`[RM] shell fallback failed: ${err.message}`);
    throw err;
  }
}

async function safeMove(src: string, dst: string, log: LogFn): Promise<void> {
  const p = pathFor(src);
  const ns = p.resolve(src);
  const nd = p.resolve(dst);
  if (ns === nd) { log(`[SKIP] ${ns} === ${nd}`); return; }
  if (fs.existsSync(nd)) throw new Error(`Target exists: ${nd}`);

  // SAFETY: refuse to move a filesystem root or a directory that looks like
  // a library root (too shallow depth).
  const depth = ns.split(p.sep).filter(Boolean).length;
  if (depth <= 1) {
    throw new Error(`[SECURITY] Refusing to move root-level directory: ${ns}`);
  }

  fs.mkdirSync(p.dirname(nd), { recursive: true });

  // Try native rename first (works on same drive, atomic)
  try {
    await fs.promises.rename(ns, nd);
    log(`[RENAME] ${ns} → ${nd}`);
    // Verify source is truly gone (Windows may lie about case-insensitive renames)
    if (fs.existsSync(ns)) {
      log(`[WARN] source ${ns} still reported after rename, double-checking`);
      // Windows: rename might be a no-op if only case changed
      const sameReal = ns.toLowerCase() === nd.toLowerCase();
      if (sameReal) log(`[SKIP] case-only change on case-insensitive FS, continuing`);
      else throw new Error(`Source still exists after rename: ${ns}`);
    }
    return;
  } catch (err: any) {
    if (err.code !== "EXDEV") throw err;
  }

  // EXDEV — cross-device copy + remove
  log(`[CP] ${ns} → ${nd} (cross-device)`);
  await fs.promises.cp(ns, nd, { recursive: true, preserveTimestamps: true });
  verifyCopy(ns, nd, log);

  log(`[RM] ${ns}`);
  try {
    await rmRetry(ns, log);
  } catch {
    log(`[RM] retries exhausted, trying shell fallback`);
    rmShellFallback(ns, log);
  }

  if (fs.existsSync(ns)) {
    log(`[WARN] ${ns} still present after all removal attempts — reporting as error`);
    throw new Error(`Failed to remove source after copy: ${ns}`);
  }

  log(`[OK] ${ns} → ${nd}`);
}

/** Removes dir and every empty subdirectory bottom-up. A directory holding any file, anywhere in its tree, is left untouched — never deletes data, only the empty shell left behind once everything real has been moved out. */
function removeEmptyDirsRecursive(dir: string, log: LogFn): boolean {
  const p = pathFor(dir);
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return false;
  }
  let allEmpty = true;
  for (const e of entries) {
    const full = p.join(dir, e.name);
    if (e.isDirectory()) {
      if (!removeEmptyDirsRecursive(full, log)) allEmpty = false;
    } else {
      allEmpty = false;
    }
  }
  if (!allEmpty) return false;
  try {
    fs.rmdirSync(dir);
    log(`[RM] removed empty residual folder: ${dir}`);
    return true;
  } catch (err: any) {
    log(`[WARN] could not remove residual folder ${dir}: ${err.message}`);
    return false;
  }
}

/**
 * Carries forward anything still sitting in a leftover source folder after
 * its tracked episodes were relocated — subtitles, .nfo, artwork, samples,
 * whatever wasn't part of `file.path` and so was never individually moved —
 * into the unified destination, preserving the relative path. A same-named
 * file already at the destination is left in place rather than overwritten
 * or deleted, and logged so it isn't silently lost either way. Once nothing
 * real remains, the empty shell of the source folder is removed.
 */
async function sweepResidualFolder(dir: string, target: string, log: LogFn): Promise<void> {
  if (!fs.existsSync(dir) || dir === target) return;
  const p = pathFor(dir);
  let leftovers: WalkEntry[];
  try {
    leftovers = walkRelative(dir);
  } catch {
    return;
  }
  for (const entry of leftovers) {
    const src = p.join(dir, entry.rel);
    const dst = p.join(target, entry.rel);
    if (!fs.existsSync(src)) continue; // already relocated as a tracked episode
    if (fs.existsSync(dst)) {
      log(`[WARN] leftover ${src} conflicts with existing ${dst} — left in place`);
      continue;
    }
    try {
      await safeMove(src, dst, log);
    } catch (err: any) {
      log(`[WARN] could not move leftover ${src}: ${err.message}`);
    }
  }
  removeEmptyDirsRecursive(dir, log);
}

// ---- movie ----

async function renameMovie(id: string, language: string, log: LogFn): Promise<RenameResult> {
  const list = loadMovies();
  const movie = list.find((m) => m.id === id);
  if (!movie || !movie.file?.path) {
    return { success: false, id, type: "movie", title: "", skipped: true };
  }

  const translated = await getTitleInLanguage(movie.tmdbId, "movie", language);
  if (!translated) return { success: false, id, type: "movie", title: movie.title, skipped: true };

  // Stored file paths are POSIX in production (Linux/NAS); the ambient
  // node:path module follows the host OS instead, which corrupts paths with
  // mixed separators the moment this runs somewhere other than Linux (a
  // Windows dev/test box). Pick the module matching this movie's own path.
  const p = pathFor(movie.file.path);
  const templates = loadNamingTemplates();
  const useDots = templates.useDotsInsteadOfSpaces;
  const ctx = buildMovieCtx(movie.file, movie.year, translated);
  const expectedFolder = renderSegment(templates.movieFolder, ctx, useDots);
  const expectedFile = renderSegment(templates.movieFile, ctx, useDots);
  const ext = p.extname(movie.file.path);
  const base = p.dirname(p.dirname(movie.file.path));
  const expectedPath = p.join(base, expectedFolder, expectedFile + ext);

  if (expectedPath === movie.file.path) {
    return { success: false, id, type: "movie", title: movie.title, skipped: true };
  }

  log(`[MOVIE] ${movie.title}: ${p.basename(p.dirname(movie.file.path))} → ${expectedFolder}`);

  try {
    if (!fs.existsSync(movie.file.path)) {
      throw new Error(`Fichier introuvable à l'emplacement enregistré: ${movie.file.path}`);
    }

    const oldDir = p.dirname(movie.file.path);
    const newDir = p.dirname(expectedPath);
    const oldName = p.basename(movie.file.path);
    const newName = p.basename(expectedPath);

    // 1. Rename folder (if changed)
    if (oldDir !== newDir) {
      await safeMove(oldDir, newDir, log);
    }

    // 2. Rename file inside (possibly new) folder
    const fileDir = oldDir !== newDir ? newDir : oldDir;
    if (oldName !== newName) {
      const srcFile = p.join(fileDir, oldName);
      if (fs.existsSync(srcFile)) {
        await safeMove(srcFile, p.join(fileDir, newName), log);
      } else if (!fs.existsSync(expectedPath)) {
        // Not at the pre-move name, and not already at the destination either — genuinely lost, not "already moved".
        throw new Error(`Fichier introuvable après le déplacement du dossier: ${srcFile}`);
      }
    }

    // 3. Update library record — only once the file is verified to actually be at expectedPath, so the library never claims a move that didn't happen.
    if (!fs.existsSync(expectedPath)) {
      throw new Error(`Fichier introuvable à la destination attendue après déplacement: ${expectedPath}`);
    }
    updateMovie(movie.id, {
      title: translated,
      file: { ...movie.file, path: expectedPath },
    });
    log(`[DONE] ${movie.title} → ${expectedFolder}/${expectedFile}${ext}`);
    return { success: true, id, type: "movie", title: translated };
  } catch (err: any) {
    log(`[ERROR] ${movie.title}: ${err.message}`);
    return { success: false, id, type: "movie", title: movie.title, error: err.message };
  }
}

// ---- series ----

async function renameSeries(id: string, language: string, log: LogFn): Promise<RenameResult> {
  const list = loadSeries();
  const series = list.find((s) => s.id === id);
  if (!series) {
    return { success: false, id, type: "series", title: "", skipped: true };
  }

  const firstEp = series.seasons.flatMap((s) => s.episodes).find((e) => e.file?.path);
  if (!firstEp?.file?.path) {
    return { success: false, id, type: "series", title: series.title, skipped: true };
  }

  const translated = await getTitleInLanguage(series.tmdbId, "series", language);
  if (!translated) return { success: false, id, type: "series", title: series.title, skipped: true };

  const p = pathFor(firstEp.file.path);
  const templates = loadNamingTemplates();
  const useDots = templates.useDotsInsteadOfSpaces;
  const seriesCtx: NamingContext = {
    title: translated, year: series.year ? String(series.year) : null,
    season: null, episode: null, episodeTitle: null,
    quality: "", resolution: null, source: null, videoCodec: null,
    audioCodec: null, hdr: null, group: null,
  };
  const expectedFolder = renderSegment(templates.seriesFolder, seriesCtx, useDots);
  
  // SAFETY: find the common parent of ALL episodes in this series, instead of
  // assuming Show/Season/Ep structure. A flat Show/Ep layout would cause
  // dirname(dirname(...)) to climb too high (into the parent of all shows)
  // and sweepResidualFolder would then move every show into one folder.
  const allEpisodePaths = series.seasons.flatMap(s => s.episodes).filter(e => e.file?.path).map(e => e.file!.path);
  const epParents = allEpisodePaths.map(path => p.dirname(path));
  let seriesRoot = new Set(epParents).size === 1 ? epParents[0] : p.dirname(epParents[0]);
  for (const parent of epParents) {
    while (!parent.startsWith(seriesRoot)) seriesRoot = p.dirname(seriesRoot);
  }
  // NEVER allow the series root to be at the same level as the rename target's parent —
  // that would mean sweeping an entire library folder into a single show.
  const base = p.dirname(seriesRoot);
  // SAFETY: if the common ancestor is at the filesystem root level,
  // we cannot safely determine the series folder — sweepResidualFolder
  // would risk moving the entire parent directory. Skip sweeping but
  // allow the actual episode rename to proceed.
  const depth = seriesRoot.split(p.sep).filter(Boolean).length;
  if (depth <= 1 || seriesRoot === base) {
    log(`[WARN] seriesRoot computed as ${seriesRoot} (depth ${depth}) — skipping folder sweep for safety`);
  }
  const newSeriesDir = p.join(base, expectedFolder);

  // Pre-compute every episode's individual target path. Each one is sourced
  // from its own recorded ep.file.path, independent of the others — a series
  // whose episodes are physically scattered across differently-named source
  // folders on disk (e.g. "South Park" vs "Southpark", a stale partial rename,
  // a messy original import) still converges correctly, because nothing here
  // assumes all episodes share one source folder.
  const epRenames: { oldPath: string; newPath: string; season: number; episode: number }[] = [];
  for (const season of series.seasons) {
    const seasonCtx: NamingContext = {
      title: translated, year: series.year ? String(series.year) : null,
      season: season.seasonNumber, episode: null, episodeTitle: null,
      quality: "", resolution: null, source: null, videoCodec: null,
      audioCodec: null, hdr: null, group: null,
    };
    const newSeasonFolder = renderSegment(templates.seasonFolder, seasonCtx, useDots);
    for (const ep of season.episodes) {
      if (!ep.file?.path) continue;
      const parsed = parseRelease(p.basename(ep.file.path));
      const epCtx: NamingContext = {
        title: translated, year: series.year ? String(series.year) : null,
        season: ep.seasonNumber, episode: ep.episodeNumber, episodeTitle: ep.title || null,
        quality: ep.file.quality ?? "",
        resolution: parsed.resolution ?? ep.file.resolution,
        source: parsed.source, videoCodec: parsed.videoCodec, audioCodec: parsed.audioCodec,
        hdr: parsed.hdr, group: parsed.group,
      };
      const expectedEpFile = renderSegment(templates.episodeFile, epCtx, useDots);
      const ext = p.extname(ep.file.path);
      const expectedEpPath = p.join(newSeriesDir, newSeasonFolder, expectedEpFile + ext);
      if (expectedEpPath !== ep.file.path) {
        epRenames.push({ oldPath: ep.file.path, newPath: expectedEpPath, season: ep.seasonNumber, episode: ep.episodeNumber });
      }
    }
  }

  if (epRenames.length === 0) {
    return { success: false, id, type: "series", title: series.title, skipped: true };
  }

  log(`[SERIES] ${series.title}: → ${expectedFolder} (${epRenames.length}/${series.seasons.reduce((a, s) => a + s.episodes.filter((e) => e.file?.path).length, 0)} episodes to move)`);

  try {
    // Create (or reuse, if a previous partial run already made it) the one
    // unified destination folder every episode converges into.
    fs.mkdirSync(newSeriesDir, { recursive: true });

    const movedEpisodes = new Set<string>();
    for (const r of epRenames) {
      const key = `${r.season}.${r.episode}`;
      try {
        if (r.oldPath === r.newPath) {
          movedEpisodes.add(key);
          continue;
        }
        if (fs.existsSync(r.oldPath)) {
          log(`[MOVE] episode: ${r.oldPath} → ${r.newPath}`);
          await safeMove(r.oldPath, r.newPath, log);
          movedEpisodes.add(key);
        } else if (fs.existsSync(r.newPath)) {
          movedEpisodes.add(key); // already at destination (idempotent re-run)
        } else {
          log(`[ERROR] episode S${r.season}E${r.episode}: introuvable à ${r.oldPath} — fiche bibliothèque laissée inchangée pour cet épisode`);
        }
      } catch (err: any) {
        log(`[ERROR] episode S${r.season}E${r.episode}: ${err.message}`);
      }
    }

    // Sweep every distinct source folder these episodes came from: anything
    // left behind there (subtitles, .nfo, artwork — not individually tracked
    // by Movviz, so never renamed, but still real user data) gets carried
    // into the unified destination too, then the now-empty residual folders
    // are removed. Nothing that can't be safely relocated is ever deleted.
    // SAFETY: use the already-computed seriesRoot, not dirname(dirname(...)).
    // Residual dirs are the individual episode source directories that may contain
    // leftovers (subs, nfo, artwork). Only clean dirs under seriesRoot.
    const residualDirs = new Set(epRenames.map((r) => p.dirname(r.oldPath)));
    residualDirs.delete(newSeriesDir);
    residualDirs.delete(seriesRoot); // never sweep the series root itself
    for (const dir of residualDirs) {
      // Only clean dirs that are children of seriesRoot (season folders, etc.)
      if (dir.startsWith(seriesRoot) && dir !== seriesRoot) {
        await sweepResidualFolder(dir, newSeriesDir, log);
      }
    }
    // After moving season subfolders, clean up the series root if empty.
    // Skip when depth <= 1 to avoid sweeping an entire drive root.
    if (seriesRoot.split(p.sep).filter(Boolean).length > 1) {
      await sweepResidualFolder(seriesRoot, newSeriesDir, log);
    } else {
      log(`[WARN] skipping series root sweep — ${seriesRoot} too close to filesystem root`);
    }

    // 4. Update library records — only for episodes actually confirmed moved,
    // so the library never claims a file lives somewhere it doesn't.
    const newSeasons = series.seasons.map((season) => ({
      ...season,
      episodes: season.episodes.map((ep) => {
        const r = epRenames.find((e) => e.season === ep.seasonNumber && e.episode === ep.episodeNumber);
        if (!r || !ep.file || !movedEpisodes.has(`${r.season}.${r.episode}`)) return ep;
        return { ...ep, file: { ...ep.file, path: r.newPath } };
      }),
    }));
    const seriesPatches = new Map<string, Partial<typeof series>>();
    seriesPatches.set(id, { title: translated, seasons: newSeasons });
    updateSeriesList(seriesPatches);

    const unmoved = epRenames.length - movedEpisodes.size;
    if (unmoved > 0) {
      log(`[PARTIAL] ${series.title}: ${movedEpisodes.size}/${epRenames.length} épisodes déplacés, ${unmoved} introuvable(s)`);
      return { success: false, id, type: "series", title: translated, error: `${unmoved} épisode(s) introuvable(s) sur le disque, voir le journal` };
    }

    log(`[DONE] ${series.title} → ${expectedFolder}`);
    return { success: true, id, type: "series", title: translated };
  } catch (err: any) {
    log(`[ERROR] ${series.title}: ${err.message}`);
    return { success: false, id, type: "series", title: series.title, error: err.message };
  }
}

// ---- public api ----

export async function executeRenames(
  selections: { id: string; type: "movie" | "series" }[],
  language: string,
  setProgress?: (current: number, total: number) => void,
  onLog?: LogFn
): Promise<{ results: RenameResult[]; plexRefreshed: boolean }> {
  const log: LogFn = (msg) => { onLog?.(msg); };
  const results: RenameResult[] = [];

  let done = 0;
  for (const sel of selections) {
    const res = sel.type === "movie"
      ? await renameMovie(sel.id, language, log)
      : await renameSeries(sel.id, language, log);
    results.push(res);
    done++;
    setProgress?.(done, selections.length);
  }

  const okCount = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success && !r.skipped).length;
  const skipped = results.filter((r) => r.skipped).length;
  log(`[SUMMARY] ${results.length} traités — ${okCount} réussis, ${failed} échoués, ${skipped} ignorés`);
  console.log(`[renameExec] done: ${results.length} (${okCount} ok, ${failed} failed, ${skipped} skipped)`);

  let plexRefreshed = false;
  const hadMovies = results.some((r) => r.type === "movie" && r.success);
  const hadSeries = results.some((r) => r.type === "series" && r.success);
  if (hadMovies) { await refreshPlexLibraryFor("movie").catch(() => {}); plexRefreshed = true; }
  if (hadSeries) { await refreshPlexLibraryFor("tv").catch(() => {}); plexRefreshed = true; }

  return { results, plexRefreshed };
}
