import fs from "node:fs";
import path from "node:path";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import { loadMovies, loadSeries, updateMovies, updateSeriesList } from "./store";
import type { LibraryFile } from "./types";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FLAG = path.join(CONFIG_DIR, "repair-recent-additions-2026-11-05.done");

/** Début de la fenêtre touchée : démarrage de la v1.28.67 (5 novembre 2026, 19 h 56 UTC), avec une marge. */
const WINDOW_START = Date.parse("2026-11-05T19:50:00Z");

/**
 * Date d'ajout réelle d'un fichier dont la date a été remise à « maintenant » à tort : la date de création du
 * fichier sur le disque. Un vrai téléchargement récent a un fichier récent et garde donc sa date ; un fichier
 * ancien retrouve la sienne. Illisible (disque absent) → null, la date n'est pas touchée.
 */
function realAddedAt(file: LibraryFile): number | null {
  for (const candidate of [file.diskPath, file.path]) {
    if (!candidate) continue;
    try {
      const st = fs.statSync(candidate);
      const t = Math.min(st.birthtimeMs > 0 ? st.birthtimeMs : st.mtimeMs, st.mtimeMs);
      if (Number.isFinite(t) && t > 0) return Math.round(t);
    } catch { /* essaie le chemin suivant */ }
  }
  return null;
}

function repaired(file: LibraryFile | null | undefined): LibraryFile | null {
  if (!file || file.addedAt < WINDOW_START) return null;
  const real = realAddedAt(file);
  return real != null && real < file.addedAt - 60_000 ? { ...file, addedAt: real } : null;
}

/** Une seule fois : remet les dates d'ajout faussées par le changement de fichier Plex du 5 novembre 2026. */
export function repairFalseRecentAdditionsOnce(): { episodes: number; movies: number } | null {
  if (fs.existsSync(FLAG)) return null;
  const seriesPatches = new Map<string, { seasons: ReturnType<typeof loadSeries>[number]["seasons"] }>();
  let episodes = 0;
  for (const series of loadSeries()) {
    let touched = false;
    const seasons = series.seasons.map((season) => ({
      ...season,
      episodes: season.episodes.map((ep) => {
        const fixed = repaired(ep.file);
        if (!fixed) return ep;
        touched = true;
        episodes++;
        return { ...ep, file: fixed };
      }),
    }));
    if (touched) seriesPatches.set(series.id, { seasons });
  }
  updateSeriesList(seriesPatches);

  const moviePatches = new Map<string, { file: LibraryFile }>();
  for (const movie of loadMovies()) {
    const fixed = repaired(movie.file);
    if (fixed) moviePatches.set(movie.id, { file: fixed });
  }
  updateMovies(moviePatches);

  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(FLAG, new Date().toISOString());
  recordSearchLog("info", "repair.recent_additions", `Dates d'ajout rétablies : ${episodes} épisode(s) dans ${seriesPatches.size} série(s), ${moviePatches.size} film(s)`);
  return { episodes, movies: moviePatches.size };
}
