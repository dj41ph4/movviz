import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const STARTED_AT = Date.now();
let cachedCommit: string | null = null;

function resolveCommit(): string {
  if (cachedCommit) return cachedCommit;
  const envCommit =
    process.env.MOVVIZ_GIT_COMMIT ??
    process.env.GIT_COMMIT ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GITHUB_SHA ??
    null;
  if (envCommit && /^[0-9a-f]{7,40}$/i.test(envCommit.trim())) {
    cachedCommit = envCommit.trim();
    return cachedCommit;
  }
  try {
    const out = execSync("git rev-parse HEAD", { encoding: "utf8", timeout: 2000, cwd: process.cwd() }).trim();
    if (/^[0-9a-f]{40}$/i.test(out)) {
      cachedCommit = out;
      return cachedCommit;
    }
  } catch { /* ignore */ }
  try {
    const headPath = path.join(process.cwd(), ".git", "HEAD");
    if (fs.existsSync(headPath)) {
      const head = fs.readFileSync(headPath, "utf8").trim();
      const refMatch = head.match(/^ref:\s*(.+)$/);
      if (refMatch) {
        const refPath = path.join(process.cwd(), ".git", refMatch[1]);
        if (fs.existsSync(refPath)) {
          const commit = fs.readFileSync(refPath, "utf8").trim();
          if (/^[0-9a-f]{40}$/i.test(commit)) {
            cachedCommit = commit;
            return cachedCommit;
          }
        }
      } else if (/^[0-9a-f]{40}$/i.test(head)) {
        cachedCommit = head;
        return cachedCommit;
      }
    }
  } catch { /* ignore */ }
  cachedCommit = "unknown";
  return cachedCommit;
}

function resolveVersion(): string {
  try {
    const pkgPath = path.join(process.cwd(), "package.json");
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8")) as { version?: string };
      if (pkg.version) return pkg.version;
    }
  } catch { /* ignore */ }
  return "unknown";
}

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
  const version = resolveVersion();
  const commit = resolveCommit();
  const dataDir =
    process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data");
  const configDir = process.env.MOVVIZ_CONFIG_DIR ?? dataDir;
  return {
    platform,
    isContainer: container,
    sep: path.sep,
    mode: "browse" as const,
    version,
    gitCommit: commit,
    startedAt: STARTED_AT,
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    dataDir,
    configDir,
    pid: process.pid,
  };
}

export function startupLogLine(): string {
  const info = systemInfo();
  return `movviz.startup version=${info.version} commit=${info.gitCommit.slice(0, 12)} pid=${info.pid} dataDir=${info.dataDir} configDir=${info.configDir} nodeEnv=${info.nodeEnv} startedAt=${new Date(info.startedAt).toISOString()}`;
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
