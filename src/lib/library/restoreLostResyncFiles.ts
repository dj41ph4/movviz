import fs from "node:fs";
import path from "node:path";
import { loadSeries, updateSeries } from "./store";
import type { LibraryEpisode, LibraryFile, LibrarySeason, LibrarySeries } from "./types";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const SNAPSHOT_DIR = path.join(CONFIG_DIR, "repair-snapshots");
const FLAG = path.join(CONFIG_DIR, "restore-lost-resync-files-2026-11-16.done");

const physical = (f: LibraryFile | null | undefined) => f?.diskPath ?? f?.path ?? null;

export interface LostFilesRestore {
  seriesId: string;
  title: string;
  snapshot: string;
  /** Files the series had lost and holds again. */
  relinked: number;
  filesBefore: number;
  filesAfter: number;
}

/**
 * On the night of 2026-11-16 the automatic anime resync left Naruto
 * Shippuden with 18 linked files out of 482: the other 464 were still on
 * disk, but their episodes had become « missing » (so searchable again).
 * Every resync writes the whole series to a snapshot BEFORE touching it, so
 * nothing is lost: a series is put back as its snapshot had it when — and
 * only when — that snapshot links files that still exist on disk and that no
 * episode of the library links any more.
 *
 * A copy the resync set aside as a duplicate is not a lost file.
 * The most recent such snapshot wins (the state right before the damage).
 * A file renamed since (same size, still linked today) keeps today's path;
 * a file that no longer exists comes back as a missing episode; a file
 * linked since the snapshot keeps its episode when that slot is free. The
 * state replaced is itself saved first (`restore-lost-…json`).
 */
export function restoreLostResyncFiles(snapshotDir = SNAPSHOT_DIR, exists: (p: string) => boolean = fs.existsSync, plexKnown: ReadonlySet<string> = new Set()): LostFilesRestore[] {
  let names: string[];
  try { names = fs.readdirSync(snapshotDir).filter((n) => n.startsWith("anime-resync-") && n.endsWith(".json")); } catch { return []; }
  const bySeries = new Map<string, Array<{ at: number; file: string }>>();
  for (const name of names) {
    const m = name.match(/^anime-resync-(.+)-(\d+)\.json$/);
    if (!m) continue;
    bySeries.set(m[1], [...(bySeries.get(m[1]) ?? []), { at: Number(m[2]), file: name }]);
  }
  const all = loadSeries();
  const linked = new Set<string>();
  for (const s of all) for (const season of s.seasons) for (const e of season.episodes) {
    for (const p of [e.file?.path, e.file?.diskPath]) if (p) linked.add(p);
  }
  const results: LostFilesRestore[] = [];

  for (const [seriesId, snapshots] of bySeries) {
    const current = all.find((s) => s.id === seriesId);
    if (!current) continue;
    const isLost = (e: LibraryEpisode) => {
      const p = physical(e.file);
      if (!p || linked.has(p) || (e.file?.path && linked.has(e.file.path))) return false;
      // Present on disk — or, for a file only Plex can reach (its path means
      // nothing inside Movviz), an episode Plex confirms it still holds.
      return exists(p) || (!!e.plexRatingKey && plexKnown.has(e.plexRatingKey));
    };
    let chosen: { file: string; series: LibrarySeries; lost: number } | null = null;
    for (const snap of [...snapshots].sort((a, b) => b.at - a.at)) {
      let before: LibrarySeries | null = null;
      // A copy the resync itself set aside as a duplicate was dropped on
      // purpose (it may still sit on disk, unlinked): never a lost file.
      let setAside = new Set<string>();
      try {
        const json = JSON.parse(fs.readFileSync(path.join(snapshotDir, snap.file), "utf8"));
        before = json.series ?? null;
        setAside = new Set(((json.plan?.duplicates ?? []) as Array<{ droppedPath?: string }>).map((d) => d.droppedPath).filter((p): p is string => !!p));
      } catch { continue; }
      if (!before?.seasons) continue;
      const lost = before.seasons.flatMap((s) => s.episodes).filter((e) => isLost(e) && !setAside.has(physical(e.file)!)).length;
      if (lost > 0) { chosen = { file: snap.file, series: before, lost }; break; }
    }
    if (!chosen) continue;

    // Files linked today, to follow a rename (same size) and to keep new arrivals.
    const today = current.seasons.flatMap((s) => s.episodes.filter((e) => e.file).map((e) => ({ season: s.seasonNumber, episode: e })));
    const usedToday = new Set<string>();
    const seasons: LibrarySeason[] = chosen.series.seasons.map((season) => ({
      ...season,
      episodes: season.episodes.map((e) => {
        const p = physical(e.file);
        if (!p || !e.file) return e;
        if (exists(p) || (e.plexRatingKey && plexKnown.has(e.plexRatingKey))) { usedToday.add(p); return e; }
        const renamed = today.find((t) => !usedToday.has(physical(t.episode.file)!) && t.episode.file!.size === e.file!.size && path.extname(physical(t.episode.file)!) === path.extname(p));
        if (renamed) {
          const now = physical(renamed.episode.file)!;
          usedToday.add(now);
          return { ...e, file: { ...e.file, path: now, diskPath: now } };
        }
        return { ...e, file: null, status: e.status === "available" ? "missing" as const : e.status, plexRatingKey: null };
      }),
    }));
    // A file that arrived after the snapshot stays on its episode when that slot is free there.
    for (const t of today) {
      const p = physical(t.episode.file)!;
      if (usedToday.has(p)) continue;
      const slot = seasons.find((s) => s.seasonNumber === t.season)?.episodes.find((e) => e.episodeNumber === t.episode.episodeNumber);
      if (slot && !slot.file) {
        Object.assign(slot, { file: t.episode.file, status: "available", plexRatingKey: t.episode.plexRatingKey ?? null, playbackSource: t.episode.playbackSource ?? null });
        usedToday.add(p);
      }
    }
    const count = (list: LibrarySeason[]) => list.reduce((n, s) => n + s.episodes.filter((e) => e.file).length, 0);
    const filesBefore = count(current.seasons), filesAfter = count(seasons);
    // Never a net loss: if today's state somehow holds more, it is left alone.
    if (filesAfter <= filesBefore) continue;

    try {
      fs.mkdirSync(snapshotDir, { recursive: true });
      fs.writeFileSync(path.join(snapshotDir, `restore-lost-${seriesId}-${Date.now()}.json`), JSON.stringify({ series: current, restoredFrom: chosen.file, createdAt: Date.now() }), "utf8");
    } catch { continue; } // no way to undo: do nothing
    const order = chosen.series.episodeOrder;
    updateSeries(seriesId, {
      seasons,
      episodeOrder: order,
      // Plex follows the numbering the files carry again.
      ...(current.plexRatingKey && current.episodeOrder !== order ? { plexOrderPending: order === "tvdb" ? "tvdb" as const : "tmdb" as const } : {}),
    });
    const result = { seriesId, title: current.title, snapshot: chosen.file, relinked: chosen.lost, filesBefore, filesAfter };
    results.push(result);
    recordSearchLog("warn", "library.resync_restore", `${current.title} : ${chosen.lost} fichier(s) que la resynchronisation avait détachés sont de nouveau liés (${filesBefore} → ${filesAfter} fichiers), d'après ${chosen.file}`);
  }
  return results;
}

/**
 * Plex keys of the snapshot episodes whose file no episode links today and
 * that cannot be checked on disk: the ones worth asking Plex about.
 */
export function unlinkedSnapshotPlexKeys(snapshotDir = SNAPSHOT_DIR, exists: (p: string) => boolean = fs.existsSync): string[] {
  let names: string[];
  try { names = fs.readdirSync(snapshotDir).filter((n) => n.startsWith("anime-resync-") && n.endsWith(".json")); } catch { return []; }
  const linked = new Set<string>();
  for (const s of loadSeries()) for (const season of s.seasons) for (const e of season.episodes) {
    for (const p of [e.file?.path, e.file?.diskPath]) if (p) linked.add(p);
  }
  const keys = new Set<string>();
  for (const name of names) {
    let before: LibrarySeries | null = null;
    try { before = JSON.parse(fs.readFileSync(path.join(snapshotDir, name), "utf8")).series ?? null; } catch { continue; }
    for (const season of before?.seasons ?? []) for (const e of season.episodes) {
      const p = physical(e.file);
      if (p && e.plexRatingKey && !linked.has(p) && !(e.file?.path && linked.has(e.file.path)) && !exists(p)) keys.add(e.plexRatingKey);
    }
  }
  return [...keys];
}

/** Once, at start-up (see instrumentation.ts). `plexKnown`: asked by the caller when Plex is set up and reachable. */
export function restoreLostResyncFilesOnce(plexKnown: ReadonlySet<string> = new Set()): LostFilesRestore[] | null {
  if (fs.existsSync(FLAG)) return null;
  const results = restoreLostResyncFiles(SNAPSHOT_DIR, fs.existsSync, plexKnown);
  try { fs.mkdirSync(CONFIG_DIR, { recursive: true }); fs.writeFileSync(FLAG, JSON.stringify({ results, at: Date.now() })); } catch { /* retried next start */ }
  console.log(`[restoreLostResyncFiles] ${results.length} série(s) réparée(s) : ${results.map((r) => `${r.title} (${r.filesBefore} → ${r.filesAfter})`).join(", ")}`);
  return results;
}
