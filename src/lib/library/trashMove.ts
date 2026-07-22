import fs from "node:fs";
import fsp from "node:fs/promises";
import { pathFor } from "./renamePath";

/**
 * Moves a file or directory into trashRoot, preserving a recognizable name
 * and avoiding collisions (appends " (1)", " (2)", … if the name is already
 * taken — e.g. the same title deleted twice). Throws on any real failure;
 * callers must not remove the library record unless this resolves, so a
 * failed move never silently looks like a successful delete.
 *
 * fs.rename fails with EXDEV when the destination is on a different
 * filesystem/drive than the source (a real scenario here — the trash root
 * is a user-chosen folder, not guaranteed to share a volume with the
 * library). Falls back to copy-then-remove in that case, same approach the
 * download engine uses for its own cross-device moves (engine/src/store.mjs).
 */
export async function moveToTrash(srcPath: string, trashRoot: string): Promise<string> {
  if (!fs.existsSync(srcPath)) throw new Error(`trash move source does not exist: ${srcPath}`);
  fs.mkdirSync(trashRoot, { recursive: true });

  // srcPath and trashRoot can each be POSIX (NAS/production) or Windows
  // style, independently of the host OS's own ambient convention — use the
  // module matching each string's own separators, not `node:path`'s default.
  const base = pathFor(srcPath).basename(srcPath);
  const destPath = pathFor(trashRoot);
  let dest = destPath.join(trashRoot, base);
  let n = 1;
  while (fs.existsSync(dest)) {
    dest = destPath.join(trashRoot, `${base} (${n})`);
    n++;
  }

  try {
    await fsp.rename(srcPath, dest);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EXDEV") throw err;
    await fsp.cp(srcPath, dest, { recursive: true });
    await fsp.rm(srcPath, { recursive: true, force: true });
  }
  return dest;
}
