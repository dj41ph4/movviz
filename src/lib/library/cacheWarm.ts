import { loadMovies, loadSeries } from "@/lib/library/store";
import { getMovie, getSeries } from "@/lib/metadata/tmdb";

interface WarmState {
  running: boolean;
  done: number;
  total: number;
  startedAt: number | null;
  finishedAt: number | null;
  error: string | null;
}

// Anchored on globalThis — Next.js compiles routes into separate bundles,
// so module-level state alone wouldn't be shared between the POST that
// starts the warm-up and the GET the UI polls for progress.
const g = globalThis as typeof globalThis & { __movvizCacheWarmState?: WarmState };
const state: WarmState = (g.__movvizCacheWarmState ??= {
  running: false,
  done: 0,
  total: 0,
  startedAt: null,
  finishedAt: null,
  error: null,
});

export function getCacheWarmState(): WarmState {
  return state;
}

/**
 * Pre-fetches every library title into the persisted TMDb cache (see
 * src/lib/cache/registry.ts) so ordinary browsing never has to wait on a
 * cold call again. Sequential on purpose — same reasoning as the nightly
 * metadata refresh: a few thousand titles run once, no reason to hammer
 * TMDb's rate limit.
 */
export function startCacheWarm() {
  if (state.running) return;

  const movies = loadMovies();
  const series = loadSeries();
  state.running = true;
  state.done = 0;
  state.total = movies.length + series.length;
  state.startedAt = Date.now();
  state.finishedAt = null;
  state.error = null;

  (async () => {
    try {
      for (const m of movies) {
        await getMovie(m.tmdbId);
        state.done++;
      }
      for (const s of series) {
        await getSeries(s.tmdbId);
        state.done++;
      }
    } catch (err) {
      state.error = err instanceof Error ? err.message : "unknown error";
    } finally {
      state.running = false;
      state.finishedAt = Date.now();
    }
  })();
}
