/**
 * In-process transcode log buffer — visible in Settings → Diagnostics.
 * Stores the last 50 transcode attempts with details (Plex response, codecs, etc.)
 */

interface LogEntry {
  time: number;
  ratingKey: string;
  step: string;
  detail: string;
  status: number | "ok";
}

const MAX = 50;

function getBuffer(): LogEntry[] {
  const g = globalThis as unknown as { __movvizTranscodeLogs?: LogEntry[] };
  if (!g.__movvizTranscodeLogs) g.__movvizTranscodeLogs = [];
  return g.__movvizTranscodeLogs;
}

export function logTranscode(ratingKey: string, step: string, detail: string, status: number | "ok" = "ok") {
  const buf = getBuffer();
  buf.push({ time: Date.now(), ratingKey, step, detail, status });
  while (buf.length > MAX) buf.shift();
}

export function getTranscodeLogs(): LogEntry[] {
  return [...getBuffer()];
}

export function clearTranscodeLogs(): void {
  getBuffer().length = 0;
}
