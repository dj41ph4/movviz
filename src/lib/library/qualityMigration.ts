import fs from "node:fs";
import path from "node:path";
import { loadMovies, loadSeries, updateMovies, updateSeriesList } from "./store";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FLAG = path.join(CONFIG_DIR, "migration-quality-720p.done");

/**
 * Migration unique (v1.28.65) : tout ce qui est déjà en bibliothèque passe au profil
 * « 720p minimum » (le profil HD-1080p refusait les seules releases françaises en 720p).
 * Volontairement absente des réglages et jouée une seule fois : les titres ajoutés ensuite
 * suivent le profil par défaut.
 */
export function migrateLibraryTo720pOnce(): { series: number; movies: number } | null {
  if (fs.existsSync(FLAG)) return null;
  const series = loadSeries().filter((s) => s.qualityProfileId !== "hd-720p");
  const movies = loadMovies().filter((m) => m.qualityProfileId !== "hd-720p");
  updateSeriesList(new Map(series.map((s) => [s.id, { qualityProfileId: "hd-720p" }])));
  updateMovies(new Map(movies.map((m) => [m.id, { qualityProfileId: "hd-720p" }])));
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(FLAG, new Date().toISOString());
  return { series: series.length, movies: movies.length };
}
