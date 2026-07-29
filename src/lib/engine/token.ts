import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";

function resolveConfigDir(): string {
  const envConfig = process.env.MOVVIZ_CONFIG_DIR;
  const envData = process.env.MOVVIZ_DATA_DIR;
  if (envConfig || envData) return envConfig ?? envData!;
  if (process.env.NODE_ENV !== "production") return path.join(process.cwd(), ".movviz-data");
  if (process.platform === "win32") {
    return process.env.ProgramData ? path.join(process.env.ProgramData, "Movviz") : path.join(os.homedir(), "Movviz");
  }
  if (typeof process.getuid === "function" && process.getuid() === 0) return "/var/lib/movviz";
  const xdg = process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share");
  return path.join(xdg, "movviz");
}

const CONFIG_DIR = resolveConfigDir();
const FILE = path.join(CONFIG_DIR, "engine-token.json");

let cached: string | null = null;

/**
 * Shared secret between the web app and the download engine — the engine
 * sends it back on its own callbacks (import complete, activity log) so
 * those routes can tell a real engine call apart from anyone who can reach
 * the web port. Auto-generated once and persisted, so it works out of the
 * box without any manual config; MOVVIZ_ENGINE_TOKEN still overrides it for
 * anyone who wants to pin it explicitly.
 */
export function getEngineToken(): string {
  if (cached) return cached;
  if (process.env.MOVVIZ_ENGINE_TOKEN) {
    cached = process.env.MOVVIZ_ENGINE_TOKEN;
    return cached;
  }
  try {
    const existing = JSON.parse(fs.readFileSync(FILE, "utf8"));
    if (existing?.token) {
      cached = existing.token;
      return cached as string;
    }
  } catch {
    // First run, or file missing/corrupt — generate a fresh one below.
  }
  const token = randomUUID();
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify({ token }, null, 2), "utf8");
  } catch {
    // Read-only filesystem edge case — still usable for this process's
    // lifetime, just won't survive a restart until it can persist.
  }
  cached = token;
  return token;
}
