import { parentPort } from "node:worker_threads";

/**
 * Plain-JS duplicate of computeHashIndex() in ../library/hashIndexCompute.ts.
 * A worker script referenced via `new Worker(new URL("./hashIndexWorker.mjs",
 * import.meta.url))` runs outside Next.js's bundler and path-alias
 * resolution — it can't `import "@/lib/library/hashIndexCompute"` — so the
 * pure reduction is copied here instead. Keep both in sync if this logic
 * ever changes; the TS version stays the source of truth (and the one the
 * main-thread fallback in route.ts actually calls).
 */
function computeHashIndex(movies, series) {
  const byHash = new Map();
  const moviesById = new Map();
  const seriesById = new Map();

  for (const movie of movies) {
    moviesById.set(movie.id, movie);
    if (movie.activeInfoHash) byHash.set(movie.activeInfoHash, { movie });
  }

  for (const s of series) {
    seriesById.set(s.id, s);
    const matchesByHash = new Map();
    let totalMonitored = 0;
    for (const season of s.seasons) {
      for (const ep of season.episodes) {
        if (ep.monitored) totalMonitored++;
        if (ep.activeInfoHash) {
          const list = matchesByHash.get(ep.activeInfoHash) ?? [];
          list.push({ season: season.seasonNumber, episode: ep.episodeNumber });
          matchesByHash.set(ep.activeInfoHash, list);
        }
      }
    }
    for (const [hash, matches] of matchesByHash) {
      if (byHash.has(hash)) continue;
      const isComplete = totalMonitored > 0 && matches.length >= totalMonitored;
      byHash.set(hash, {
        seriesMatch: {
          series: s,
          season: isComplete ? 0 : matches[0].season,
          episode: isComplete ? 0 : matches[0].episode,
          count: matches.length,
        },
      });
    }
  }

  return { byHash, moviesById, seriesById };
}

parentPort.on("message", ({ movies, series }) => {
  try {
    const value = computeHashIndex(movies, series);
    parentPort.postMessage({ ok: true, value });
  } catch (err) {
    parentPort.postMessage({ ok: false, error: err && err.message ? err.message : String(err) });
  }
});
