import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import {
  getMovie,
  getSeries,
  loadMovies,
  loadSeries,
  removeMovie,
  updateMovie,
  updateSeries,
  clearEpisodeFile,
} from "@/lib/library/store";
import { withKeyLock } from "@/lib/library/locks";
import { addToTrash, addTrashEntry, getTrashConfig } from "@/lib/library/trashStore";
import { moveToTrash } from "@/lib/library/trashMove";
import { trashMovieFile } from "@/lib/library/trashDelete";
import { logActivity } from "@/lib/activity/store";
import { inspectFile, loadCorruptReport, saveCorruptReport, type CorruptItem } from "@/lib/library/corruptFiles";

export type CorruptAction = "delete" | "replace";

export interface CorruptTarget {
  kind: "movie" | "episode";
  id: string;
  seasonNumber?: number;
  episodeNumber?: number;
}

export interface ResolveResult {
  done: CorruptTarget[];
  failed: { target: CorruptTarget; error: string }[];
  /** Films à rechercher une fois les fichiers retirés (action « replace »). */
  movieIds: string[];
  /** Séries à rechercher une fois les fichiers retirés (action « replace »). */
  seriesIds: string[];
}

const sameTarget = (a: CorruptTarget, b: CorruptTarget) =>
  a.kind === b.kind && a.id === b.id && (a.seasonNumber ?? null) === (b.seasonNumber ?? null) && (a.episodeNumber ?? null) === (b.episodeNumber ?? null);

/** Un fichier partagé par une autre entrée (épisodes combinés, doublon) ne se supprime jamais d'ici. */
function pathsSharedElsewhere(paths: Set<string>, self: CorruptTarget): boolean {
  const used = (file: { path?: string; diskPath?: string } | null | undefined) =>
    !!file && [file.path, file.diskPath].some((p) => p && paths.has(p));
  const seriesShared = loadSeries().some((s) =>
    s.seasons.some((se) =>
      se.episodes.some((ep) => {
        if (self.kind === "episode" && s.id === self.id && se.seasonNumber === self.seasonNumber && ep.episodeNumber === self.episodeNumber) return false;
        return used(ep.file);
      })
    )
  );
  if (seriesShared) return true;
  return loadMovies().some((m) => {
    if (self.kind === "movie" && m.id === self.id) return false;
    return [m.file, ...(m.versions ?? [])].some(used);
  });
}

async function removeEpisode(item: CorruptItem, action: CorruptAction, username: string): Promise<void> {
  const seasonNumber = item.seasonNumber ?? 0;
  const episodeNumber = item.episodeNumber ?? 0;
  await withKeyLock(`series:${item.id}`, async () => {
    const series = getSeries(item.id);
    const ep = series?.seasons.find((s) => s.seasonNumber === seasonNumber)?.episodes.find((e) => e.episodeNumber === episodeNumber);
    if (!series || !ep) throw new Error("not_found");
    if (ep.activeInfoHash || ep.status === "downloading" || ep.status === "searching") throw new Error("episode_busy");
    const filePath = ep.file?.diskPath ?? ep.file?.path;
    if (!filePath || filePath !== item.path) throw new Error("file_changed");
    const paths = new Set([ep.file?.path, ep.file?.diskPath].filter((p): p is string => !!p));
    if (pathsSharedElsewhere(paths, { kind: "episode", id: item.id, seasonNumber, episodeNumber })) throw new Error("shared_file");

    let trashedPath: string | null = null;
    if (existsSync(filePath)) {
      const trashPath = getTrashConfig().seriesPath;
      if (trashPath) trashedPath = await moveToTrash(filePath, trashPath);
      else await fs.unlink(filePath);
    }
    const label = `${series.title} — S${seasonNumber}E${episodeNumber}`;
    if (action === "delete") {
      addToTrash({
        id: `episode_${series.tmdbId}_${seasonNumber}_${episodeNumber}`,
        tmdbId: series.tmdbId, type: "episode", title: label,
        posterPath: series.posterPath, backdropPath: series.backdropPath, year: series.year,
        rating: series.rating, overview: series.overview, snapshot: ep,
        seriesTmdbId: series.tmdbId, seasonNumber, episodeNumber, origin: "manual", deletedAt: Date.now(),
      });
      clearEpisodeFile(item.id, seasonNumber, episodeNumber);
    } else {
      // Remplacement : l'épisode redevient manquant ET surveillé, pour que la
      // recherche habituelle des manquants le reprenne.
      updateSeries(item.id, {
        seasons: series.seasons.map((s) =>
          s.seasonNumber !== seasonNumber
            ? s
            : {
                ...s,
                episodes: s.episodes.map((e) =>
                  e.episodeNumber !== episodeNumber
                    ? e
                    : { ...e, status: "missing" as const, file: null, activeInfoHash: null, monitored: true, plexRatingKey: null, playbackSource: null, combinedFile: undefined }
                ),
              }
        ),
      });
    }
    if (trashedPath) addTrashEntry({ id: `episode:${item.id}:${seasonNumber}:${episodeNumber}:${Date.now()}`, kind: "series", title: label, trashPath: trashedPath, deletedAt: Date.now() });
    logActivity("removed", username, label, null);
  });
}

async function removeMovieFile(item: CorruptItem, action: CorruptAction, username: string): Promise<void> {
  await withKeyLock(`movie:${item.id}`, async () => {
    const movie = getMovie(item.id);
    if (!movie) throw new Error("not_found");
    if (movie.activeInfoHash || movie.status === "downloading" || movie.status === "searching") throw new Error("movie_busy");
    const filePath = movie.file?.diskPath ?? movie.file?.path;
    if (!filePath || filePath !== item.path) throw new Error("file_changed");
    const paths = new Set([movie.file?.path, movie.file?.diskPath].filter((p): p is string => !!p));
    if ((movie.versions?.length ?? 0) > 1) throw new Error("multiple_versions");
    if (pathsSharedElsewhere(paths, { kind: "movie", id: item.id })) throw new Error("shared_file");

    if (existsSync(filePath)) {
      const trashedTo = movie.file?.path ? await trashMovieFile(movie.file.path) : null;
      if (trashedTo) addTrashEntry({ id: movie.id, kind: "movie", title: movie.title, trashPath: trashedTo, deletedAt: Date.now() });
      else await fs.unlink(filePath);
    }
    if (action === "delete") removeMovie(item.id);
    else {
      updateMovie(item.id, {
        file: null, versions: [], status: "missing", monitored: true, activeInfoHash: null,
        plexRatingKey: null, plexMediaInfo: null, playbackSource: null,
      });
    }
    logActivity("removed", username, movie.title, null);
  });
}

/**
 * Supprime (corbeille si configurée, sinon effacement du seul fichier) les
 * fichiers corrompus choisis. Chaque cible doit figurer dans le dernier
 * rapport ET être toujours vide/incomplète au moment de l'action : on ne
 * supprime jamais un fichier devenu sain entre-temps.
 */
export async function resolveCorruptFiles(targets: CorruptTarget[], action: CorruptAction, username: string): Promise<ResolveResult> {
  const report = loadCorruptReport();
  const result: ResolveResult = { done: [], failed: [], movieIds: [], seriesIds: [] };
  for (const target of targets) {
    const item = report.items.find((i) => sameTarget(i, target));
    if (!item) { result.failed.push({ target, error: "not_in_report" }); continue; }
    try {
      // Le fichier doit être EXACTEMENT celui du balayage (taille + date) : un
      // téléchargement arrivé depuis, même au même chemin, n'est jamais touché.
      // Rapport d'avant l'empreinte (mtimeMs absent) : pas de comparaison possible, mais le
      // fichier est relu à l'instant et doit être encore vide/incomplet pour être supprimé.
      const check = await inspectFile(item.path);
      if (check && item.mtimeMs !== undefined && (check.size !== item.size || check.mtimeMs !== item.mtimeMs)) throw new Error("file_changed");
      if (check && check.ok) throw new Error("file_now_healthy");
      if (item.kind === "episode") await removeEpisode(item, action, username);
      else await removeMovieFile(item, action, username);
      result.done.push(target);
      if (action === "replace") {
        if (item.kind === "movie") result.movieIds.push(item.id);
        else if (!result.seriesIds.includes(item.id)) result.seriesIds.push(item.id);
      }
    } catch (err) {
      result.failed.push({ target, error: err instanceof Error ? err.message : String(err) });
    }
  }
  if (result.done.length > 0) {
    saveCorruptReport({ ...report, items: report.items.filter((i) => !result.done.some((d) => sameTarget(i, d))) });
  }
  return result;
}
