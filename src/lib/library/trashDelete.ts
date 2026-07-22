import { ENGINE_BASE, engineHeaders, ENGINE_TIMEOUT_MS } from "@/lib/engine/server";
import { moveToTrash } from "./trashMove";
import { getTrashConfig } from "./trashStore";
import { pathFor } from "./renamePath";

async function engineRoots(): Promise<string[]> {
  const instances = await fetch(`${ENGINE_BASE}/instances`, {
    headers: engineHeaders(),
    cache: "no-store",
    signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS),
  })
    .then((r) => (r.ok ? r.json() : { instances: [] }))
    .then((d) => d.instances ?? [])
    .catch(() => []);
  return (instances as { completedPath?: string }[])
    .map((i) => i.completedPath)
    .filter((p): p is string => !!p);
}

/**
 * True only if `dir` is a genuine subfolder of one of the engine's known
 * library roots — never the root itself. This is the one guard standing
 * between "move this movie's folder to trash" and "accidentally move the
 * entire movie library into trash", so it's deliberately conservative: if
 * in doubt, the caller falls back to moving just the single file instead
 * of the folder.
 *
 * Stored paths are POSIX in production (Linux/NAS); this can also run on a
 * Windows dev/test box. `path.normalize`/`path.sep` are ambient to the host
 * OS, not the path's own convention — using them here would silently
 * rebuild `dir`/`root` with the wrong separator. Each path is normalized
 * with the module matching its own style instead.
 */
function isSafeToMove(dir: string, roots: string[]): boolean {
  const p = pathFor(dir);
  const norm = p.normalize(dir).toLowerCase();
  return roots.some((root) => {
    const rp = pathFor(root);
    const r = rp.normalize(root).toLowerCase();
    return norm !== r && norm.startsWith(r.endsWith(rp.sep) ? r : r + rp.sep);
  });
}

/** The deepest directory shared by every path, or null if there's nothing in common (different drives, empty list, …). */
function commonAncestor(paths: string[]): string | null {
  if (paths.length === 0) return null;
  const p = pathFor(paths[0]);
  const parts = paths.map((f) => p.normalize(p.dirname(f)).split(p.sep));
  let common = parts[0];
  for (const part of parts.slice(1)) {
    let i = 0;
    while (i < common.length && i < part.length && common[i].toLowerCase() === part[i].toLowerCase()) i++;
    common = common.slice(0, i);
    if (common.length === 0) break;
  }
  return common.length > 0 ? common.join(p.sep) : null;
}

/**
 * Moves a movie's file into trash — its whole containing folder when that's
 * safely inside a known library root (catches subs/nfo/artwork alongside
 * the video, same scope the old permanent-delete path covered), or just the
 * file itself when the folder can't be confirmed safe. Returns null (no-op)
 * when movie trash isn't configured — the caller falls back to permanent
 * delete, unchanged from before this feature existed. Throws on real
 * failure; never fails silently.
 */
export async function trashMovieFile(filePath: string): Promise<string | null> {
  const cfg = getTrashConfig();
  if (!cfg.moviesPath) return null;
  const roots = await engineRoots();
  const folder = pathFor(filePath).dirname(filePath);
  const target = isSafeToMove(folder, roots) ? folder : filePath;
  return moveToTrash(target, cfg.moviesPath);
}

/**
 * Same idea for a series: moves the deepest folder shared by every given
 * episode file path (normally the series' own root folder) as a single
 * unit when that folder is safely inside a known library root, or falls
 * back to moving each file individually otherwise. Returns [] when series
 * trash isn't configured.
 */
export async function trashSeriesFiles(filePaths: string[]): Promise<string[]> {
  const cfg = getTrashConfig();
  if (!cfg.seriesPath || filePaths.length === 0) return [];
  const roots = await engineRoots();
  const ancestor = commonAncestor(filePaths);
  if (ancestor && isSafeToMove(ancestor, roots)) {
    return [await moveToTrash(ancestor, cfg.seriesPath)];
  }
  const moved: string[] = [];
  for (const p of filePaths) moved.push(await moveToTrash(p, cfg.seriesPath));
  return moved;
}
