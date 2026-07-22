import path from "node:path";

/**
 * Picks the path module matching the path's OWN separator convention,
 * instead of whatever the ambient `node:path` module defaults to for the
 * host OS. Movviz's stored file paths are POSIX (Linux/NAS in production),
 * but the dev machine testing against a copy of that data is Windows —
 * where the ambient `path` module is `path.win32`, and calling
 * `path.dirname`/`path.join` on a POSIX path like
 * "/volume1/docker/plex/films/X" silently reconstructs it with backslashes,
 * corrupting the path (`\volume1\docker\...`) well before any file move is
 * even attempted. Every path computation in the rename feature must use the
 * module returned here instead of the bare `path` import.
 */
export function pathFor(samplePath: string): typeof path.posix {
  const isWindowsStyle = /^[a-zA-Z]:[\\/]/.test(samplePath) || (samplePath.includes("\\") && !samplePath.includes("/"));
  return isWindowsStyle ? path.win32 : path.posix;
}
