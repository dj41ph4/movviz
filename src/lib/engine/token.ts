import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
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
