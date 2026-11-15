import { getSeriesByTmdbId } from "@/lib/library/store";
import { getSeason } from "@/lib/metadata/tmdb";
import { BLEACH_TMDB_ID } from "@/lib/metadata/bleachEpisodeOrder";
import type { LibrarySeries } from "@/lib/library/types";
import type { MetaEpisode, MetaSeason, MetaSeasonSummary } from "@/lib/metadata/types";

/**
 * A series the resync keeps in TVDB numbering is shown — on the web, Android
 * TV, Android mobile and Tizen alike, since they all read the same two
 * routes — with the LIBRARY's seasons and episodes, Movviz being the source
 * of truth. Asking TMDb for « season 2 » of such a show returned another
 * season's episodes (or none): wrong counts, wrong stills, wrong synopses.
 * Bleach keeps its own dedicated projection.
 */
export function tvdbOrderedSeries(tmdbId: number): LibrarySeries | null {
  if (tmdbId === BLEACH_TMDB_ID) return null;
  const series = getSeriesByTmdbId(tmdbId);
  return series?.episodeOrder === "tvdb" ? series : null;
}

/** Season list as the library holds it (names are TVDB's arc names). */
export function projectSeasonSummaries(series: LibrarySeries): MetaSeasonSummary[] {
  return [...series.seasons]
    .sort((a, b) => a.seasonNumber - b.seasonNumber)
    .map((s) => {
      const first = [...s.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber).find((e) => e.airDate);
      return { seasonNumber: s.seasonNumber, name: s.name, episodeCount: s.episodes.length, airDate: first?.airDate ?? null };
    });
}

/**
 * One library season as a MetaSeason: titles, numbers and dates from the
 * library; still, synopsis, runtime and rating from the TMDb episode the
 * resync proved to be the same broadcast (tmdbCoordinate). The poster is
 * the one of the TMDb season most of these episodes come from.
 */
export async function projectSeason(series: LibrarySeries, seasonNumber: number, locale?: string): Promise<MetaSeason | null> {
  const season = series.seasons.find((s) => s.seasonNumber === seasonNumber);
  if (!season) return null;
  const episodes = [...season.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber);
  const sourceSeasons = new Map<number, number>();
  for (const e of episodes) if (e.tmdbCoordinate) sourceSeasons.set(e.tmdbCoordinate.seasonNumber, (sourceSeasons.get(e.tmdbCoordinate.seasonNumber) ?? 0) + 1);
  const tmdbSeasons = new Map<number, MetaSeason>();
  await Promise.all([...sourceSeasons.keys()].map(async (n) => {
    const detail = await getSeason(series.tmdbId, n, locale).catch(() => null);
    if (detail) tmdbSeasons.set(n, detail);
  }));
  const tmdbEpisode = (c: { seasonNumber: number; episodeNumber: number } | null | undefined): MetaEpisode | undefined =>
    c ? tmdbSeasons.get(c.seasonNumber)?.episodes.find((e) => e.episodeNumber === c.episodeNumber) : undefined;
  const mainSource = [...sourceSeasons.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return {
    seasonNumber,
    name: season.name,
    episodeCount: episodes.length,
    airDate: episodes.find((e) => e.airDate)?.airDate ?? null,
    posterPath: mainSource != null ? tmdbSeasons.get(mainSource)?.posterPath ?? null : null,
    episodes: episodes.map((e) => {
      const t = tmdbEpisode(e.tmdbCoordinate);
      return {
        seasonNumber,
        episodeNumber: e.episodeNumber,
        title: e.title || t?.title || "",
        airDate: e.airDate ?? t?.airDate ?? null,
        overview: t?.overview ?? "",
        stillPath: t?.stillPath ?? null,
        runtime: t?.runtime ?? null,
        rating: t?.rating ?? 0,
      };
    }),
  };
}

/**
 * Library coordinate of a TMDb episode. Identity for every series kept in
 * TMDb numbering; for a TVDB-numbered one, the episode whose proven TMDb
 * counterpart it is — null when there is none (never a guess by number).
 * For importers that only know TMDb numbers (Netflix, LifeHub, assistant).
 */
export function libraryCoordinateFromTmdb(tmdbId: number, seasonNumber: number, episodeNumber: number): { season: number; episode: number } | null {
  const series = tvdbOrderedSeries(tmdbId);
  if (!series) return { season: seasonNumber, episode: episodeNumber };
  for (const s of series.seasons) {
    for (const e of s.episodes) {
      if (e.tmdbCoordinate?.seasonNumber === seasonNumber && e.tmdbCoordinate.episodeNumber === episodeNumber) return { season: s.seasonNumber, episode: e.episodeNumber };
    }
  }
  return null;
}

/** TMDb coordinate of a library episode (identity unless the series is TVDB-numbered). */
export function tmdbCoordinateOfLibraryEpisode(tmdbId: number, seasonNumber: number, episodeNumber: number): { seasonNumber: number; episodeNumber: number } | null {
  const series = tvdbOrderedSeries(tmdbId);
  if (!series) return { seasonNumber, episodeNumber };
  return series.seasons.find((s) => s.seasonNumber === seasonNumber)?.episodes.find((e) => e.episodeNumber === episodeNumber)?.tmdbCoordinate ?? null;
}
