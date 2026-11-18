import { getSeriesByTmdbId } from "@/lib/library/store";
import { getSeason } from "@/lib/metadata/tmdb";
import { BLEACH_TMDB_ID } from "@/lib/metadata/bleachEpisodeOrder";
import type { LibrarySeries } from "@/lib/library/types";
import type { MetaEpisode, MetaSeason, MetaSeasonSummary } from "@/lib/metadata/types";
import { readableName } from "@/lib/metadata/tvdb";

/** Season title shown to every client: never one in Japanese/Chinese script
 *  (an earlier TVDB resync stored TVDB's untranslated arc names). */
function seasonTitle(season: { seasonNumber: number; name: string }): string {
  const name = readableName(season.name);
  // Season 0 has one name everywhere: a stored « Saison 0 » / « Specials » is the same thing.
  if (season.seasonNumber === 0 && (!name || /^(saison|season|staffel|stagione|seizoen)\s*0+$|^specials?$/i.test(name))) return "Épisodes spéciaux";
  return name ?? `Saison ${season.seasonNumber}`;
}

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
export function projectSeasonSummaries(series: LibrarySeries, tmdbSeasons: MetaSeasonSummary[] = []): MetaSeasonSummary[] {
  const posters = new Map(tmdbSeasons.map(season => [season.seasonNumber, season.posterPath]));
  return [...series.seasons]
    .sort((a, b) => a.seasonNumber - b.seasonNumber)
    .map((s) => {
      const first = [...s.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber).find((e) => e.airDate);
      const source = mainSourceSeason(s.episodes);
      return { seasonNumber: s.seasonNumber, name: seasonTitle(s), episodeCount: s.episodes.length, airDate: first?.airDate ?? null, posterPath: source != null ? posters.get(source) ?? null : null };
    });
}

function sourceSeasonCounts(episodes: LibrarySeries["seasons"][number]["episodes"]) {
  const counts = new Map<number, number>();
  for (const { tmdbCoordinate } of episodes) {
    if (!tmdbCoordinate) continue;
    const n = tmdbCoordinate.seasonNumber;
    counts.set(n, (counts.get(n) ?? 0) + 1);
  }
  return counts;
}

function mainSourceSeason(episodes: LibrarySeries["seasons"][number]["episodes"]) {
  return [...sourceSeasonCounts(episodes)].sort((a, b) => b[1] - a[1])[0]?.[0];
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
  const sourceSeasons = sourceSeasonCounts(episodes);
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
    name: seasonTitle(season),
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
