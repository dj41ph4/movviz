import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { getSeries, loadSeries, updateSeries } from "@/lib/library/store";
import { loadNamingTemplates } from "@/lib/naming/store";
import { parseRelease } from "@/lib/naming/parser";
import { buildContext, renderSegment } from "@/lib/naming/render";
import type { ReleaseInfo } from "@/lib/naming/types";
import { pathFor } from "@/lib/library/renamePath";
import { withKeyLock } from "@/lib/library/locks";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";

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
export { ANTHOLOGIES, anthologyFor, type Anthology } from "@/lib/library/anthologyIds";
import { anthologyFor } from "@/lib/library/anthologyIds";

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

const CONFIG_DIR = process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data");
const PENDING_FILE = path.join(CONFIG_DIR, "anthology-pending-deletions.json");

function readPending(): string[] {
  try { return JSON.parse(fs.readFileSync(PENDING_FILE, "utf8")) as string[]; } catch { return []; }
}
function writePending(list: string[]): void {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(PENDING_FILE, JSON.stringify([...new Set(list)], null, 2));
}

/** Originals already copied into the anthology but still locked when the
 *  copy was made: deleted as soon as they can be. */
export async function purgePendingAnthologyDeletions(): Promise<number> {
  const pending = readPending();
  if (pending.length === 0) return 0;
  const left: string[] = [];
  let purged = 0;
  for (const file of pending) {
    try {
      await fsp.rm(file, { force: true });
      await removeIfEmpty(path.dirname(file));
      await removeIfEmpty(path.dirname(path.dirname(file)));
      purged++;
    } catch {
      left.push(file);
    }
  }
  writePending(left);
  return purged;
}

export interface AnthologyMoveReport {
  series: string;
  episode: string;
  from: string;
  to: string;
  result: "moved" | "copied" | "copied_original_locked" | "occupied" | "error";
  error?: string;
}

/** rename, or — when the NAS refuses it across mounts (EXDEV) or for any
 *  other reason — copy, check the size, then delete the original. The
 *  original is never removed before an identical copy exists. */
async function moveFile(source: string, target: string): Promise<"moved" | "copied" | "copied_original_locked"> {
  try {
    await fsp.rename(source, target);
    return "moved";
  } catch (renameError) {
    const { size } = await fsp.stat(source);
    try {
      await fsp.copyFile(source, target);
      const copied = await fsp.stat(target);
      if (copied.size !== size) throw new Error(`copie incomplète (${copied.size}/${size} octets)`);
    } catch (copyError) {
      await fsp.rm(target, { force: true }).catch(() => {});
      throw new Error(`renommage : ${(renameError as Error).message} ; copie : ${(copyError as Error).message}`);
    }
    try {
      await fsp.rm(source);
      return "copied";
    } catch {
      // The copy is complete and verified: the library now uses it; the
      // locked original goes once it is released.
      writePending([...readPending(), source]);
      return "copied_original_locked";
    }
  }
}

/** Moves the files of one anthology series where Plex expects them, and
 *  records the new paths. Idempotent. The caller holds the series lock. */
export async function relocateAnthologyFiles(seriesId: string, report: AnthologyMoveReport[] = []): Promise<number> {
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
      const line: AnthologyMoveReport = { series: series.title, episode: `S${season.seasonNumber}E${ep.episodeNumber}`, from: source, to: target, result: "error" };
      report.push(line);
      try {
        await fsp.access(source);
        await fsp.mkdir(path.dirname(target), { recursive: true });
        const occupied = await fsp.access(target).then(() => true, () => false);
        if (occupied) {
          line.result = "occupied"; // un fichier occupe déjà la place : on ne l'écrase jamais
          episodes.push(ep);
          continue;
        }
        line.result = await moveFile(source, target);
        oldDirs.add(path.dirname(source));
        episodes.push({ ...ep, file: { ...file, path: target, diskPath: undefined }, plexRatingKey: null });
        moved++;
      } catch (error) {
        line.error = (error as Error).message;
        recordSearchLog("warn", "library.anthology", `${series.title} ${line.episode} : déplacement impossible vers « ${target} » — ${line.error}`);
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
  recordSearchLog("info", "library.anthology", `${series.title} : ${moved} fichier(s) rangé(s) dans l'anthologie`);
  return moved;
}

/** Every anthology series already in the library — at start-up (files
 *  imported before this rule existed) and on demand from the admin route. */
export async function relocateAllAnthologies(report: AnthologyMoveReport[] = []): Promise<number> {
  await purgePendingAnthologyDeletions();
  let moved = 0;
  for (const series of loadSeries()) {
    if (!anthologyFor(series.tmdbId)) continue;
    moved += await withKeyLock(`series:${series.id}`, () => relocateAnthologyFiles(series.id, report));
  }
  return moved;
}
