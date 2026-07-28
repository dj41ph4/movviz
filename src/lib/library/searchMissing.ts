import { loadMovies, loadSeries } from "@/lib/library/store";
import { searchAndGrabMovie } from "@/lib/library/autoGrab";
import { searchAndGrabSeries } from "@/lib/library/autoGrabSeries";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";

// One at a time on purpose: 3 concurrent items each potentially falling back
// to a direct indexer search (see grabRelease's fallback) could fire enough
// near-simultaneous requests at the same indexer to trip its 429 rate limit
// — which then blocks every other search (auto-grab, manual) for the whole
// cooldown window, not just this bulk job. Slower, but never self-inflicts
// that outage.
const CONCURRENCY = 1;

// A real pause between items, not just a same-tick yield — back-to-back items
// with nothing but a setImmediate() between them still saturate the CPU in a
// sustained, uninterrupted stretch (each one's title-matching pass runs the
// instant the previous finishes). This mirrors the pace of a person clicking
// "rechercher" one title at a time by hand: search it, grab it if found, only
// then move on to the next — deliberately slower, genuinely lighter on the CPU.
// 800ms was measured live as still too fast: the diagnostic log showed an
// indexer tripping its own 429 after ~35 requests in ~35s (roughly one a
// second — each item fires one direct-search request per indexer, so the
// item rate IS the per-indexer request rate). Raised to stay comfortably
// under whatever that indexer's real threshold is.
const ITEM_DELAY_MS = 1500;

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function runBatch<T>(
  items: T[],
  fn: (item: T) => Promise<unknown>,
  concurrency: number,
  onProgress: () => void
) {
  const queue = [...items];
  let i = 0;
  const next = async (): Promise<void> => {
    while (i < queue.length) {
      const idx = i++;
      await fn(queue[idx]).catch(() => {});
      onProgress();
      // Each search does a synchronous title-match pass over the whole RSS
      // cache (up to ~2000 releases, each Levenshtein-compared) — real CPU
      // time on Node's single thread, not I/O wait. The pause below (rather
      // than just yielding to the next tick) spreads that cost out in real
      // wall-clock time instead of letting the whole batch run as one
      // sustained, uninterrupted burst.
      await delay(ITEM_DELAY_MS);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, next));
}

export type SearchMissingScope = "all" | "movie" | "series";

// Fisher-Yates — searching in a fixed order means anything near the end of
// the library never gets a turn before the run trips a 429 and grinds to a
// halt for the rest of the batch. A random order each run spreads that risk
// across the whole library instead of always sacrificing the same tail end.
function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

type QueueItem = { type: "movie"; id: string } | { type: "series"; id: string };

/**
 * Manual "search everything missing" action — every monitored movie still
 * missing, and every monitored series with at least one monitored+missing
 * episode. Reuses the same pack-first (season pack, or a complete-series
 * pack when the show is barely started) logic as the per-title search
 * buttons, just triggered in bulk for the whole library at once. `scope`
 * restricts the run to just movies or just series — the library page's
 * bulk button now only searches whichever category is currently filtered.
 * The processing order is shuffled (movies among movies, series among
 * series, and the two categories interleaved when scope is "all") so a
 * 429 partway through a run doesn't always strand the same titles.
 */
export async function searchAllMissing(onProgress?: (current: number, total: number) => void, scope: SearchMissingScope = "all") {
  const t0 = performance.now();
  const movies = scope === "series" ? [] : loadMovies().filter((m) => m.monitored && m.status === "missing");
  const series = scope === "movie" ? [] : loadSeries().filter(
    (s) => s.monitored && s.seasons.some((se) => se.monitored && se.episodes.some((e) => e.monitored && e.status === "missing"))
  );

  const total = movies.length + series.length;
  let current = 0;
  onProgress?.(current, total || 1);

  recordSearchLog("info", "search_all_missing.start", `${movies.length} film(s), ${series.length} série(s) à traiter (concurrence=${CONCURRENCY})`);

  const tick = () => {
    current++;
    onProgress?.(current, total || 1);
  };

  const queue: QueueItem[] = shuffle([
    ...shuffle(movies).map((m): QueueItem => ({ type: "movie", id: m.id })),
    ...shuffle(series).map((s): QueueItem => ({ type: "series", id: s.id })),
  ]);

  await runBatch(
    queue,
    (item) => (item.type === "movie" ? searchAndGrabMovie(item.id) : searchAndGrabSeries(item.id)),
    CONCURRENCY,
    tick
  );

  const totalMs = Math.round(performance.now() - t0);
  recordSearchLog("info", "search_all_missing.end", `Terminé en ${totalMs}ms — ${movies.length} film(s), ${series.length} série(s)`, totalMs);
  return { movies: movies.length, series: series.length };
}
