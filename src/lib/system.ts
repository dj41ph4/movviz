import fs from "node:fs";
import path from "node:path";

/**
 * Server-side filesystem helpers for the folder mapping UI.
 *
 * Movviz is self-hosted, so folder pickers must browse the SERVER's
 * filesystem, not the browser's — this is exactly what lets a NAS/Docker
 * user SEE what folders the container actually has mounted (e.g. /data,
 * /plex) instead of guessing a path blind, which is what caused real
 * mapping mistakes before this existed on non-Windows. listDirs() below is
 * already platform-agnostic (drives are simply empty outside Windows), so
 * browse mode works the same everywhere.
 *
 * Directory listing only — never file contents. This is an admin-only settings
 * surface on a loopback service.
 */

export function isContainer() {
  if (process.env.MOVVIZ_CONTAINER === "1") return true;
  try {
    return fs.existsSync("/.dockerenv") || fs.existsSync("/run/.containerenv");
  } catch {
    return false;
  }
}

export function systemInfo() {
  const platform = process.platform; // 'win32' | 'linux' | 'darwin'
  const container = isContainer();
  return {
    platform,
    isContainer: container,
    sep: path.sep,
    // Always browse — listDirs() works the same on every platform, and
    // seeing the container's real mounted folders instead of guessing a
    // path is exactly what avoids NAS mapping mistakes.
    mode: "browse" as const,
  };
}

/** List available drive roots on Windows (C:\, D:\ …). */
export function listDrives(): string[] {
  const drives: string[] = [];
  for (let c = 65; c <= 90; c++) {
    const root = `${String.fromCharCode(c)}:\\`;
    try {
      fs.accessSync(root);
      drives.push(root);
    } catch {
      /* not present */
    }
  }
  return drives;
}

/** List sub-directories of a path (for the folder browser). */
export function listDirs(target: string) {
  const dir = target && target.trim() ? target : (process.platform === "win32" ? "" : "/");

  // Empty on Windows means "show drives".
  if (!dir && process.platform === "win32") {
    return { path: "", parent: null, isRoot: true, drives: listDrives(), dirs: [] };
  }

  const resolved = path.resolve(dir);
  let entries: string[] = [];
  try {
    entries = fs
      .readdirSync(resolved, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .filter((n) => !n.startsWith("$"))
      .sort((a, b) => a.localeCompare(b));
  } catch {
    entries = [];
  }

  const parent = path.dirname(resolved);
  const atRoot = parent === resolved;

  return {
    path: resolved,
    // On Windows, going up from a drive root returns to the drive list.
    parent: atRoot ? (process.platform === "win32" ? "" : null) : parent,
    isRoot: false,
    drives: process.platform === "win32" ? listDrives() : [],
    dirs: entries.map((name) => ({ name, path: path.join(resolved, name) })),
  };
}
