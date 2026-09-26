import path from "node:path";
import fsp from "node:fs/promises";
import { getSeries, loadSeries, updateSeries } from "@/lib/library/store";
import { loadNamingTemplates } from "@/lib/naming/store";
import { parseRelease } from "@/lib/naming/parser";
import { buildContext, renderSegment } from "@/lib/naming/render";
import type { ReleaseInfo } from "@/lib/naming/types";
import { pathFor } from "@/lib/library/renamePath";

/**
 * Anthologies Plex — l'exception « Monster » (demandée le 2026-09-26).
 *
 * TMDb publie chaque saison de l'anthologie Netflix « Monster » comme une
 * série à part (Dahmer, les frères Menendez, Ed Gein, Lizzie Borden) ; Plex,
 * lui, n'en connaît qu'UNE, « Monster », dont ce sont les saisons 1 à 4.
 * Rangée dans son propre dossier « Saison 1 », Lizzie Borden était fusionnée
 * par Plex dans Dahmer saison 1 — ses épisodes y devenaient des « versions »
 * invisibles de ceux de Dahmer. Movviz range donc ces séries sur le disque
 * comme les saisons de l'anthologie, là où Plex les attend ; dans Movviz,
 * chacune reste une série à part, avec sa propre numérotation.
 */
export interface Anthology {
  /** Dossier de la série sur le disque — celui que Plex associe déjà à l'anthologie. */
  folder: string;
  /** TMDb id de chaque série → numéro de saison dans l'anthologie. */
  seasons: Record<number, number>;
}

export const ANTHOLOGIES: Anthology[] = [
  // « /data/série/Monster » existe déjà : c'est l'anime Monster (2004).
  { folder: "Monster (2022)", seasons: { 113988: 1, 225634: 2, 286801: 3, 299939: 4 } },
];

export function anthologyFor(tmdbId: number): { anthology: Anthology; season: number } | null {
  for (const anthology of ANTHOLOGIES) {
    const season = anthology.seasons[tmdbId];
    if (season != null) return { anthology, season };
  }
  return null;
}

/**
 * Where an episode file of an anthology series belongs on disk, or null when
 * it is already there (or the series is not an anthology). The library root
 * is the folder holding the series folder: …/<root>/<série>/<saison>/<fichier>.
 * Only the SEASON number of the anthology changes the path; Movviz keeps the
 * series' own season/episode numbers.
 */
export function anthologyTargetPath(
  filePath: string,
  tmdbId: number,
  seasonNumber: number,
  episodeNumber: number,
  templates = loadNamingTemplates(),
): string | null {
  const hit = anthologyFor(tmdbId);
  if (!hit || seasonNumber !== 1) return null; // chaque volet de l'anthologie n'a qu'une saison
  const p = pathFor(filePath);
  const seasonDir = p.dirname(filePath);
  const seriesDir = p.dirname(seasonDir);
  const root = p.dirname(seriesDir);
  const parsed = parseRelease(p.basename(filePath));
  const ctx = buildContext({ ...parsed, title: hit.anthology.folder, year: "", season: hit.season, episode: episodeNumber, episodeEnd: null } as ReleaseInfo);
  const seasonFolder = renderSegment(templates.seasonFolder, ctx, templates.useDotsInsteadOfSpaces);
  // Déjà rangé dans la bonne saison de l'anthologie : on ne touche à rien
  // (les fichiers de Dahmer y sont depuis toujours, sous leur propre nom).
  if (p.basename(seriesDir) === hit.anthology.folder && p.basename(seasonDir) === seasonFolder) return null;
  const fileName = renderSegment(templates.episodeFile, ctx, templates.useDotsInsteadOfSpaces) + p.extname(filePath);
  return p.join(root, hit.anthology.folder, seasonFolder, fileName);
}

async function removeIfEmpty(dir: string): Promise<void> {
  try {
    if ((await fsp.readdir(dir)).length === 0) await fsp.rmdir(dir);
  } catch { /* absent ou non vide : rien à faire */ }
}

/** Moves the files of one anthology series where Plex expects them, and
 *  records the new paths. Idempotent. Returns how many files moved. */
export async function relocateAnthologyFiles(seriesId: string): Promise<number> {
  const series = getSeries(seriesId);
  if (!series || !anthologyFor(series.tmdbId)) return 0;
  const templates = loadNamingTemplates();
  const oldDirs = new Set<string>();
  let moved = 0;
  const seasons = [];
  for (const season of series.seasons) {
    const episodes = [];
    for (const ep of season.episodes) {
      const file = ep.file;
      // Le chemin réel sur le disque (diskPath) quand le chemin enregistré est celui vu par Plex.
      const source = file ? file.diskPath ?? file.path : null;
      const target = source ? anthologyTargetPath(source, series.tmdbId, season.seasonNumber, ep.episodeNumber, templates) : null;
      if (!file || !source || !target) { episodes.push(ep); continue; }
      try {
        await fsp.access(source);
        await fsp.mkdir(path.dirname(target), { recursive: true });
        try {
          await fsp.access(target);
          episodes.push(ep); // un fichier occupe déjà la place : on ne l'écrase jamais
          continue;
        } catch { /* place libre */ }
        await fsp.rename(source, target);
        oldDirs.add(path.dirname(source));
        episodes.push({ ...ep, file: { ...file, path: target, diskPath: undefined }, plexRatingKey: null });
        moved++;
      } catch (error) {
        console.warn(`[anthology] ${series.title} S${season.seasonNumber}E${ep.episodeNumber} : déplacement impossible (${(error as Error).message})`);
        episodes.push(ep);
      }
    }
    seasons.push({ ...season, episodes });
  }
  if (moved === 0) return 0;
  updateSeries(series.id, { seasons, plexRatingKey: null });
  for (const dir of oldDirs) {
    await removeIfEmpty(dir);
    await removeIfEmpty(path.dirname(dir));
  }
  console.log(`[anthology] ${series.title} : ${moved} fichier(s) rangé(s) dans l'anthologie`);
  return moved;
}

/** Every anthology series already in the library — run once at start-up so
 *  files imported before this rule existed move too. */
export async function relocateAllAnthologies(): Promise<number> {
  let moved = 0;
  for (const series of loadSeries()) {
    if (anthologyFor(series.tmdbId)) moved += await relocateAnthologyFiles(series.id);
  }
  return moved;
}
