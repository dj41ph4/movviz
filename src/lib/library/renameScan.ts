import { pathFor } from "./renamePath";
import { loadMovies, loadSeries } from "./store";
import { getTitleInLanguage } from "@/lib/metadata/tmdb";
import { loadNamingTemplates } from "@/lib/naming/store";
import { renderSegment } from "@/lib/naming/render";
import { parseRelease } from "@/lib/naming/parser";
import type { NamingContext } from "@/lib/naming/types";
import type { LibraryFile } from "./types";

export type SetProgress = (current: number, total: number) => void;
export type LogFn = (msg: string) => void;

export interface RenameCandidate {
  id: string;
  type: "movie" | "series";
  title: string;
  year: number | null;
  translatedTitle: string | null;
  currentFolder: string;
  expectedFolder: string;
  currentPath: string;
  expectedPath: string;
  affectedItems: number;
}

function buildMovieCtx(
  file: LibraryFile | null | undefined,
  year: number | null | undefined,
  translatedTitle: string
): NamingContext {
  return {
    title: translatedTitle,
    year: year ? String(year) : null,
    season: null,
    episode: null,
    episodeTitle: null,
    quality: file?.quality ?? "",
    resolution: file?.resolution ?? null,
    source: null,
    videoCodec: null,
    audioCodec: null,
    hdr: null,
    group: null,
  };
}

export async function scanRenames(
  language: string,
  setProgress?: SetProgress,
  log?: LogFn
): Promise<RenameCandidate[]> {
  const templates = loadNamingTemplates();
  const useDots = templates.useDotsInsteadOfSpaces;
  const candidates: RenameCandidate[] = [];

  const movies = loadMovies().filter((m) => m.file?.path);
  const seriesList = loadSeries().filter((s) =>
    s.seasons.some((se) => se.episodes.some((e) => e.file?.path))
  );
  const total = movies.length + seriesList.length;
  const logLn = log ?? (() => {});

  let idx = 0;

  for (const movie of movies) {
    idx++;
    try {
      const translated = await getTitleInLanguage(movie.tmdbId, "movie", language);
      if (!translated) {
        logLn(`[MOVIE] ${movie.title} — TMDb returned no title, skipping`);
        setProgress?.(idx, total);
        continue;
      }

      const p = pathFor(movie.file!.path);
      const ctx = buildMovieCtx(movie.file, movie.year, translated);
      const expectedFolder = renderSegment(templates.movieFolder, ctx, useDots);
      const expectedFile = renderSegment(templates.movieFile, ctx, useDots);
      const ext = p.extname(movie.file!.path);
      const currentDir = p.dirname(movie.file!.path);
      const currentFolder = p.basename(currentDir);
      const base = p.dirname(currentDir);
      const expectedFull = p.join(base, expectedFolder, expectedFile + ext);
      if (expectedFull === movie.file!.path) {
        logLn(`[MOVIE] ${movie.title} — already matches template`);
        setProgress?.(idx, total);
        continue;
      }

      candidates.push({
        id: movie.id,
        type: "movie",
        title: movie.title,
        year: movie.year,
        translatedTitle: translated === movie.title ? null : translated,
        currentFolder,
        expectedFolder,
        currentPath: movie.file!.path,
        expectedPath: expectedFull,
        affectedItems: 1,
      });
      logLn(`[MOVIE] ${movie.title} → ${expectedFolder} (renomme)`);
    } catch (err: any) {
      logLn(`[MOVIE] ${movie.title} — ERREUR: ${err.message ?? err}`);
    }
    setProgress?.(idx, total);
  }

  for (const series of seriesList) {
    idx++;
    try {
      const translated = await getTitleInLanguage(series.tmdbId, "series", language);
      if (!translated) {
        logLn(`[SERIES] ${series.title} — TMDb returned no title, skipping`);
        setProgress?.(idx, total);
        continue;
      }

      const firstEp = series.seasons.flatMap((s) => s.episodes).find((e) => e.file?.path);
      if (!firstEp?.file?.path) {
        logLn(`[SERIES] ${series.title} — no episode files, skipping`);
        setProgress?.(idx, total);
        continue;
      }

      const p = pathFor(firstEp.file.path);
      const currentSeriesDir = p.dirname(p.dirname(firstEp.file.path));
      const currentFolder = p.basename(currentSeriesDir);
      const baseDir = p.dirname(currentSeriesDir);

      const seriesCtx: NamingContext = {
        title: translated,
        year: series.year ? String(series.year) : null,
        season: null, episode: null, episodeTitle: null,
        quality: "", resolution: null, source: null, videoCodec: null,
        audioCodec: null, hdr: null, group: null,
      };
      const expectedFolder = renderSegment(templates.seriesFolder, seriesCtx, useDots);

      let changedCount = 0;

      for (const season of series.seasons) {
        for (const ep of season.episodes) {
          if (!ep.file?.path) continue;
          const parsed = parseRelease(p.basename(ep.file.path));
          const seasonCtx: NamingContext = {
            title: translated,
            year: series.year ? String(series.year) : null,
            season: ep.seasonNumber,
            episode: ep.episodeNumber,
            episodeTitle: ep.title || null,
            quality: ep.file.quality ?? "",
            resolution: parsed.resolution ?? ep.file.resolution,
            source: parsed.source,
            videoCodec: parsed.videoCodec,
            audioCodec: parsed.audioCodec,
            hdr: parsed.hdr,
            group: parsed.group,
          };
          const seasonFolder = renderSegment(templates.seasonFolder, seasonCtx, useDots);
          const epFile = renderSegment(templates.episodeFile, seasonCtx, useDots);
          const ext = p.extname(ep.file.path);
          const expectedEpPath = p.join(baseDir, expectedFolder, seasonFolder, epFile + ext);
          if (expectedEpPath !== ep.file.path) {
            changedCount++;
          }
        }
      }

      if (changedCount === 0) {
        logLn(`[SERIES] ${series.title} — already matches template`);
        setProgress?.(idx, total);
        continue;
      }

      candidates.push({
        id: series.id,
        type: "series",
        title: series.title,
        year: series.year,
        translatedTitle: translated === series.title ? null : translated,
        currentFolder,
        expectedFolder,
        currentPath: currentSeriesDir,
        expectedPath: p.join(baseDir, expectedFolder),
        affectedItems: changedCount,
      });
      logLn(`[SERIES] ${series.title} → ${expectedFolder} (${changedCount} fichier${changedCount > 1 ? "s" : ""})`);
    } catch (err: any) {
      logLn(`[SERIES] ${series.title} — ERREUR: ${err.message ?? err}`);
    }
    setProgress?.(idx, total);
  }

  return candidates;
}
