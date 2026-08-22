import fs from "node:fs";
import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

export type ArtworkTitleType = "movie" | "series";

export type CachedTitleArtwork = {
  /** TMDb paths; the matching immutable bytes live in `tmdb-artwork/` on disk. */
  backdropPath: string | null;
  logoPath: string | null;
  fetchedAt: number;
};

type ArtworkStore = {
  version: 1;
  entries: Record<string, CachedTitleArtwork>;
};

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "title-artwork-cache.json");

// TMDb's artwork file paths are immutable. Keep the selected backdrop/logo
// pair for a full year: daily maintenance then needs to process only newly
// added titles, not re-download the same artwork over and over.
export const ARTWORK_REVALIDATE_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_ENTRIES = 20_000;

function normalizedLocale(locale?: string): string {
  const candidate = locale?.trim().toLowerCase();
  return candidate && /^[a-z]{2}$/.test(candidate) ? candidate : "fr";
}

function keyOf(type: ArtworkTitleType, tmdbId: number, locale?: string): string {
  return `${type}:${tmdbId}:${normalizedLocale(locale)}`;
}

function loadStore(): ArtworkStore {
  const raw = readJsonCached<Partial<ArtworkStore> | null>(FILE, null);
  return raw?.version === 1 && raw.entries && typeof raw.entries === "object"
    ? { version: 1, entries: raw.entries }
    : { version: 1, entries: {} };
}

/**
 * Returns only fresh paths. A cache miss is deliberately cheap: callers can
 * batch the missing ids in one request instead of each card asking TMDb.
 */
export function loadCachedTitleArtwork(
  refs: readonly { type: ArtworkTitleType; tmdbId: number }[],
  locale?: string
): Record<string, CachedTitleArtwork> {
  const entries = loadStore().entries;
  const now = Date.now();
  const found: Record<string, CachedTitleArtwork> = {};

  for (const ref of refs) {
    const entry = entries[keyOf(ref.type, ref.tmdbId, locale)];
    if (entry && Number.isFinite(entry.fetchedAt) && now - entry.fetchedAt < ARTWORK_REVALIDATE_MS) {
      found[`${ref.type}:${ref.tmdbId}`] = entry;
    }
  }
  return found;
}

/**
 * Selects library artwork that needs a TMDb metadata refresh without fetching
 * anything. The complete pass itself still verifies/downloads the image bytes
 * for every title; the incremental pass also revisits the rare entry that has
 * reached its annual metadata revalidation date.
 */
export function selectTitleArtworkForWarm(
  refs: readonly { type: ArtworkTitleType; tmdbId: number }[],
  mode: "complete" | "incremental",
  locale?: string
): { type: ArtworkTitleType; tmdbId: number }[] {
  const entries = loadStore().entries;
  const now = Date.now();
  return refs.filter((ref) => {
    const entry = entries[keyOf(ref.type, ref.tmdbId, locale)];
    if (!entry) return true;
    return mode === "incremental" && (!Number.isFinite(entry.fetchedAt) || now - entry.fetchedAt >= ARTWORK_REVALIDATE_MS);
  });
}

/** Persists compact TMDb paths; downloaded image files use tmdbImageCache.ts. */
export function cacheTitleArtwork(
  values: readonly {
    type: ArtworkTitleType;
    tmdbId: number;
    backdropPath: string | null;
    logoPath: string | null;
  }[],
  locale?: string
): void {
  if (values.length === 0) return;

  const store = loadStore();
  const fetchedAt = Date.now();
  for (const value of values) {
    if (!Number.isInteger(value.tmdbId) || value.tmdbId <= 0) continue;
    store.entries[keyOf(value.type, value.tmdbId, locale)] = {
      backdropPath: value.backdropPath,
      logoPath: value.logoPath,
      fetchedAt,
    };
  }

  const entries = Object.entries(store.entries);
  if (entries.length > MAX_ENTRIES) {
    entries
      .sort(([, a], [, b]) => a.fetchedAt - b.fetchedAt)
      .slice(0, entries.length - MAX_ENTRIES)
      .forEach(([key]) => delete store.entries[key]);
  }

  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, store);
}
