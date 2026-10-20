import path from "node:path";
import { CONFIG_DIR } from "@/lib/auth/store";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

/**
 * YouTube videos that refused to play embedded in a real browser (error
 * 101/150: the rights holder forbids playback outside YouTube — e.g. Toei's
 * own Dragon Ball trailers). TMDb never flags this, so the knowledge comes
 * from players reporting it; known-blocked keys are then dropped from every
 * candidate list (web hero, title pages, TV/mobile clients).
 *
 * Bounded set on globalThis, debounced disk flush — never a synchronous
 * write on a request path.
 */
const FILE = path.join(CONFIG_DIR, "blocked-youtube-videos.json");
const MAX_KEYS = 5_000;
const KEY = /^[A-Za-z0-9_-]{11}$/;

type State = { keys: Set<string>; timer: ReturnType<typeof setTimeout> | null };
const g = globalThis as typeof globalThis & { __movvizBlockedVideos?: State };

function state(): State {
  if (!g.__movvizBlockedVideos) {
    const stored = readJsonCached<string[]>(FILE, []);
    g.__movvizBlockedVideos = { keys: new Set(Array.isArray(stored) ? stored.filter((k) => KEY.test(k)) : []), timer: null };
  }
  return g.__movvizBlockedVideos;
}

export function isValidVideoKey(key: string): boolean {
  return KEY.test(key);
}

export function isBlockedVideo(key: string): boolean {
  return state().keys.has(key);
}

export function blockedVideoKeys(): ReadonlySet<string> {
  return state().keys;
}

export function markVideosBlocked(keys: string[]): void {
  const s = state();
  let changed = false;
  for (const key of keys) {
    if (!KEY.test(key) || s.keys.has(key)) continue;
    s.keys.add(key);
    changed = true;
  }
  // Oldest entries go first once the bound is reached (Set keeps insertion order).
  while (s.keys.size > MAX_KEYS) s.keys.delete(s.keys.values().next().value as string);
  if (!changed || s.timer) return;
  s.timer = setTimeout(() => {
    s.timer = null;
    writeJsonCached(FILE, [...s.keys]);
  }, 5_000);
}
