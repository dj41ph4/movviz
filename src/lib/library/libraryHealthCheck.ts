import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import { loadMovies, loadSeries } from "@/lib/library/store";
import { transitionUpcomingMovies } from "@/lib/library/autoGrab";
import { transitionUpcomingEpisodes } from "@/lib/library/autoGrabSeries";
import { parseRelease } from "@/lib/naming/parser";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";

/**
 * Library health check — a read-only diagnostic pass over the whole library.
 * Deliberately never searches or downloads anything (that's autoGrab's job);
 * this only prepares data so Doctor Movviz (LOT4.4) and the user have a real
 * picture of what's inconsistent. Runs monthly on the scheduler plus
 * on-demand via /api/tasks/library-health-check/run — same generic manual
 * trigger every other scheduled task already uses.
 */

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const REPORT_FILE = path.join(CONFIG_DIR, "library-health-report.json");

export interface LibraryHealthIssue {
  kind: "no_language_detected" | "inconsistent_status" | "released_still_upcoming" | "incomplete_metadata";
  refType: "movie" | "episode";
  refId: string; // movie id, or "seriesId:season:episode" for an episode
  title: string;
  detail: string;
}

export interface LibraryHealthReport {
  ranAt: number;
  transitionedMovies: number;
  transitionedEpisodes: number;
  scannedMovies: number;
  scannedEpisodes: number;
  issues: LibraryHealthIssue[];
}

export function loadLibraryHealthReport(): LibraryHealthReport | null {
  return readJsonCached<LibraryHealthReport | null>(REPORT_FILE, null);
}

function saveLibraryHealthReport(report: LibraryHealthReport) {
  writeJsonCached(REPORT_FILE, report);
}

/**
 * Only checks whether a title stated in the release filename could be
 * parsed — this is a preparatory data-quality signal, not the fuller
 * filename+Plex fusion LOT2.2 will build into MediaBadges. Kept intentionally
 * simple here so this task stays cheap and doesn't duplicate that work.
 */
function hasDetectableLanguage(filePath: string): boolean {
  return parseRelease(path.basename(filePath)).language !== null;
}

export async function runLibraryHealthCheck(): Promise<LibraryHealthReport> {
  const t0 = performance.now();
  const { transitioned: transitionedMovies } = transitionUpcomingMovies();
  const { transitioned: transitionedEpisodes } = transitionUpcomingEpisodes();

  const issues: LibraryHealthIssue[] = [];
  const movies = loadMovies();
  const series = loadSeries();

  for (const movie of movies) {
    if (!movie.monitored) continue;

    if (movie.status === "available" && !movie.file) {
      issues.push({ kind: "inconsistent_status", refType: "movie", refId: movie.id, title: movie.title, detail: "Statut « disponible » mais aucun fichier associé." });
    }
    if (movie.status === "downloading" && !movie.activeInfoHash) {
      issues.push({ kind: "inconsistent_status", refType: "movie", refId: movie.id, title: movie.title, detail: "Statut « téléchargement » mais aucun torrent actif." });
    }
    if (movie.status === "upcoming") {
      const released = movie.vfReleaseDate ?? movie.releaseDate;
      if (released && new Date(released).getTime() <= Date.now()) {
        issues.push({ kind: "released_still_upcoming", refType: "movie", refId: movie.id, title: movie.title, detail: `Sorti le ${released} mais toujours marqué « à venir ».` });
      }
    }
    if (movie.file && !hasDetectableLanguage(movie.file.path)) {
      issues.push({ kind: "no_language_detected", refType: "movie", refId: movie.id, title: movie.title, detail: "Aucune langue détectable dans le nom du fichier." });
    }
    if (movie.status === "available" && movie.file && (!movie.file.resolution || !movie.file.source)) {
      issues.push({ kind: "incomplete_metadata", refType: "movie", refId: movie.id, title: movie.title, detail: "Résolution ou source manquante sur le fichier possédé." });
    }
  }

  let scannedEpisodes = 0;
  for (const s of series) {
    for (const season of s.seasons) {
      if (!season.monitored) continue;
      for (const ep of season.episodes) {
        if (!ep.monitored) continue;
        scannedEpisodes++;
        const refId = `${s.id}:${season.seasonNumber}:${ep.episodeNumber}`;
        const label = `${s.title} S${String(season.seasonNumber).padStart(2, "0")}E${String(ep.episodeNumber).padStart(2, "0")}`;

        if (ep.status === "available" && !ep.file) {
          issues.push({ kind: "inconsistent_status", refType: "episode", refId, title: label, detail: "Statut « disponible » mais aucun fichier associé." });
        }
        if (ep.status === "downloading" && !ep.activeInfoHash) {
          issues.push({ kind: "inconsistent_status", refType: "episode", refId, title: label, detail: "Statut « téléchargement » mais aucun torrent actif." });
        }
        if (ep.status === "upcoming" && ep.airDate && new Date(ep.airDate).getTime() <= Date.now()) {
          issues.push({ kind: "released_still_upcoming", refType: "episode", refId, title: label, detail: `Diffusé le ${ep.airDate} mais toujours marqué « à venir ».` });
        }
        if (ep.file && !hasDetectableLanguage(ep.file.path)) {
          issues.push({ kind: "no_language_detected", refType: "episode", refId, title: label, detail: "Aucune langue détectable dans le nom du fichier." });
        }
      }
    }
  }

  const report: LibraryHealthReport = {
    ranAt: Date.now(),
    transitionedMovies: transitionedMovies.length,
    transitionedEpisodes: transitionedEpisodes.length,
    scannedMovies: movies.length,
    scannedEpisodes,
    issues,
  };
  saveLibraryHealthReport(report);

  const ms = Math.round(performance.now() - t0);
  recordSearchLog(
    "info",
    "library_health_check.done",
    `${movies.length} film(s), ${scannedEpisodes} épisode(s) suivis analysés — ${issues.length} anomalie(s), ${transitionedMovies.length + transitionedEpisodes.length} statut(s) rattrapé(s) (${ms}ms)`,
    ms
  );

  return report;
}
