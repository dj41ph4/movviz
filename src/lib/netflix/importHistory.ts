import { parseNetflixCsv, classifyNetflixTitle } from "./parseHistory";
import { resolveTitleAgainstTmdb, mapWithConcurrency } from "@/lib/metadata/resolveTitle";
import { titleSimilarity } from "@/lib/library/matching";
import { getSeason } from "@/lib/metadata/tmdb";
import { setWatchedMovies, setWatchedEpisodes } from "@/lib/plex/watchStore";
import { pushMovieWatchedToPlex, pushEpisodesWatchedToPlex } from "@/lib/plex/watchWrite";
import type { User } from "@/lib/auth/types";

/**
 * Netflix → Movviz (demande explicite user) — matches a Netflix "viewing
 * activity" export against Movviz's own watched-status system (the exact
 * same one Plex sync already feeds — watchStore.ts) and, when the item is
 * also linked to this user's own Plex account, pushes the change onward
 * (watchWrite.ts). Netflix is purely a SOURCE of history here; Movviz/Plex
 * stays the single reference for the final "watched" status, per the
 * spec's own framing.
 */

const MIN_EPISODE_MATCH_SCORE = 0.5;
const RESOLVE_CONCURRENCY = 4;

export interface NetflixImportResult {
  totalRows: number;
  moviesMatched: number;
  episodesMatched: number;
  unmatched: string[];
}

interface ResolvedMovie {
  tmdbId: number;
  title: string;
  watchedAt: number | null;
}
interface ResolvedEpisode {
  tmdbId: number;
  title: string;
  season: number;
  episode: number;
  watchedAt: number | null;
}

export async function importNetflixHistory(user: User, csv: string): Promise<NetflixImportResult> {
  const rows = parseNetflixCsv(csv);
  const classified = rows.map((r) => ({ ...classifyNetflixTitle(r.title), watchedAt: r.watchedAt, raw: r.title }));

  const movieRows = classified.filter((c) => c.kind === "movie");
  const episodeRows = classified.filter((c) => c.kind === "episode");

  const unmatched: string[] = [];

  // Movies: one TMDb resolution per distinct title (bounded concurrency,
  // same helper add_media already uses).
  const movieTitles = [...new Set(movieRows.map((r) => r.movieTitle!))];
  const movieResolutions = new Map(
    (await mapWithConcurrency(movieTitles, RESOLVE_CONCURRENCY, async (title) => {
      const resolved = await resolveTitleAgainstTmdb({ title, type: "movie" });
      return [title, resolved] as const;
    })).map(([title, resolved]) => [title, resolved])
  );
  const resolvedMovies: ResolvedMovie[] = [];
  for (const row of movieRows) {
    const resolved = movieResolutions.get(row.movieTitle!);
    if (!resolved) {
      unmatched.push(row.raw);
      continue;
    }
    resolvedMovies.push({ tmdbId: resolved.tmdbId, title: resolved.title, watchedAt: row.watchedAt });
  }

  // Series: one TMDb resolution + one season fetch per distinct
  // (series, season) pair — episode titles within that season are matched
  // by fuzzy title similarity (same matcher used for release↔library
  // matching), never trusting a raw episode number from the model or the
  // file itself (there isn't one — Netflix's export never includes one).
  const seriesTitles = [...new Set(episodeRows.map((r) => r.seriesTitle!))];
  const seriesResolutions = new Map(
    (await mapWithConcurrency(seriesTitles, RESOLVE_CONCURRENCY, async (title) => {
      const resolved = await resolveTitleAgainstTmdb({ title, type: "series" });
      return [title, resolved] as const;
    })).map(([title, resolved]) => [title, resolved])
  );

  const seasonKeys = [...new Set(
    episodeRows
      .map((r) => {
        const series = seriesResolutions.get(r.seriesTitle!);
        return series ? `${series.tmdbId}.${r.seasonNumber}` : null;
      })
      .filter((k): k is string => k != null)
  )];
  const seasonCache = new Map(
    (await mapWithConcurrency(seasonKeys, RESOLVE_CONCURRENCY, async (key) => {
      const [tmdbId, season] = key.split(".").map(Number);
      const data = await getSeason(tmdbId, season).catch(() => null);
      return [key, data] as const;
    })).map(([key, data]) => [key, data])
  );

  const resolvedEpisodes: ResolvedEpisode[] = [];
  for (const row of episodeRows) {
    const series = seriesResolutions.get(row.seriesTitle!);
    if (!series) {
      unmatched.push(row.raw);
      continue;
    }
    const season = seasonCache.get(`${series.tmdbId}.${row.seasonNumber}`);
    const candidates = season?.episodes ?? [];
    const scored = candidates
      .map((ep) => ({ ep, score: titleSimilarity(row.episodeTitle!, ep.title) }))
      .sort((a, b) => b.score - a.score);
    if (!scored.length || scored[0].score < MIN_EPISODE_MATCH_SCORE) {
      unmatched.push(row.raw);
      continue;
    }
    resolvedEpisodes.push({
      tmdbId: series.tmdbId,
      title: series.title,
      season: scored[0].ep.seasonNumber,
      episode: scored[0].ep.episodeNumber,
      watchedAt: row.watchedAt,
    });
  }

  // Apply — same local store Plex sync already writes to, then push
  // onward to this user's own Plex account (best-effort, no-op if not
  // linked/synced — see watchWrite.ts).
  for (const m of resolvedMovies) {
    setWatchedMovies(user.id, [m.tmdbId], true, m.title);
    await pushMovieWatchedToPlex(user, m.tmdbId, true).catch(() => {});
  }
  const bySeries = new Map<number, { tmdbId: number; season: number; episode: number; title: string }[]>();
  for (const e of resolvedEpisodes) {
    const list = bySeries.get(e.tmdbId) ?? [];
    list.push(e);
    bySeries.set(e.tmdbId, list);
  }
  for (const [tmdbId, entries] of bySeries) {
    setWatchedEpisodes(user.id, entries, true, entries[0].title);
    await pushEpisodesWatchedToPlex(user, entries, true).catch(() => {});
  }

  return {
    totalRows: rows.length,
    moviesMatched: resolvedMovies.length,
    episodesMatched: resolvedEpisodes.length,
    unmatched: unmatched.slice(0, 100),
  };
}
