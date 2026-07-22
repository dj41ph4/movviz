import { loadMovies, loadSeries, updateMovie, updateSeries } from "@/lib/library/store";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";

/**
 * A movie/episode is flipped to "searching" right before a real search
 * starts and flipped back right after it ends — but the job driving that
 * search lives only in memory (src/lib/jobs/queue.ts), wiped on every
 * restart. If the server restarts (crash, redeploy) while a search is
 * mid-flight, whatever was flipped to "searching" moments before never gets
 * flipped back: nothing resumes or retries it, so it stays stuck forever
 * with no download, no job, no visible error. Confirmed live: a redeploy
 * landing mid-bulk-search left two episodes of a series stuck on
 * "Recherche…" indefinitely, with the job queue and activity feed both
 * showing nothing in progress. Reset every such status back to "missing" on
 * boot so the next search (scheduled or manual) picks it up normally.
 */
export function reconcileStaleSearches() {
  let moviesReset = 0;
  for (const movie of loadMovies()) {
    if (movie.status === "searching") {
      updateMovie(movie.id, { status: "missing" });
      moviesReset++;
    }
  }

  let episodesReset = 0;
  for (const series of loadSeries()) {
    let seriesChanged = false;
    const seasons = series.seasons.map((season) => {
      let seasonChanged = false;
      const episodes = season.episodes.map((ep) => {
        if (ep.status !== "searching") return ep;
        seasonChanged = true;
        episodesReset++;
        return { ...ep, status: "missing" as const };
      });
      if (seasonChanged) seriesChanged = true;
      return seasonChanged ? { ...season, episodes } : season;
    });
    if (seriesChanged) updateSeries(series.id, { seasons });
  }

  if (moviesReset > 0 || episodesReset > 0) {
    recordSearchLog(
      "info",
      "boot.reconcile_stale_searches",
      `${moviesReset} film(s) et ${episodesReset} épisode(s) remis à "manquant" (statut "recherche" resté bloqué après un redémarrage)`
    );
  }
}
