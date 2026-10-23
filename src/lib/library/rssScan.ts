import { readRssCache } from "@/lib/indexers/rssCache";
import { parseRelease } from "@/lib/naming/parser";
import { releaseTitleMatches, yearIsCompatible, looksLikeSeriesRelease, pickSearchTitle } from "@/lib/library/matching";
import { loadMovies, loadSeries } from "@/lib/library/store";
import { searchAndGrabMovie } from "@/lib/library/autoGrab";
import { searchAndGrabSeason, withSearchLock } from "@/lib/library/autoGrabSeries";
import { runBackground } from "@/lib/priority/lane";
import { yieldToUser } from "@/lib/priority/userActivity";
import { yieldToEventLoop } from "@/lib/jobs/cancelScope";
import { openBlockWindow } from "@/lib/blockProbe";
import type { IndexerRelease } from "@/lib/indexers/types";

/**
 * Passage incrémental (2026-10-12) : comparer chaque release du cache à
 * chaque titre manquant, tout le cache, toutes les 15 min, bloquait le
 * serveur 1 à 2 s à chaque passage pour retrouver les mêmes résultats.
 * Désormais :
 *  - premier passage après le démarrage : complet ;
 *  - ensuite, une release déjà vue n'est comparée qu'aux titres devenus
 *    manquants depuis (un film ajouté est donc bien comparé à tout le cache),
 *    et une release nouvelle est comparée à tous les titres ;
 *  - un passage complet une fois par jour, en filet de sécurité.
 * L'état est en mémoire : un redémarrage refait un passage complet.
 */
const FULL_PASS_EVERY_MS = 24 * 60 * 60 * 1000;
/** Pause toutes les N comparaisons (boucle CPU synchrone sinon). */
const COMPARE_YIELD_EVERY = 300;

interface RssMatchState {
  seenReleases: Set<string>;
  knownTargets: Set<string>;
  lastFullPassAt: number;
}
const gs = globalThis as typeof globalThis & { __movvizRssMatchState?: RssMatchState };

function releaseKey(r: IndexerRelease): string {
  return r.guid || `${r.indexerId}|${r.title}`;
}

/**
 * RSS sync: matches cached RSS feed data against everything Movviz currently
 * considers missing. The cache is populated by `refreshRssCache()` as
 * part of the 15-minute `rss-indexer-scan` task. Matching a release
 * triggers the normal quality-filtered search/grab pipeline.
 */
export async function rssMatchIndexers() {
  // Voie arrière-plan + cession à l'utilisateur : le match RSS est planifié,
  // jamais prioritaire sur une interaction utilisateur.
  return runBackground(() => rssMatchIndexersInner());
}

async function rssMatchIndexersInner() {
  const cached = readRssCache();
  if (cached.length === 0) return { grabbed: 0 };

  const now = Date.now();
  const prev = gs.__movvizRssMatchState;
  const fullPass = !prev || now - prev.lastFullPassAt >= FULL_PASS_EVERY_MS;
  const seenBefore = fullPass ? new Set<string>() : prev.seenReleases;
  const knownBefore = fullPass ? new Set<string>() : prev.knownTargets;

  const keys = cached.map(releaseKey);
  const isNewRelease = keys.map((k) => !seenBefore.has(k));
  const parsedReleases = cached.map((r) => parseRelease(r.title));
  const seriesLike = new Set(parsedReleases.filter((_, i) => looksLikeSeriesRelease(cached[i].title)));

  // Chargement de la bibliothèque films (CPU : JSON.parse, instrumenté dans library-read-movies)
  const movies = loadMovies().filter((m) => m.monitored && m.status === "missing");

  // Chargement de la bibliothèque séries (CPU : JSON.parse sur library-series.json, ~22 Mo)
  const missingSeasons: { seriesId: string; seriesTitle: string; seriesAliases: string[]; season: number }[] = [];
  const loadSeriesWin = openBlockWindow("rss-load-series", { type: "cpu" });
  try {
    for (const series of loadSeries()) {
      if (!series.monitored) continue;
      for (const season of series.seasons) {
        if (season.episodes.some((e) => e.monitored && e.status === "missing")) {
          missingSeasons.push({ seriesId: series.id, seriesTitle: series.title, seriesAliases: series.aliases ?? [], season: season.seasonNumber });
        }
      }
    }
  } finally {
    loadSeriesWin.end();
  }

  let grabbed = 0;
  const grabbedMovies = new Set<string>();
  const grabbedSeasons = new Set<string>();
  const seriesPackSearched = new Set<string>();
  const seriesFullyGrabbed = new Set<string>();

  const movieTargets = movies.map((movie) => ({
    movie,
    isNew: !knownBefore.has(`movie:${movie.id}`),
    searchTitle: pickSearchTitle(movie.title, movie.originalTitle),
    aliases: [...(movie.aliases ?? []), movie.title],
  }));
  const anyNewMovie = movieTargets.some((t) => t.isNew);
  const anyNewSeason = missingSeasons.some((s) => !knownBefore.has(`season:${s.seriesId}.${s.season}`));
  let compared = 0;

  // Boucle de comparaison CPU : releases × films manquants
  const matchMoviesWin = openBlockWindow("rss-match-movies", { type: "cpu" });
  try {
    for (let ri = 0; ri < parsedReleases.length; ri++) {
      const parsed = parsedReleases[ri];
      const releaseIsNew = isNewRelease[ri];
      // Release déjà vue et aucun titre nouvellement manquant : rien à comparer.
      if (!releaseIsNew && !anyNewMovie && !anyNewSeason) continue;
      for (const { movie, isNew, searchTitle, aliases } of movieTargets) {
        if (!releaseIsNew && !isNew) continue;
        if (grabbedMovies.has(movie.id)) continue;
        if (seriesLike.has(parsed)) continue;
        if (++compared % COMPARE_YIELD_EVERY === 0) await yieldToEventLoop();
        if (!releaseTitleMatches(parsed.title, searchTitle, aliases) || !yearIsCompatible(parsed.year, movie.year)) continue;
        grabbedMovies.add(movie.id);
        await yieldToUser("match RSS films");
        // Grab d'un film : I/O (appels indexeur + Plex + TMDb)
        const grabWin = openBlockWindow("rss-grab-movie", { type: "io" });
        try {
          const result = await searchAndGrabMovie(movie.id);
          if ("ok" in result && result.ok) grabbed++;
        } finally {
          grabWin.end();
        }
      }
    }
  } finally {
    matchMoviesWin.end();
  }

  // Boucle de comparaison CPU : releases × saisons manquantes
  const matchSeasonsWin = openBlockWindow("rss-match-seasons", { type: "cpu" });
  try {
    for (let ri = 0; ri < parsedReleases.length; ri++) {
      const parsed = parsedReleases[ri];
      if (parsed.season == null) continue;
      for (const s of missingSeasons) {
        if (seriesFullyGrabbed.has(s.seriesId)) continue;
        const key = `${s.seriesId}.${s.season}`;
        if (grabbedSeasons.has(key)) continue;
        if (++compared % COMPARE_YIELD_EVERY === 0) await yieldToEventLoop();
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
        // Grab d'une saison : I/O (appels indexeur + Plex + TMDb)
        const grabWin = openBlockWindow("rss-grab-season", { type: "io" });
        try {
          const result = await withSearchLock(`series:${s.seriesId}`, () =>
            searchAndGrabSeason(s.seriesId, s.season, { skipSeriesPackRetry: skipSeriesPack })
          );
          if ("ok" in result && result.ok) {
            grabbed++;
            if ("mode" in result && result.mode === "series_pack") seriesFullyGrabbed.add(s.seriesId);
          }
        } finally {
          grabWin.end();
        }
      }
    }
  } finally {
    matchSeasonsWin.end();
  }

  // Passage terminé (un arrêt en cours de route lance une exception avant
  // d'arriver ici, l'état précédent reste donc valable).
  gs.__movvizRssMatchState = {
    seenReleases: new Set(keys),
    knownTargets: new Set([
      ...movies.map((m) => `movie:${m.id}`),
      ...missingSeasons.map((s) => `season:${s.seriesId}.${s.season}`),
    ]),
    lastFullPassAt: fullPass ? now : prev!.lastFullPassAt,
  };

  return { grabbed };
}