import { readRssCache } from "@/lib/indexers/rssCache";
import { parseRelease } from "@/lib/naming/parser";
import { releaseTitleMatches, yearIsCompatible } from "@/lib/library/matching";
import { loadMovies, loadSeries } from "@/lib/library/store";
import { searchAndGrabMovie } from "@/lib/library/autoGrab";
import { searchAndGrabSeason, withSearchLock } from "@/lib/library/autoGrabSeries";

/**
 * RSS sync: matches cached RSS feed data against everything Movviz currently
 * considers missing. The cache is populated by `refreshRssCache()` — a
 * separate scheduled task (`rss-cache-refresh`) that runs every hour. Zero
 * direct indexer calls here, so 429 rate-limits during the matching phase
 * are impossible.
 */
export async function rssMatchIndexers() {
  const releases = readRssCache();
  if (releases.length === 0) return { grabbed: 0 };

  const parsedReleases = releases.map((r) => parseRelease(r.title));

  const missingMovies = loadMovies().filter((m) => m.monitored && m.status === "missing");
  const missingSeasons: { seriesId: string; seriesTitle: string; season: number }[] = [];
  for (const series of loadSeries()) {
    if (!series.monitored) continue;
    for (const season of series.seasons) {
      if (season.episodes.some((e) => e.monitored && e.status === "missing")) {
        missingSeasons.push({ seriesId: series.id, seriesTitle: series.title, season: season.seasonNumber });
      }
    }
  }

  let grabbed = 0;
  const grabbedMovies = new Set<string>();
  const grabbedSeasons = new Set<string>();
  // The series pack (intégrale) is searched once per series per pass — if
  // several seasons of the same show match RSS releases in the same pass,
  // re-searching it for each season is pure indexer load (same cache, same
  // result). Later seasons skip the series-pack stage and go straight to
  // season pack → per-episode.
  const seriesPackSearched = new Set<string>();

  for (const parsed of parsedReleases) {
    for (const movie of missingMovies) {
      if (grabbedMovies.has(movie.id)) continue;
      if (!releaseTitleMatches(parsed.title, movie.title) || !yearIsCompatible(parsed.year, movie.year)) continue;
      grabbedMovies.add(movie.id);
      const result = await searchAndGrabMovie(movie.id);
      if ("ok" in result && result.ok) grabbed++;
    }

    if (parsed.season == null) continue;
    for (const s of missingSeasons) {
      const key = `${s.seriesId}.${s.season}`;
      if (grabbedSeasons.has(key)) continue;
      if (parsed.season !== s.season || !releaseTitleMatches(parsed.title, s.seriesTitle)) continue;
      grabbedSeasons.add(key);
      // RSS just signals a release exists for this season — do a proper
      // pack-first search (falls back to per-episode) rather than grabbing
      // this one RSS item directly, so quality-profile scoring still applies.
      const skipSeriesPack = seriesPackSearched.has(s.seriesId);
      seriesPackSearched.add(s.seriesId);
      // Locked per series like every other search entry point: a bulk job or
      // scheduled retry may be mid-search on this exact series right now —
      // without the lock this RSS hit would run a redundant season search
      // chain against it.
      const result = await withSearchLock(`series:${s.seriesId}`, () =>
        searchAndGrabSeason(s.seriesId, s.season, { skipSeriesPackRetry: skipSeriesPack })
      );
      if ("ok" in result && result.ok) grabbed++;
    }
  }

  return { grabbed };
}
