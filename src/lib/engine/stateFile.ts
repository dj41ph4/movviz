import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { EngineInstance } from "@/lib/types";
import { readJsonCached } from "@/lib/fsJsonCache";

/**
 * Direct (bypassing the HTTP API) access to the engine's persisted state
 * file — used only as a fallback when the engine process itself isn't
 * reachable, so download client folders/limits can still be viewed and
 * edited from Settings instead of being stuck until someone can reach a
 * shell on the NAS. The engine picks these up the next time it starts,
 * since `configs()` in engine/src/engine.mjs already merges persisted
 * instance config over the defaults — this just writes to the same file
 * from the other side. Mirrors engine/src/config.mjs's own dir resolution
 * so both processes agree on where the file lives.
 */

function isContainer() {
  if (process.env.MOVVIZ_CONTAINER === "1") return true;
  try {
    return fs.existsSync("/.dockerenv") || fs.existsSync("/run/.containerenv");
  } catch {
    return false;
  }
}

function resolveConfigDir(): string {
  const envConfig = process.env.MOVVIZ_CONFIG_DIR;
  const envData = process.env.MOVVIZ_DATA_DIR;
  if (envConfig || envData) return envConfig ?? envData!;
  if (process.env.NODE_ENV !== "production") return path.join(process.cwd(), ".movviz-data");
  if (isContainer()) return "/config";
  if (process.platform === "win32") {
    return process.env.ProgramData ? path.join(process.env.ProgramData, "Movviz") : path.join(os.homedir(), "Movviz");
  }
  if (typeof process.getuid === "function" && process.getuid() === 0) return "/var/lib/movviz";
  const xdg = process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share");
  return path.join(xdg, "movviz");
}

const STATE_FILE = path.join(resolveConfigDir(), "engine-state.json");

interface EngineStateFile {
  instances?: Record<string, Record<string, unknown>>;
  torrents?: unknown[];
  savedAt?: number;
}

function readState(): EngineStateFile {
  return readJsonCached<EngineStateFile>(STATE_FILE, {});
}

function writeState(state: EngineStateFile) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  const tmp = `${STATE_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
  fs.renameSync(tmp, STATE_FILE);
}

/** Persist a config patch for one instance directly to disk — used when the live engine can't be reached. */
export function patchInstanceConfigOffline(id: string, patch: Record<string, unknown>) {
  const state = readState();
  const instances = state.instances ?? {};
  instances[id] = { ...(instances[id] ?? {}), ...patch };
  writeState({ ...state, instances });
}

/** Same shape as engine/src/config.mjs's DEFAULT_INSTANCES, needed here since the engine package isn't importable from the web app. */
const DEFAULT_INSTANCE_SHAPES: Record<string, Partial<EngineInstance>> = {
  movies: {
    id: "movies", category: "movie", name: "Movies",
    downloadPath: path.resolve(resolveConfigDir(), "..", "data", "torrents", "movies"),
    completedPath: path.resolve(resolveConfigDir(), "..", "data", "media", "movies"),
    maxActive: 4, downloadLimitKbps: 0, uploadLimitKbps: 0, seedRatio: 2.0,
    sequential: false, autoStart: true, autoMoveOnComplete: true, dht: true, pex: true,
  },
  series: {
    id: "series", category: "series", name: "Series",
    downloadPath: path.resolve(resolveConfigDir(), "..", "data", "torrents", "tv"),
    completedPath: path.resolve(resolveConfigDir(), "..", "data", "media", "tv"),
    maxActive: 6, downloadLimitKbps: 0, uploadLimitKbps: 0, seedRatio: 1.5,
    sequential: false, autoStart: true, autoMoveOnComplete: true, dht: true, pex: true,
  },
};

/** Best-effort instance list to render in Settings while the engine is unreachable — persisted overrides merged over the built-in shapes, with live stats zeroed out. */
export function offlineInstancesSnapshot(): EngineInstance[] {
  const saved = readState().instances ?? {};
  return Object.entries(DEFAULT_INSTANCE_SHAPES).map(([id, base]) => ({
    ...base,
    ...(saved[id] ?? {}),
    active: 0,
    seeding: 0,
    total: 0,
    downloadSpeed: 0,
    uploadSpeed: 0,
  } as EngineInstance));
}
