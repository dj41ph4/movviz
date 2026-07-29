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
const buffer: LogEntry[] = [];

function add(entry: LogEntry) {
  buffer.push(entry);
  while (buffer.length > MAX) buffer.shift();
}

export function logTranscode(ratingKey: string, step: string, detail: string, status: number | "ok" = "ok") {
  add({ time: Date.now(), ratingKey, step, detail, status });
}

export function getTranscodeLogs(): LogEntry[] {
  return [...buffer];
}

export function clearTranscodeLogs(): void {
  buffer.length = 0;
}
