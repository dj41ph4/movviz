import fs from "node:fs";
import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

export type ArtworkTitleType = "movie" | "series";

export type CachedTitleArtwork = {
  /** TMDb paths; the matching immutable bytes live in `tmdb-artwork/` on disk. */
  backdropPath: string | null;
  logoPath: string | null;
  /** The selected backdrop already includes its own title treatment. */
  titleEmbedded: boolean;
  /** Selection rules version, distinct from the JSON store schema. */
  selectionVersion: number;
  fetchedAt: number;
};

type ArtworkStore = {
  version: 2;
  entries: Record<string, CachedTitleArtwork>;
  /** Persistent round-robin position for the daily incremental byte check. */
  incrementalCursor?: number;
};

// v1 had the same entries format but no incremental cursor. Keep this loose
// on purpose so an installed v1 cache survives the schema bump to v2.
type PersistedArtworkStore = Omit<ArtworkStore, "version"> & { version?: 1 | 2 };

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "title-artwork-cache.json");
const STORE_VERSION = 2;
// v2 selects a localized 16:9 key-art fallback when TMDb has no neutral
// backdrop. Previous cached null pairs must be revisited once, otherwise a
// title that has art in its full detail page remains empty on dashboard cards
// for a year.
// v3 re-ranks title marks by UI language (French → neutral → English) and
// makes old blank logo selections eligible for a one-time repair.
const EDITORIAL_SELECTION_VERSION = 3;

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
  const raw = readJsonCached<PersistedArtworkStore | null>(FILE, null);
  // Version 2 only adds the round-robin cursor. Existing v1 backdrop/logo
  // pairs are already valid immutable TMDb paths, so throwing them away on a
  // code upgrade would make every card look bare after the next reboot. Keep
  // them and write the new version lazily on the next normal cache update.
  const compatibleVersion = raw?.version === 1 || raw?.version === STORE_VERSION;
  return compatibleVersion && raw?.entries && typeof raw.entries === "object"
    ? { version: STORE_VERSION, entries: raw.entries, incrementalCursor: raw.incrementalCursor }
    : { version: STORE_VERSION, entries: {} };
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
    if (
      entry &&
      entry.selectionVersion === EDITORIAL_SELECTION_VERSION &&
      Number.isFinite(entry.fetchedAt) &&
      now - entry.fetchedAt < ARTWORK_REVALIDATE_MS
    ) {
      found[`${ref.type}:${ref.tmdbId}`] = entry;
    }
  }
  return found;
}

/** All stored title/image bindings, used only when clearing visual bytes. */
export function listCachedTitleArtwork(): CachedTitleArtwork[] {
  return Object.values(loadStore().entries).filter((entry): entry is CachedTitleArtwork =>
    !!entry && typeof entry === "object" && (typeof entry.backdropPath === "string" || typeof entry.logoPath === "string")
  );
}

/**
 * Takes the next stable slice of the entire library, not just metadata
 * misses. This means the daily incremental task also verifies titles already
 * known to Movviz: if their immutable backdrop/logo files were never written
 * or were manually removed, they are restored without re-downloading healthy
 * files. The cursor is persisted so restarts do not make the task rescan the
 * same first titles forever.
 */
export function takeIncrementalArtworkSlice(
  refs: readonly { type: ArtworkTitleType; tmdbId: number }[],
  limit: number
): { type: ArtworkTitleType; tmdbId: number }[] {
  const unique = [...new Map(
    refs
      .filter((ref) => Number.isInteger(ref.tmdbId) && ref.tmdbId > 0)
      .map((ref) => [`${ref.type}:${ref.tmdbId}`, ref] as const)
  ).values()].sort((a, b) => `${a.type}:${a.tmdbId}`.localeCompare(`${b.type}:${b.tmdbId}`));
  if (unique.length === 0 || limit <= 0) return [];

  const store = loadStore();
  const start = Math.min(Math.max(0, store.incrementalCursor ?? 0), unique.length - 1);
  const count = Math.min(Math.floor(limit), unique.length);
  const slice = Array.from({ length: count }, (_, index) => unique[(start + index) % unique.length]);
  store.incrementalCursor = (start + count) % unique.length;
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, store);
  return slice;
}

/** Persists compact TMDb paths; downloaded image files use tmdbImageCache.ts. */
export function cacheTitleArtwork(
  values: readonly {
    type: ArtworkTitleType;
    tmdbId: number;
    backdropPath: string | null;
    logoPath: string | null;
    titleEmbedded: boolean;
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
      titleEmbedded: value.titleEmbedded,
      selectionVersion: EDITORIAL_SELECTION_VERSION,
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
