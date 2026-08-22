import { loadMovies, loadSeries } from "@/lib/library/store";
import { getTitleImages, pickEditorialArtwork } from "@/lib/metadata/tmdb";
import { prefetchTmdbImage } from "@/lib/metadata/tmdbImageCache";
import {
  cacheTitleArtwork,
  loadCachedTitleArtwork,
  selectTitleArtworkForWarm,
  type ArtworkTitleType,
} from "@/lib/metadata/titleArtworkCache";

export type ArtworkWarmMode = "complete" | "incremental";

export interface ArtworkWarmState {
  running: boolean;
  mode: ArtworkWarmMode | null;
  done: number;
  total: number;
  cached: number;
  failed: number;
  startedAt: number | null;
  finishedAt: number | null;
  error: string | null;
}

const g = globalThis as typeof globalThis & { __movvizArtworkWarmState?: ArtworkWarmState };
const state: ArtworkWarmState = (g.__movvizArtworkWarmState ??= {
  running: false,
  mode: null,
  done: 0,
  total: 0,
  cached: 0,
  failed: 0,
  startedAt: null,
  finishedAt: null,
  error: null,
});

const TMDB_ARTWORK_PACE_MS = 275;

function allLibraryRefs(): { type: ArtworkTitleType; tmdbId: number }[] {
  const refs = new Map<string, { type: ArtworkTitleType; tmdbId: number }>();
  for (const movie of loadMovies()) refs.set(`movie:${movie.tmdbId}`, { type: "movie", tmdbId: movie.tmdbId });
  for (const series of loadSeries()) refs.set(`series:${series.tmdbId}`, { type: "series", tmdbId: series.tmdbId });
  return [...refs.values()];
}

export function getArtworkWarmState(): ArtworkWarmState {
  return { ...state };
}

/**
 * Fills artwork without involving the browser: useful for the explicit
 * Settings action and for the small daily safety pass. Normal display and
 * search do not wait for this — their visible titles populate the same cache
 * immediately through /api/metadata/images/batch.
 */
export async function runArtworkCacheWarm(
  mode: ArtworkWarmMode,
  options: { limit?: number } = {}
): Promise<ArtworkWarmState> {
  if (state.running) return getArtworkWarmState();

  const libraryRefs = allLibraryRefs();
  // A complete pass guarantees bytes for every library title, even if its
  // URL pair was already learned earlier by a visible card or a search.
  // Incremental stays deliberately tiny and touches only missing/stale data.
  let targets = mode === "complete"
    ? libraryRefs
    : selectTitleArtworkForWarm(libraryRefs, mode, "fr");
  if (options.limit != null) targets = targets.slice(0, Math.max(0, options.limit));

  state.running = true;
  state.mode = mode;
  state.done = 0;
  state.total = targets.length;
  state.cached = 0;
  state.failed = 0;
  state.startedAt = Date.now();
  state.finishedAt = null;
  state.error = null;

  try {
    for (const target of targets) {
      try {
        const key = `${target.type}:${target.tmdbId}`;
        let artwork = loadCachedTitleArtwork([target], "fr")[key];
        let requestedTmdb = false;
        if (!artwork) {
          const images = await getTitleImages(target.tmdbId, target.type, "fr");
          artwork = { ...pickEditorialArtwork(images), fetchedAt: Date.now() };
          requestedTmdb = true;
          cacheTitleArtwork([{ ...target, ...artwork }], "fr");
        }
        const [backdropCached, logoCached] = await Promise.all([
          prefetchTmdbImage("w780", artwork.backdropPath),
          prefetchTmdbImage("w500", artwork.logoPath),
        ]);
        if (!backdropCached || !logoCached) throw new Error("tmdb_image_download_failed");
        state.cached++;
        // Respect TMDb's API cadence only when a metadata request was made.
        // Reading locally cached image bytes is safe to continue immediately.
        if (requestedTmdb && state.done + 1 < targets.length) {
          await new Promise((resolve) => setTimeout(resolve, TMDB_ARTWORK_PACE_MS));
        }
      } catch (error) {
        state.failed++;
        console.warn(`[artwork-cache] ${target.type}:${target.tmdbId} failed`, error);
      } finally {
        state.done++;
      }
    }
  } catch (error) {
    state.error = error instanceof Error ? error.message : String(error);
  } finally {
    state.running = false;
    state.finishedAt = Date.now();
  }

  return getArtworkWarmState();
}

export function startArtworkCacheWarm(mode: ArtworkWarmMode): ArtworkWarmState {
  if (!state.running) void runArtworkCacheWarm(mode);
  return getArtworkWarmState();
}
