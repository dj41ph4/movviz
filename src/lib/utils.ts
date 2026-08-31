import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { MouseEvent } from "react";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * "Lire sur Plex" links already point at app.plex.tv, which the Plex apps
 * register as an iOS Universal Link / Android App Link target — the OS
 * silently opens the native app instead of the browser when it's installed,
 * with zero JS involved, and falls through to the normal web page when it
 * isn't. There's nothing to "detect" for an https link like there would be
 * for an old custom-scheme deep link (no app installed ≠ an error to catch,
 * it just loads the page). The one real lever left: some browsers are less
 * reliable at handing a `target="_blank"` tap to the OS for interception
 * than a plain top-level navigation — same-tab is used on a phone-sized
 * viewport (checked at click time only, never during render, so this never
 * causes a hydration mismatch), desktop keeps opening a new tab as before.
 */
export function openPlexLink(e: MouseEvent, url: string) {
  if (typeof window === "undefined" || window.innerWidth >= 640) return;
  e.preventDefault();
  window.location.href = url;
}

/** TMDB image helper — proxied through /tmdb/ rewrite to eliminate CORS warnings. */
export function tmdbImg(path: string | null, size: "w500" | "original" = "w500") {
  if (!path) return null;
  return `/tmdb/${size}${path}`;
}

/** Locale-aware relative time ("53 minutes ago" / "il y a 53 minutes" / ...)
 *  via Intl.RelativeTimeFormat — every unit and its plural/grammar rules
 *  come from the locale itself instead of a hand-rolled "Xd ago" suffix that
 *  was always English regardless of the app's active language. */
export function relativeTime(iso: string, locale: string = "en") {
  const diffMs = new Date(iso).getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (absMs < 60000) return rtf.format(0, "second");
  const min = Math.round(diffMs / 60000);
  if (absMs < 3600000) return rtf.format(min, "minute");
  const hr = Math.round(diffMs / 3600000);
  if (absMs < 86400000) return rtf.format(hr, "hour");
  const d = Math.round(diffMs / 86400000);
  return rtf.format(d, "day");
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

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Date format "23 Jul 2026" — compact, locale-independent. */
export function formatDateTime(ts: number, _locale: string = "en") {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getDate()).padStart(2, "0")} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
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
