import { loadMovies, updateMovies, loadSeries, updateSeriesList } from "@/lib/library/store";
import type { LibraryMovie, LibrarySeries } from "@/lib/library/types";
import { detectFileLanguage, deriveLanguageFromTracks } from "@/lib/library/detectLanguage";
import { isFfprobeEnabled } from "@/lib/settings/ffprobe";
import { getOrProbeMediaDescriptor } from "@/lib/playback/engine/mediaProbeCache";

/** Langue lue dans le fichier lui-même (ffprobe, mise en cache) : Plex n'est jamais requis. */
async function languageFromProbe(mediaId: string, path: string | undefined | null): Promise<string | null> {
  if (!path || !isFfprobeEnabled()) return null;
  const media = await getOrProbeMediaDescriptor(mediaId, path).catch(() => null);
  return media ? deriveLanguageFromTracks(media.audioTracks, media.subtitleTracks) : null;
}

export async function backfillMovieLanguages(): Promise<void> {
  const movies = loadMovies();
  const patches = new Map<string, Partial<LibraryMovie>>();
  for (const movie of movies) {
    if (!movie.file || movie.file.language) continue;
    const lang = (await languageFromProbe(movie.id, movie.file.diskPath ?? movie.file.path)) ?? detectFileLanguage(movie.file, movie.plexMediaInfo);
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
    const newSeasons = [];
    for (const s of series.seasons) {
      const episodes = [];
      for (const ep of s.episodes) {
        if (!ep.file || ep.file.language) { episodes.push(ep); continue; }
        // Pas de plexMediaInfo sur les épisodes : pistes du fichier (ffprobe), puis nom de fichier.
        const lang = (await languageFromProbe(`${series.id}:s${s.seasonNumber}e${ep.episodeNumber}`, ep.file.diskPath ?? ep.file.path)) ?? detectFileLanguage(ep.file, null);
        if (!lang) { episodes.push(ep); continue; }
        changed = true;
        episodes.push({ ...ep, file: { ...ep.file, language: lang } });
      }
      newSeasons.push({ ...s, episodes });
    }
    if (changed) patches.set(series.id, { seasons: newSeasons });
  }
  if (patches.size > 0) updateSeriesList(patches);
}
