import { loadMovies, loadSeries } from "@/lib/library/store";
import { searchAndGrabMovie } from "@/lib/library/autoGrab";
import { searchAndGrabSeries } from "@/lib/library/autoGrabSeries";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import { JobCancelledError } from "@/lib/jobs/queue";
import { runBackground } from "@/lib/priority/lane";
import { yieldToUser } from "@/lib/priority/userActivity";

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
  onProgress: () => void,
  shouldCancel?: () => boolean
) {
  const queue = [...items];
  let i = 0;
  const next = async (): Promise<void> => {
    while (i < queue.length) {
      // Cooperative cancellation — the bulk job can run for hours, so the
      // runner polls between items (see requestCancelJob / isJobCancelled in
      // queue.ts). Remaining items simply stay "missing" and are retried on
      // a later run.
      if (shouldCancel?.()) return;
      // Yield to the user: if they're navigating/clicking, the batch waits
      // for their inactivity (a few seconds, capped at 30s) before the next
      // item — the bulk slows down, the UI never does.
      await yieldToUser("bulk manquants");
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
export async function searchAllMissing(
  onProgress?: (current: number, total: number) => void,
  scope: SearchMissingScope = "all",
  options?: { shouldCancel?: () => boolean }
) {
  const t0 = performance.now();
  const movies = scope === "series" ? [] : loadMovies().filter((m) => m.monitored && m.status === "missing");
  const series = scope === "movie" ? [] : loadSeries().filter(
    (s) => s.monitored && s.seasons.some((se) => se.monitored && se.episodes.some((e) => e.monitored && e.status === "missing"))
  );

  // Progress unit = one movie, or one MISSING SEASON of a series. The old
  // per-series unit froze the counter at 0/N for the whole duration of the
  // first (often giant, 20-30 season) show in the batch — confirmed live:
  // "0/413" that read as a stuck job. Per-season ticks move the counter
  // roughly every item's worth of work instead.
  const seriesSeasonCounts = new Map(
    series.map((s) => [
      s.id,
      s.seasons.filter((se) => se.monitored && se.episodes.some((e) => e.monitored && e.status === "missing")).length,
    ])
  );
  const total = movies.length + [...seriesSeasonCounts.values()].reduce((a, b) => a + b, 0);
  let current = 0;
  onProgress?.(current, total || 1);

  recordSearchLog("info", "search_all_missing.start", `${movies.length} film(s), ${series.length} série(s) (${total} unités) à traiter (concurrence=${CONCURRENCY})`);

  const tick = (n = 1) => {
    current += n;
    onProgress?.(current, total || 1);
  };

  const queue: QueueItem[] = shuffle([
    ...shuffle(movies).map((m): QueueItem => ({ type: "movie", id: m.id })),
    ...shuffle(series).map((s): QueueItem => ({ type: "series", id: s.id })),
  ]);

  // Background lane: every indexer request made inside (searchAndGrabMovie /
  // searchAndGrabSeries → searchMovie/searchTv/searchIndexer) inherits the
  // "background" lane via AsyncLocalStorage, so the rate limiter applies the
  // reduced background quota (user reserve always kept free). Combined with
  // yieldToUser() per item above, this bulk — launched from the library
  // button — never starves the user's own searches and clicks.
  await runBackground(() =>
    runBatch(
      queue,
      async (item) => {
        if (item.type === "movie") {
          try {
            await searchAndGrabMovie(item.id);
          } finally {
            // Same contract as the series branch below: the tick must fire
            // even if the search itself throws (runBatch swallows it) so
            // current reaches total.
            tick();
          }
          return;
        }
        let done = 0;
        try {
          await searchAndGrabSeries(item.id, { onSeasonDone: () => { done++; tick(); }, shouldCancel: options?.shouldCancel });
        } finally {
          // Top up whatever the series itself didn't tick — an intégrale found
          // (or nothing left by the time the per-series lock released us, or an
          // error swallowed by runBatch) covers the whole series at once, so
          // its remaining expected seasons count here so current never stalls
          // behind total.
          const expected = seriesSeasonCounts.get(item.id) ?? 0;
          while (done < expected) { done++; tick(); }
        }
      },
      CONCURRENCY,
      () => {},
      options?.shouldCancel
    )
  );

  if (options?.shouldCancel?.()) {
    recordSearchLog("info", "search_all_missing.cancelled", "Recherche annulée par l'utilisateur");
    throw new JobCancelledError();
  }

  const totalMs = Math.round(performance.now() - t0);
  recordSearchLog("info", "search_all_missing.end", `Terminé en ${totalMs}ms — ${movies.length} film(s), ${series.length} série(s)`, totalMs);
  return { movies: movies.length, series: series.length };
}
