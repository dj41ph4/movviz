/**
 * In-memory ring buffer of the engine's own console output — the NAS/Docker
 * setup rarely gives easy access to `docker logs`, so this makes the recent
 * history available through the API (and Settings > Diagnostics) instead,
 * to actually diagnose things like port/connectivity issues without needing
 * shell access to the host.
 */

const MAX_LINES = 500;
const buffer = [];

function stringify(v) {
  if (typeof v === "string") return v;
  if (v instanceof Error) return v.stack ?? v.message;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function record(level, args) {
  buffer.push({ t: Date.now(), level, message: args.map(stringify).join(" ") });
  if (buffer.length > MAX_LINES) buffer.shift();
}

const original = { log: console.log, warn: console.warn, error: console.error };

export function installLogger() {
  console.log = (...args) => {
    record("info", args);
    original.log(...args);
  };
  console.warn = (...args) => {
    record("warn", args);
    original.warn(...args);
  };
  console.error = (...args) => {
    record("error", args);
    original.error(...args);
  };
}

export function getLogs() {
  return buffer;
}
