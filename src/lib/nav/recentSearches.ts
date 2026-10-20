"use client";

/**
 * Recent searches of the nav search box — a per-browser convenience only
 * (localStorage, every access guarded: private windows and blocked storage
 * simply show no history).
 */
const KEY = "movviz.recentSearches";
const MAX = 6;
const listeners = new Set<() => void>();

export function readRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

function write(list: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX))); } catch { /* storage unavailable */ }
  listeners.forEach((l) => l());
}

/** Records `query`; `replacing` is the previous query of the same typing
 *  session, dropped so "str" → "stranger" leaves a single entry. */
export function rememberSearch(query: string, replacing: string | null) {
  const q = query.trim();
  if (q.length < 2) return;
  const lower = q.toLowerCase();
  const drop = replacing?.toLowerCase();
  write([q, ...readRecentSearches().filter((s) => s.toLowerCase() !== lower && s.toLowerCase() !== drop)]);
}

export function forgetSearch(query: string) {
  write(readRecentSearches().filter((s) => s !== query));
}

export function clearRecentSearches() {
  write([]);
}

export function subscribeRecentSearches(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
