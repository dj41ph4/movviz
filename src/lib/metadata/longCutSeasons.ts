import type { MetaEpisode, MetaSeason } from "./types";

/**
 * Seasons shown in their long cut. TMDb lists Kaamelott's Livre V as the 50
 * episodes of 7 minutes aired on M6, but the DVD and Blu-ray releases, and
 * Alexandre Astier's preferred version, are 8 long episodes numbered 1 to 8.
 * Each long episode is made of these scenes, in this order, so its synopsis is
 * built from theirs and follows the profile language TMDb answers in.
 */
const LONG_CUTS: { tmdbId: number; seasonNumber: number; runtime: number; episodes: { title: string; first: number; last: number }[] }[] = [
  {
    tmdbId: 11466,
    seasonNumber: 5,
    runtime: 50,
    episodes: [
      { title: "Corvus Corone", first: 1, last: 6 },
      { title: "La Roche et le Fer", first: 7, last: 12 },
      { title: "Væ Soli !", first: 13, last: 18 },
      { title: "Le Dernier Jour", first: 19, last: 25 },
      { title: "Le Royaume sans tête", first: 26, last: 32 },
      { title: "Jizô", first: 33, last: 38 },
      { title: "Le Phare", first: 39, last: 43 },
      { title: "Le Garçon qui criait au loup", first: 44, last: 50 },
    ],
  },
];

function longCut(tmdbId: number, seasonNumber: number) {
  return LONG_CUTS.find((cut) => cut.tmdbId === tmdbId && cut.seasonNumber === seasonNumber) ?? null;
}

export function longCutEpisodeCount(tmdbId: number, seasonNumber: number): number | null {
  return longCut(tmdbId, seasonNumber)?.episodes.length ?? null;
}

export function toLongCutSeason(tmdbId: number, season: MetaSeason): MetaSeason {
  const cut = longCut(tmdbId, season.seasonNumber);
  if (!cut) return season;
  const episodes = cut.episodes.map(({ title, first, last }, index): MetaEpisode => {
    const scenes = season.episodes.filter((episode) => episode.episodeNumber >= first && episode.episodeNumber <= last);
    const rated = scenes.filter((scene) => scene.rating > 0);
    return {
      seasonNumber: season.seasonNumber,
      episodeNumber: index + 1,
      title,
      airDate: scenes[0]?.airDate ?? null,
      overview: scenes.map((scene) => scene.overview.trim()).filter(Boolean).join(" "),
      stillPath: scenes[0]?.stillPath ?? null,
      runtime: cut.runtime,
      rating: rated.length ? rated.reduce((sum, scene) => sum + scene.rating, 0) / rated.length : 0,
    };
  });
  return { ...season, episodeCount: episodes.length, episodes };
}

/** A library season still holding the broadcast numbering becomes the long cut,
 * unless broadcast episodes really are on disk: those must never be dropped. */
export function shrinkToLongCut<T extends { episodeNumber: number; title: string; file: unknown; plexRatingKey: string | null; activeInfoHash: string | null }>(
  tmdbId: number,
  seasonNumber: number,
  episodes: T[],
): T[] {
  const cut = longCut(tmdbId, seasonNumber);
  if (!cut || episodes.length <= cut.episodes.length) return episodes;
  const extra = episodes.filter((episode) => episode.episodeNumber > cut.episodes.length);
  if (extra.some((episode) => episode.file || episode.plexRatingKey || episode.activeInfoHash)) return episodes;
  return episodes
    .filter((episode) => episode.episodeNumber <= cut.episodes.length)
    .map((episode) => ({ ...episode, title: cut.episodes[episode.episodeNumber - 1].title }));
}
