/**
 * In-memory ring buffer of the engine child process's raw stdout/stderr,
 * captured on the WEB APP's side (see bootstrap.ts). The engine's own
 * /logs endpoint (src/lib/engine/logger.mjs) is useless for exactly the
 * case that matters most — the engine crashing before it can even bind its
 * HTTP API — since there's then nothing alive to ask. This buffer is what
 * /api/engine/logs falls back to when the live engine can't be reached, so
 * a startup crash is still visible from Settings > Diagnostics instead of
 * only in `docker logs` (which most NAS users have no easy way to read).
 */

const MAX_LINES = 500;

export interface CrashLogLine {
  t: number;
  level: "info" | "error";
  message: string;
}

// Anchored on globalThis: Next.js compiles instrumentation.ts (which feeds
// this buffer via bootstrap.ts) and the API routes (which read it) as
// separate bundles, so a plain module-level array would exist twice — one
// copy always written, the other always read empty.
const g = globalThis as typeof globalThis & { __movvizEngineCrashLog?: CrashLogLine[] };
const buffer: CrashLogLine[] = (g.__movvizEngineCrashLog ??= []);

export function recordEngineOutput(level: "info" | "error", chunk: string) {
  for (const line of chunk.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    buffer.push({ t: Date.now(), level, message: trimmed });
  }
  while (buffer.length > MAX_LINES) buffer.shift();
}

export function getEngineCrashLog(): CrashLogLine[] {
  return buffer;
}
