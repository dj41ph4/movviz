import fs from "node:fs";
import path from "node:path";
import { loadSeries, updateSeriesList } from "./store";
import { parseRelease } from "@/lib/naming/parser";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import type { LibraryEpisode, LibrarySeries } from "./types";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const SNAPSHOT_DIR = path.join(CONFIG_DIR, "repair-snapshots");
const FLAG = path.join(CONFIG_DIR, "repair-shared-file-links-2026-11-16.done");

const physical = (e: LibraryEpisode) => e.file?.diskPath ?? e.file?.path ?? null;

export interface SharedLinkRepair { seriesId: string; title: string; detached: string[] }

/**
 * A season pack whose files carried the release's range (S01E10-E19 on each)
 * linked its first file to every episode of the range: those episodes showed
 * « available » while no file of theirs existed, so nothing ever searched
 * them (51 such links on 2026-11-16 — Beavis and Butt-Head, The Beast, Close
 * Enough, Haunted Hotel, New York Police Judiciaire).
 *
 * A link is taken back only when it is provably one of those: several
 * episodes of the series share the file, this episode is not the one the
 * file is named after, another episode of the series IS (by name, or by
 * Plex's own link), and neither Plex links this episode to it nor is it a
 * declared multi-episode file. Everything else is left alone. The series is
 * saved to a snapshot before any change.
 */
export function repairSharedFileLinks(seriesList: LibrarySeries[] = loadSeries(), snapshotDir = SNAPSHOT_DIR): SharedLinkRepair[] {
  const patches = new Map<string, Partial<LibrarySeries>>();
  const results: SharedLinkRepair[] = [];
  for (const series of seriesList) {
    const holders = new Map<string, Array<{ season: number; ep: LibraryEpisode }>>();
    for (const s of series.seasons) for (const ep of s.episodes) {
      const p = physical(ep);
      if (p && !ep.combinedFile) holders.set(p, [...(holders.get(p) ?? []), { season: s.seasonNumber, ep }]);
    }
    const detach = new Set<string>();
    for (const [p, list] of holders) {
      if (list.length < 2) continue;
      const parsed = parseRelease(path.basename(p));
      const ownedByName = (h: { season: number; ep: LibraryEpisode }) => parsed.season === h.season && parsed.episode === h.ep.episodeNumber;
      const owner = list.find(ownedByName) ?? (parsed.episode == null ? null : undefined);
      // Nobody is the file by name: no proof of which link is right — left alone.
      if (!owner) continue;
      for (const h of list) {
        if (h === owner || h.ep.plexRatingKey || ownedByName(h)) continue;
        // A real double episode named as a range (S01E10-E11) keeps both.
        const range = path.basename(p).match(/S(\d{1,2})[ ._-]?E(\d{1,4})[ ._-]?(?:-|to)?[ ._-]?E(\d{1,4})/i);
        const end = range ? Number(range[3]) : null;
        if (parsed.season === h.season && parsed.episode != null && end != null && h.ep.episodeNumber > parsed.episode && h.ep.episodeNumber <= end) continue;
        detach.add(`${h.season}-${h.ep.episodeNumber}`);
      }
    }
    if (detach.size === 0) continue;
    const seasons = series.seasons.map((s) => ({
      ...s,
      episodes: s.episodes.map((ep) => detach.has(`${s.seasonNumber}-${ep.episodeNumber}`)
        ? { ...ep, file: null, status: "missing" as const, playbackSource: null, activeInfoHash: null }
        : ep),
    }));
    try {
      fs.mkdirSync(snapshotDir, { recursive: true });
      fs.writeFileSync(path.join(snapshotDir, `shared-links-${series.id}-${Date.now()}.json`), JSON.stringify({ series, detached: [...detach], createdAt: Date.now() }), "utf8");
    } catch { continue; } // no way back: change nothing
    patches.set(series.id, { seasons });
    results.push({ seriesId: series.id, title: series.title, detached: [...detach] });
  }
  if (patches.size > 0) updateSeriesList(patches);
  for (const r of results) {
    recordSearchLog("warn", "library.shared_links_repaired", `${r.title} : ${r.detached.length} épisode(s) qui partageaient le fichier d'un autre épisode remis en « manquant » (${r.detached.slice(0, 8).map((k) => `S${k.replace("-", "E")}`).join(", ")}${r.detached.length > 8 ? "…" : ""})`);
  }
  return results;
}

/** Once, at start-up (see instrumentation.ts). */
export function repairSharedFileLinksOnce(): SharedLinkRepair[] | null {
  if (fs.existsSync(FLAG)) return null;
  const results = repairSharedFileLinks();
  try { fs.mkdirSync(CONFIG_DIR, { recursive: true }); fs.writeFileSync(FLAG, JSON.stringify({ results, at: Date.now() })); } catch { /* retried next start */ }
  console.log(`[repairSharedFileLinks] ${results.length} série(s), ${results.reduce((n, r) => n + r.detached.length, 0)} lien(s) erroné(s) retiré(s)`);
  return results;
}
