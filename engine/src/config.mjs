import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import crypto from "node:crypto";

/**
 * Engine configuration + OS-aware storage layout.
 *
 * Movviz separates two roots:
 *   - CONFIG_DIR : app config, database, engine state (small, private)
 *   - DATA_DIR   : media root — where torrents download and the library lives
 *
 * Both are resolved automatically per platform, and always overridable with
 * MOVVIZ_CONFIG_DIR / MOVVIZ_DATA_DIR. On a NAS (container) the roots are the
 * conventional /config and /data mounts.
 *
 * Torrents and the finished library live under the SAME DATA_DIR on purpose:
 * an import is then an instant atomic move (rename) instead of a slow copy.
 */

const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);

function isContainer() {
  if (process.env.MOVVIZ_CONTAINER === "1") return true;
  try {
    return fs.existsSync("/.dockerenv") || fs.existsSync("/run/.containerenv");
  } catch {
    return false;
  }
}

function resolveDirs() {
  const envConfig = process.env.MOVVIZ_CONFIG_DIR;
  const envData = process.env.MOVVIZ_DATA_DIR;
  if (envConfig || envData) {
    const config = envConfig ?? envData;
    const data = envData ?? path.join(config, "data");
    return { config, data, mode: "custom (env)" };
  }

  // Dev: keep everything inside the project so nothing pollutes the machine.
  if (process.env.NODE_ENV !== "production") {
    const base = path.join(process.cwd(), ".movviz-data");
    return { config: base, data: base, mode: "development" };
  }

  // NAS / Docker: the conventional mounts.
  if (isContainer()) {
    return { config: "/config", data: "/data", mode: "container (NAS)" };
  }

  // Windows service: machine-wide, under ProgramData.
  if (process.platform === "win32") {
    const base = process.env.ProgramData
      ? path.join(process.env.ProgramData, "Movviz")
      : path.join(os.homedir(), "Movviz");
    return { config: base, data: path.join(base, "data"), mode: "windows" };
  }

  // Linux service (root): FHS-style under /var/lib.
  if (typeof process.getuid === "function" && process.getuid() === 0) {
    return { config: "/var/lib/movviz", data: "/var/lib/movviz/data", mode: "linux (system)" };
  }

  // Linux user: XDG data home.
  const xdg = process.env.XDG_DATA_HOME ?? path.join(os.homedir(), ".local", "share");
  const base = path.join(xdg, "movviz");
  return { config: base, data: path.join(base, "data"), mode: "linux (user)" };
}

const dirs = resolveDirs();
export const CONFIG_DIR = dirs.config;
export const DATA_DIR = dirs.data; // media root
export const PATH_MODE = dirs.mode;
export const STATE_FILE = path.join(CONFIG_DIR, "engine-state.json");
/**
 * Cached .torrent metainfo, one file per active torrent. Resuming from the
 * metainfo instead of the magnet link means a restart never depends on the
 * swarm: the engine can immediately re-verify what's already on disk and
 * carry on, instead of sitting at 0% waiting for peers to serve metadata.
 */
export const TORRENT_CACHE_DIR = path.join(CONFIG_DIR, "torrent-cache");

export const ENGINE_PORT = num(process.env.MOVVIZ_ENGINE_PORT, 9820);
export const ENGINE_HOST = process.env.MOVVIZ_ENGINE_HOST ?? "127.0.0.1";
export const HOSTNAME = os.hostname();

/**
 * Shared secret with the web app — same file the web side reads/writes
 * (src/lib/engine/token.ts), so whichever process starts first generates it
 * and the other just picks it up. Used both ways: the web app sends it on
 * every call into the engine's own API (checked in api.mjs), and the engine
 * sends it back on its callbacks into the web app (import complete, activity
 * log) so those routes can tell a real engine call apart from anyone who can
 * reach the web port.
 */
function resolveEngineToken() {
  if (process.env.MOVVIZ_ENGINE_TOKEN) return process.env.MOVVIZ_ENGINE_TOKEN;
  const file = path.join(CONFIG_DIR, "engine-token.json");
  try {
    const existing = JSON.parse(fs.readFileSync(file, "utf8"));
    if (existing?.token) return existing.token;
  } catch {}
  const token = crypto.randomUUID();
  try {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ token }, null, 2), "utf8");
  } catch {}
  return token;
}
export const ENGINE_TOKEN = resolveEngineToken();

/**
 * BitTorrent peer wire port (TCP) and DHT port (UDP) — unlike the internal
 * API port above, these need to be reachable FROM THE INTERNET for incoming
 * peer connections to work at all. Without a fixed, forwarded port, every
 * WebTorrent client here picks a random port on each start, which means
 * nothing can ever be port-forwarded on the router/NAS firewall — downloads
 * then only ever get outbound connections, which is dramatically slower and
 * looks like random stalls/timeouts on anything that isn't heavily seeded.
 * Each instance gets its own fixed port (offset by index) since they're
 * separate WebTorrent clients in the same process and can't share one.
 */
export const TORRENT_PORT_BASE = num(process.env.MOVVIZ_TORRENT_PORT, 51413);

/** Where the web app lives, so the engine can report import completion. */
export const WEB_CALLBACK_URL =
  process.env.MOVVIZ_WEB_CALLBACK_URL ??
  `http://127.0.0.1:${process.env.MOVVIZ_WEB_PORT ?? "9810"}`;

/**
 * Default per-category instances. Torrents download under DATA_DIR/torrents/*
 * and finished media lands in DATA_DIR/media/* — same volume, so imports are
 * instant. Each instance stays independent and every field is overridable.
 */
export const DEFAULT_INSTANCES = [
  {
    id: "movies",
    category: "movie",
    name: "Movies",
    downloadPath: path.join(DATA_DIR, "torrents", "movies"),
    completedPath: path.join(DATA_DIR, "media", "movies"),
    maxActive: 4,
    downloadLimitKbps: 0,
    uploadLimitKbps: 0,
    seedRatio: 2.0,
    sequential: false,
    autoStart: true,
    autoMoveOnComplete: true,
    dht: true,
    pex: true,
    maxPeers: 55,
    uploadSlots: 0,
    torrentPort: TORRENT_PORT_BASE,
  },
  {
    id: "series",
    category: "series",
    name: "Series",
    downloadPath: path.join(DATA_DIR, "torrents", "tv"),
    completedPath: path.join(DATA_DIR, "media", "tv"),
    maxActive: 6,
    downloadLimitKbps: 0,
    uploadLimitKbps: 0,
    seedRatio: 1.5,
    sequential: false,
    autoStart: true,
    autoMoveOnComplete: true,
    dht: true,
    pex: true,
    maxPeers: 55,
    uploadSlots: 0,
    torrentPort: TORRENT_PORT_BASE + 1,
  },
];
