import { readRssCache } from "@/lib/indexers/rssCache";
import { parseRelease } from "@/lib/naming/parser";
import { releaseTitleMatches, yearIsCompatible } from "@/lib/library/matching";
import { loadMovies, loadSeries } from "@/lib/library/store";
import { searchAndGrabMovie } from "@/lib/library/autoGrab";
import { searchAndGrabSeason, withSearchLock } from "@/lib/library/autoGrabSeries";
import { runBackground } from "@/lib/priority/lane";
import { yieldToUser } from "@/lib/priority/userActivity";

/**
 * RSS sync: matches cached RSS feed data against everything Movviz currently
 * considers missing. The cache is populated by `refreshRssCache()` — a
 * separate scheduled task (`rss-cache-refresh`) that runs every hour. Zero
 * direct indexer calls here, so 429 rate-limits during the matching phase
 * are impossible.
 */
export async function rssMatchIndexers() {
  // Voie arrière-plan + cession à l'utilisateur : le match RSS est planifié,
  // jamais prioritaire sur une interaction utilisateur.
  return runBackground(() => rssMatchIndexersInner());
}

async function rssMatchIndexersInner() {
  const releases = readRssCache();
  if (releases.length === 0) return { grabbed: 0 };

  const parsedReleases = releases.map((r) => parseRelease(r.title));

  const missingMovies = loadMovies().filter((m) => m.monitored && m.status === "missing");
  const missingSeasons: { seriesId: string; seriesTitle: string; seriesAliases: string[]; season: number }[] = [];
  for (const series of loadSeries()) {
    if (!series.monitored) continue;
    for (const season of series.seasons) {
      if (season.episodes.some((e) => e.monitored && e.status === "missing")) {
        missingSeasons.push({ seriesId: series.id, seriesTitle: series.title, seriesAliases: series.aliases ?? [], season: season.seasonNumber });
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
  // Once an intégrale actually lands for a series, it covers every season at
  // once — any OTHER missingSeasons entry for that same series (this array
  // is a snapshot from before any grab in this pass) must be skipped
  // entirely, not just re-searched with skipSeriesPackRetry. Without this, a
  // later RSS release matching e.g. season 2 of a show whose intégrale was
  // just grabbed for season 1's match still ran a full season-pack →
  // per-episode cascade against it — confirmed live: one intégrale, one
  // redundant season pack, AND every individual episode of another season
  // all grabbed for the same show in one scan.
  const seriesFullyGrabbed = new Set<string>();

  for (const parsed of parsedReleases) {
    for (const movie of missingMovies) {
      if (grabbedMovies.has(movie.id)) continue;
      if (!releaseTitleMatches(parsed.title, movie.title, movie.aliases ?? []) || !yearIsCompatible(parsed.year, movie.year)) continue;
      grabbedMovies.add(movie.id);
      await yieldToUser("match RSS films");
      const result = await searchAndGrabMovie(movie.id);
      if ("ok" in result && result.ok) grabbed++;
    }

    if (parsed.season == null) continue;
    for (const s of missingSeasons) {
      if (seriesFullyGrabbed.has(s.seriesId)) continue;
      const key = `${s.seriesId}.${s.season}`;
      if (grabbedSeasons.has(key)) continue;
      if (parsed.season !== s.season || !releaseTitleMatches(parsed.title, s.seriesTitle, s.seriesAliases)) continue;
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
      await yieldToUser("match RSS saisons");
      const result = await withSearchLock(`series:${s.seriesId}`, () =>
        searchAndGrabSeason(s.seriesId, s.season, { skipSeriesPackRetry: skipSeriesPack })
      );
      if ("ok" in result && result.ok) {
        grabbed++;
        if ("mode" in result && result.mode === "series_pack") seriesFullyGrabbed.add(s.seriesId);
      }
    }
  }

  return { grabbed };
}
