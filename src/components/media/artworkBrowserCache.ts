import type { TitleArtworkByKey } from "./useTitleArtworkBatch";

const PREFIX = "movviz:artwork:v4:";
const MAX_ENTRIES = 600;
const MAX_AGE_MS = 60 * 60 * 1000;
type StoredEntry = { value: TitleArtworkByKey[string]; at: number };
const EMPTY_ARTWORK: TitleArtworkByKey = {};
const snapshots = new Map<string, { raw: string | null; value: TitleArtworkByKey }>();

function validPath(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && /^\/[A-Za-z0-9_/-]+\.(?:jpg|jpeg|png|webp)$/i.test(value));
}

function key(locale: string): string { return `${PREFIX}${locale}`; }

export function browserArtworkSnapshot(locale: string): TitleArtworkByKey {
  if (typeof localStorage === "undefined") return EMPTY_ARTWORK;
  try {
    const raw = localStorage.getItem(key(locale));
    const previous = snapshots.get(locale);
    if (previous?.raw === raw) return previous.value;
    const value = readBrowserArtwork(locale);
    snapshots.set(locale, { raw, value });
    return value;
  } catch { return EMPTY_ARTWORK; }
}

export function subscribeBrowserArtwork(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => { if (event.key?.startsWith(PREFIX)) onChange(); };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

export function emptyBrowserArtwork(): TitleArtworkByKey { return EMPTY_ARTWORK; }

/** Image URLs remain browser-cacheable; this stores only their small title mapping. */
export function readBrowserArtwork(locale: string): TitleArtworkByKey {
  if (typeof localStorage === "undefined") return {};
  try {
    const stored = JSON.parse(localStorage.getItem(key(locale)) ?? "{}") as Record<string, StoredEntry>;
    const result: TitleArtworkByKey = {};
    const now = Date.now();
    for (const [id, entry] of Object.entries(stored)) {
      if (!/^(movie|series):\d+(?::[a-z]+)?$/.test(id) || !entry?.value || now - entry.at > MAX_AGE_MS) continue;
      if (!validPath(entry.value.backdropPath) || !validPath(entry.value.logoPath) || (!entry.value.backdropPath && !entry.value.logoPath)) continue;
      result[id] = entry.value;
    }
    return result;
  } catch { return {}; }
}

export function writeBrowserArtwork(locale: string, artwork: TitleArtworkByKey): void {
  if (typeof localStorage === "undefined") return;
  try {
    const now = Date.now();
    const previous = JSON.parse(localStorage.getItem(key(locale)) ?? "{}") as Record<string, StoredEntry>;
    for (const [id, value] of Object.entries(artwork)) {
      if (/^(movie|series):\d+(?::[a-z]+)?$/.test(id) && validPath(value.backdropPath) && validPath(value.logoPath) && (value.backdropPath || value.logoPath)) {
        previous[id] = { value, at: now };
      }
    }
    const recent = Object.entries(previous).filter(([, entry]) => now - entry.at <= MAX_AGE_MS)
      .sort((a, b) => b[1].at - a[1].at).slice(0, MAX_ENTRIES);
    localStorage.setItem(key(locale), JSON.stringify(Object.fromEntries(recent)));
  } catch { /* Storage can be disabled or full; the server cache still works. */ }
}
