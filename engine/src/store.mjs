import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { STATE_FILE, CONFIG_DIR } from "./config.mjs";

/**
 * Durable engine state (instance configs + the set of torrents to resume).
 * Written atomically so a crash never leaves a half-written file.
 */

export async function ensureDir(dir) {
  await fsp.mkdir(dir, { recursive: true });
}

export function loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

let saveTimer = null;
let pending = null;

/** Debounced atomic save — coalesces bursts of mutations into one write. */
export function scheduleSave(state) {
  pending = state;
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    const snapshot = pending;
    pending = null;
    writeState(snapshot).catch((e) =>
      console.error("[engine] state save failed:", e.message)
    );
  }, 800);
}

export async function writeState(state) {
  await ensureDir(CONFIG_DIR);
  // Unique per call — two writeState()s can overlap (scheduleSave's debounce
  // only prevents redundant SCHEDULING, not a slow write still in flight
  // when the next one starts), and a shared ".tmp" name meant the first
  // rename could consume the file out from under the second, which then hit
  // ENOENT trying to rename a ".tmp" that no longer existed.
  const tmp = `${STATE_FILE}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  await fsp.writeFile(tmp, JSON.stringify(state, null, 2), "utf8");
  await fsp.rename(tmp, STATE_FILE);
}

/** Recursively move a directory/file, falling back to copy+delete across drives. */
export async function movePath(src, dest) {
  await ensureDir(path.dirname(dest));
  try {
    await fsp.rename(src, dest);
  } catch (err) {
    if (err.code === "EXDEV") {
      await fsp.cp(src, dest, { recursive: true });
      await fsp.rm(src, { recursive: true, force: true });
    } else {
      throw err;
    }
  }
}

/**
 * Hardlink a file into place, falling back to a plain copy when linking is
 * impossible (different volume, filesystem without hardlinks…). Linking is
 * what lets a finished download live in the library instantly while the
 * torrent keeps seeding from the download folder: both paths share the same
 * data on disk, so it costs no time and no extra space.
 */
export async function linkOrCopy(src, dest) {
  await ensureDir(path.dirname(dest));
  try {
    await fsp.link(src, dest);
  } catch (err) {
    if (err.code !== "EEXIST") {
      await fsp.cp(src, dest, { recursive: true });
      return;
    }
    // A file already sits at dest (e.g. a previous, incomplete attempt at
    // the same episode) — replace it instead of silently keeping whatever
    // was there before, otherwise a re-grab can "succeed" while the stale
    // file never actually gets updated.
    await fsp.rm(dest, { force: true });
    try {
      await fsp.link(src, dest);
    } catch {
      await fsp.cp(src, dest, { recursive: true });
    }
  }
}
