import fs from "node:fs";
import path from "node:path";
import { loadSeries, updateSeriesList } from "./store";
import type { LibrarySeason, LibrarySeries } from "./types";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const SNAPSHOT_DIR = path.join(CONFIG_DIR, "repair-snapshots");
const FLAG = path.join(CONFIG_DIR, "restore-resync-specials-2026-11-15.done");

/**
 * v1.28.147's resync, with specials switched off, dropped every season 0 it
 * met (episodes and any file linked there). Each resync wrote a snapshot of
 * the series BEFORE touching it: the oldest one per series is the original
 * state, and its season 0 is put back exactly as it was when the series has
 * none now. An episode whose file is meanwhile linked elsewhere in the
 * series comes back without that link, never twice.
 */
export function restoreResyncSpecials(snapshotDir = SNAPSHOT_DIR): { series: number; episodes: number } {
  let names: string[];
  try { names = fs.readdirSync(snapshotDir).filter((n) => n.startsWith("anime-resync-") && n.endsWith(".json")); } catch { return { series: 0, episodes: 0 }; }
  const oldest = new Map<string, { at: number; file: string }>();
  for (const name of names) {
    const m = name.match(/^anime-resync-(.+)-(\d+)\.json$/);
    if (!m) continue;
    const at = Number(m[2]);
    const prev = oldest.get(m[1]);
    if (!prev || at < prev.at) oldest.set(m[1], { at, file: name });
  }
  const current = new Map(loadSeries().map((s) => [s.id, s]));
  const patches = new Map<string, Partial<LibrarySeries>>();
  let episodes = 0;
  for (const [id, { file }] of oldest) {
    const series = current.get(id);
    if (!series || series.seasons.some((s) => s.seasonNumber === 0)) continue;
    let before: LibrarySeries | null = null;
    try { before = JSON.parse(fs.readFileSync(path.join(snapshotDir, file), "utf8")).series ?? null; } catch { continue; }
    const specials = before?.seasons?.find((s) => s.seasonNumber === 0);
    if (!specials || specials.episodes.length === 0) continue;
    const linked = new Set(series.seasons.flatMap((s) => s.episodes.flatMap((e) => [e.file?.path, e.file?.diskPath].filter(Boolean))));
    const restored: LibrarySeason = {
      ...specials,
      episodes: specials.episodes.map((e) => {
        const taken = [e.file?.path, e.file?.diskPath].some((p) => p && linked.has(p));
        return taken ? { ...e, file: null, status: e.status === "available" ? "missing" : e.status, plexRatingKey: null } : e;
      }),
    };
    patches.set(id, { seasons: [restored, ...series.seasons] });
    episodes += restored.episodes.length;
  }
  if (patches.size > 0) updateSeriesList(patches);
  return { series: patches.size, episodes };
}

/** Once, at start-up (see instrumentation.ts). */
export function restoreResyncSpecialsOnce(): { series: number; episodes: number } | null {
  if (fs.existsSync(FLAG)) return null;
  const result = restoreResyncSpecials();
  try { fs.mkdirSync(CONFIG_DIR, { recursive: true }); fs.writeFileSync(FLAG, JSON.stringify({ ...result, at: Date.now() })); } catch { /* retried next start */ }
  console.log(`[restoreResyncSpecials] ${result.series} série(s), ${result.episodes} épisode(s) spéciaux remis en place`);
  return result;
}
