import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** TMDB image helper with graceful degradation. */
export function tmdbImg(path: string | null, size: "w500" | "original" = "w500") {
  if (!path) return null;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.round(hr / 24);
  return `${d}d ago`;
}

/** Human release/air date, e.g. "5 juil. 2026" (fr) / "Jul 5, 2026" (en). */
export function formatDate(dateStr: string | null | undefined, locale: string = "en") {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

/** Wall-clock time of a timestamp, e.g. "07:49" — force 24h (hourCycle: "h23")
 *  so the column width is stable across locales (en-US's "7:49 AM" is wider
 *  than fr's "07:49" and would cause layout shifts in timestamp columns). */
export function formatClockTime(ts: number, locale: string = "en") {
  return new Date(ts).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
}

/** Full date + time, e.g. "22 juil. 2026, 07:49" — for tooltips and detail rows. */
export function formatDateTime(ts: number, locale: string = "en") {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}, ${d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}`;
}

// A torrent that just started can report an almost-zero (but nonzero) speed
// for its very first tick — mathematically consistent (remaining bytes /
// tiny speed), but the result ("795652389m") is noise, not information.
// Past a month there's nothing actionable left to show.
const ETA_MAX_MINUTES = 30 * 24 * 60;

export function formatEta(minutes: number) {
  if (minutes < 0 || minutes > ETA_MAX_MINUTES) return "—";
  if (minutes === 0) return "<1m";
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function formatBytes(bytes: number) {
  if (!bytes || bytes < 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / Math.pow(1024, i)).toFixed(i ? 1 : 0)} ${units[i]}`;
}

export function formatSpeed(bytesPerSec: number) {
  if (!bytesPerSec || bytesPerSec < 1) return "—";
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatEtaMs(ms: number | null) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  const min = Math.round(ms / 60000);
  return formatEta(min);
}

/** Deterministic accent gradient from a string seed (stable across renders). */
export function seedGradient(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  const h2 = (h + 60) % 360;
  return `linear-gradient(135deg, hsl(${h} 70% 22%), hsl(${h2} 65% 12%))`;
}
