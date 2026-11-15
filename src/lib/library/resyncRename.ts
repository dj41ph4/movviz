import fs from "node:fs";
import { pathFor } from "./renamePath";
import { loadNamingTemplates } from "@/lib/naming/store";
import { renderSegment } from "@/lib/naming/render";
import { parseRelease } from "@/lib/naming/parser";
import type { NamingContext } from "@/lib/naming/types";
import type { LibrarySeason, LibrarySeries } from "./types";

const SEASON_DIR = /^(?:specials?|S(?:aison|eason)?[. _-]?\d{1,2}\b.*)$/i;
const TMP_SUFFIX = ".movviz-resync-tmp";

/**
 * The season folder to use under the series root: the one already holding
 * this season, else a new one named like its siblings (« Saison 1 » →
 * « Saison 2 », « Season 01 » → « Season 02 ») so the show keeps one style.
 * Null only when the series has no season folder at all (template decides).
 */
function existingSeasonFolder(root: string, seasonNumber: number): string | null {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return null; }
  let sibling: string | null = null;
  for (const entry of entries) {
    const name = entry.name.trim();
    if (!entry.isDirectory() || !SEASON_DIR.test(name)) continue;
    const n = /^specials?$/i.test(name) ? 0 : parseInt(name.match(/(\d{1,2})/)?.[1] ?? "-1", 10);
    if (n === seasonNumber) return entry.name;
    if (n > 0 && !sibling) sibling = name;
  }
  if (!sibling || seasonNumber === 0) return null;
  const m = sibling.match(/^(.*?)(\d{1,2})/)!;
  return `${m[1]}${String(seasonNumber).padStart(m[2].length, "0")}`;
}

export interface ResyncRenameResult {
  seasons: LibrarySeason[];
  renamed: number;
  /** Files left under their old name (target taken, unreadable, other drive…). */
  kept: number;
}

interface Move {
  seasonNumber: number;
  episodeNumber: number;
  src: string;
  dst: string;
  /** Subtitles & co. sharing the video's base name, renamed with it. */
  sidecars: Array<{ src: string; dst: string }>;
}

/**
 * After a resync placed files on other episodes, renames ONLY those files
 * (`onlyEpisodes`, "season-episode" keys of the episodes that changed file)
 * so their name carries their new number (the user's naming templates, in
 * the series' existing folder) — what Plex, and any later scan, reads.
 * Purely local: works with Plex absent or offline.
 *
 * Safe by construction: a file is renamed only when its name's number
 * differs from its episode; nothing is ever overwritten (a target held by a
 * file outside this batch keeps the episode under its old name); every move
 * goes through a temporary name first, so chains like E09→E10, E10→E11 in
 * one folder can't collide; a failed move is put back where it was. Library
 * records change only for files really moved.
 */
export async function renameResyncedFiles(series: LibrarySeries, seasons: LibrarySeason[], onlyEpisodes: Set<string>, log: (msg: string) => void = () => {}): Promise<ResyncRenameResult> {
  const templates = loadNamingTemplates();
  const useDots = templates.useDotsInsteadOfSpaces;
  const moves: Move[] = [];

  for (const season of seasons) {
    for (const ep of season.episodes) {
      const src = ep.file?.diskPath ?? ep.file?.path;
      if (!src || !onlyEpisodes.has(`${season.seasonNumber}-${ep.episodeNumber}`)) continue;
      const p = pathFor(src);
      const name = p.basename(src);
      const parsed = parseRelease(name);
      // A name without a number (absolute numbering, free naming) is left alone.
      if (parsed.season == null || parsed.episode == null) continue;
      if (parsed.season === season.seasonNumber && parsed.episode === ep.episodeNumber) continue;
      const dir = p.dirname(src);
      const root = SEASON_DIR.test(p.basename(dir)) ? p.dirname(dir) : dir;
      const ctx: NamingContext = {
        title: series.title, year: series.year ? String(series.year) : null,
        season: season.seasonNumber, episode: ep.episodeNumber, episodeTitle: ep.title || null,
        quality: ep.file!.quality ?? "",
        resolution: parsed.resolution ?? ep.file!.resolution,
        source: parsed.source, videoCodec: parsed.videoCodec, audioCodec: parsed.audioCodec,
        hdr: parsed.hdr, language: parsed.language, group: parsed.group,
      };
      // The series' own season folder wins over the template: a moved file
      // joins its siblings instead of opening a second folder for the season.
      const seasonFolder = existingSeasonFolder(root, season.seasonNumber)
        ?? (season.seasonNumber === 0 ? "Specials" : renderSegment(templates.seasonFolder, ctx, useDots));
      const ext = p.extname(src);
      const base = renderSegment(templates.episodeFile, ctx, useDots);
      const dst = p.join(root, seasonFolder, base + ext);
      if (dst === src) continue;
      const oldBase = name.slice(0, name.length - ext.length);
      let sidecars: Move["sidecars"] = [];
      try {
        sidecars = fs.readdirSync(dir)
          .filter((f) => f !== name && f.startsWith(`${oldBase}.`) && !f.endsWith(TMP_SUFFIX))
          .map((f) => ({ src: p.join(dir, f), dst: p.join(root, seasonFolder, base + f.slice(oldBase.length)) }));
      } catch { /* folder unreadable: the move below fails cleanly too */ }
      moves.push({ seasonNumber: season.seasonNumber, episodeNumber: ep.episodeNumber, src, dst, sidecars });
    }
  }
  if (moves.length === 0) return { seasons, renamed: 0, kept: 0 };

  // A target may only be free, or held by a file of this same batch.
  const leaving = new Set(moves.flatMap((m) => [m.src, ...m.sidecars.map((s) => s.src)]));
  const targets = new Set<string>();
  const runnable = moves.filter((m) => {
    const all = [m.dst, ...m.sidecars.map((s) => s.dst)];
    const blocked = all.some((d) => targets.has(d) || (fs.existsSync(d) && !leaving.has(d)));
    if (blocked) { log(`[resyncRename] conservé sous son nom (cible occupée) : ${m.src}`); return false; }
    if (!fs.existsSync(m.src)) { log(`[resyncRename] introuvable : ${m.src}`); return false; }
    all.forEach((d) => targets.add(d));
    return true;
  });

  // Phase 1: every source steps aside under a temporary name.
  const parked: Array<{ move: Move; items: Array<{ src: string; tmp: string; dst: string }> }> = [];
  for (const move of runnable) {
    const items = [{ src: move.src, dst: move.dst }, ...move.sidecars].map((it) => ({ ...it, tmp: it.src + TMP_SUFFIX }));
    const done: typeof items = [];
    try {
      for (const it of items) { await fs.promises.rename(it.src, it.tmp); done.push(it); }
      parked.push({ move, items });
    } catch (err) {
      for (const it of done.reverse()) await fs.promises.rename(it.tmp, it.src).catch(() => {});
      log(`[resyncRename] non renommé ${move.src} : ${(err as Error).message}`);
    }
  }

  // Phase 2: each one lands on its final name, or goes back where it was.
  const movedTo = new Map<string, string>();
  for (const { move, items } of parked) {
    const landed: typeof items = [];
    try {
      for (const it of items) {
        fs.mkdirSync(pathFor(it.dst).dirname(it.dst), { recursive: true });
        if (fs.existsSync(it.dst)) throw new Error(`cible occupée : ${it.dst}`);
        await fs.promises.rename(it.tmp, it.dst);
        landed.push(it);
      }
      movedTo.set(`${move.seasonNumber}-${move.episodeNumber}`, move.dst);
      log(`[resyncRename] ${move.src} → ${move.dst}`);
    } catch (err) {
      for (const it of landed.reverse()) await fs.promises.rename(it.dst, it.tmp).catch(() => {});
      for (const it of items) await fs.promises.rename(it.tmp, it.src).catch(() => {});
      log(`[resyncRename] remis en place ${move.src} : ${(err as Error).message}`);
    }
  }

  const next = seasons.map((season) => ({
    ...season,
    episodes: season.episodes.map((ep) => {
      const dst = movedTo.get(`${season.seasonNumber}-${ep.episodeNumber}`);
      return dst && ep.file ? { ...ep, file: { ...ep.file, path: dst, diskPath: dst } } : ep;
    }),
  }));
  return { seasons: next, renamed: movedTo.size, kept: moves.length - movedTo.size };
}
