import fs from "node:fs";
import path from "node:path";

/** Select an existing writable shared folder, without creating anything. */
export function chooseSynologyStorage(volumes: string[], writable: (shared: string) => boolean) {
  for (const volume of volumes) {
    const shared = path.posix.join(volume, "video");
    if (!writable(shared)) continue;
    return {
      movies: { completedPath: path.posix.join(shared, "Films"), downloadPath: path.posix.join(shared, "Telechargements", "Films") },
      series: { completedPath: path.posix.join(shared, "Series"), downloadPath: path.posix.join(shared, "Telechargements", "Series") },
    };
  }
  return null;
}

/** Proposals only: saved paths are never changed by this function. */
export function synologyStorageSuggestions(configDir: string, container: boolean) {
  if (process.platform !== "linux" || container || path.resolve(configDir) !== "/var/packages/movviz/var") return null;
  let names: string[];
  try { names = fs.readdirSync("/").filter((name) => /^volume[1-9]\d*$/.test(name)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })); }
  catch { return { volumes: [], suggestions: null }; }
  const volumes = names.map((name) => `/${name}`).filter((volume) => {
    try { return fs.statSync(volume).isDirectory(); } catch { return false; }
  });
  const suggestions = chooseSynologyStorage(volumes, (shared) => {
    try { if (!fs.statSync(shared).isDirectory()) return false; fs.accessSync(shared, fs.constants.W_OK | fs.constants.X_OK); return true; }
    catch { return false; }
  });
  return { volumes, suggestions };
}
