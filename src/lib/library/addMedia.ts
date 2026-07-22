import { loadMovies, loadSeries, addMovie, addSeries } from "./store";

export function addMediaSilent(tmdbId: number, type: "movie" | "series"): boolean {
  if (type === "movie") {
    if (loadMovies().some((m) => m.tmdbId === tmdbId)) return false;
    addMovie({
      id: `mv_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      tmdbId, imdbId: null, title: "", year: null, releaseDate: null,
      overview: "", posterPath: null, backdropPath: null, rating: 0,
      runtime: null, genres: [], monitored: true, qualityProfileId: "qp_hd",
      status: "missing", file: null, activeInfoHash: null, addedAt: Date.now(),
      tags: [], plexRatingKey: null, vfReleaseDate: null, originalLanguage: null,
    } as any);
    return true;
  }
  if (loadSeries().some((s) => s.tmdbId === tmdbId)) return false;
  addSeries({
    id: `sr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    tmdbId, imdbId: null, title: "", year: null, releaseDate: null,
    overview: "", posterPath: null, backdropPath: null, rating: 0,
    genres: [], tvStatus: "unknown", monitored: true, qualityProfileId: "qp_hd",
    seasons: [], addedAt: Date.now(), tags: [], plexRatingKey: null,
  } as any);
  return true;
}
