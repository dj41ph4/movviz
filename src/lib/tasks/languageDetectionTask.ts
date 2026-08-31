import { loadMovies, updateMovies, loadSeries, updateSeriesList } from "@/lib/library/store";
import type { LibraryMovie, LibrarySeries } from "@/lib/library/types";
import { detectFileLanguage } from "@/lib/library/detectLanguage";

export async function backfillMovieLanguages(): Promise<void> {
  const movies = loadMovies();
  const patches = new Map<string, Partial<LibraryMovie>>();
  for (const movie of movies) {
    if (!movie.file || movie.file.language) continue;
    const lang = detectFileLanguage(movie.file, movie.plexMediaInfo);
    if (!lang) continue;
    patches.set(movie.id, { file: { ...movie.file, language: lang } });
  }
  if (patches.size > 0) updateMovies(patches);
}

export async function backfillSeriesLanguages(): Promise<void> {
  const seriesList = loadSeries();
  const patches = new Map<string, Partial<LibrarySeries>>();
  for (const series of seriesList) {
    let changed = false;
    const newSeasons = series.seasons.map((s) => ({
      ...s,
      episodes: s.episodes.map((ep) => {
        if (!ep.file || ep.file.language) return ep;
        // No plexMediaInfo stored on episodes — use filename fallback only.
        const lang = detectFileLanguage(ep.file, null);
        if (!lang) return ep;
        changed = true;
        return { ...ep, file: { ...ep.file, language: lang } };
      }),
    }));
    if (changed) patches.set(series.id, { seasons: newSeasons });
  }
  if (patches.size > 0) updateSeriesList(patches);
}
