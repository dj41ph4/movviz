import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { getSeries } from "@/lib/library/store";
import { getStatusTransitions } from "@/lib/library/statusTransitions";
import { loadTrashManifest, getTrashConfig } from "@/lib/library/trashStore";
import { plexConfigured, loadPlexConfig } from "@/lib/plex/store";
import { getShowEpisodes } from "@/lib/plex/client";
import type { LibrarySeries } from "@/lib/library/types";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const VIDEO = /\.(mkv|mp4|avi|m4v|ts|webm|mov)$/i;

function linkedPaths(series: LibrarySeries): string[] {
  return series.seasons.flatMap((s) => s.episodes.map((e) => e.file?.diskPath ?? e.file?.path).filter((p): p is string => !!p));
}

/** Folder → number of video files, two levels deep (series root and its season folders). */
function diskInventory(root: string): { root: string; readable: boolean; folders: Array<{ name: string; videos: number; sample: string[] }> } {
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(root, { withFileTypes: true }); } catch { return { root, readable: false, folders: [] }; }
  const folders: Array<{ name: string; videos: number; sample: string[] }> = [];
  const top = entries.filter((e) => e.isFile() && VIDEO.test(e.name)).map((e) => e.name);
  if (top.length) folders.push({ name: ".", videos: top.length, sample: top.slice(0, 3) });
  for (const dir of entries.filter((e) => e.isDirectory())) {
    let files: string[] = [];
    try { files = fs.readdirSync(path.join(root, dir.name)).filter((n) => VIDEO.test(n)); } catch { /* unreadable */ }
    folders.push({ name: dir.name, videos: files.length, sample: files.sort().slice(0, 3) });
  }
  return { root, readable: true, folders };
}

/**
 * Read-only investigation of where a series' files went: what is linked
 * now, what each resync snapshot linked before, what sits in the series'
 * folders on disk, the trash, the status changes recorded for its episodes
 * and what Plex holds for it. Writes nothing.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const series = getSeries(id);
  if (!series) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const now = linkedPaths(series);
  const roots = [...new Set(now.map((p) => {
    const dir = path.dirname(p);
    return /^(specials?|s(aison|eason)?[ ._-]?\d{1,2}\b.*)$/i.test(path.basename(dir)) ? path.dirname(dir) : dir;
  }))];

  // Snapshots of this series, oldest first.
  const snapDir = path.join(CONFIG_DIR, "repair-snapshots");
  let snapNames: string[] = [];
  try { snapNames = fs.readdirSync(snapDir).filter((n) => n.includes(id)).sort(); } catch { /* none */ }
  const snapshots = snapNames.map((name) => {
    try {
      const json = JSON.parse(fs.readFileSync(path.join(snapDir, name), "utf8"));
      const s: LibrarySeries | undefined = json.series;
      const paths = s ? linkedPaths(s) : [];
      const exist = paths.filter((p) => fs.existsSync(p)).length;
      for (const p of paths) {
        const dir = path.dirname(p);
        const root = /^(specials?|s(aison|eason)?[ ._-]?\d{1,2}\b.*)$/i.test(path.basename(dir)) ? path.dirname(dir) : dir;
        if (!roots.includes(root)) roots.push(root);
      }
      return {
        name, createdAt: json.createdAt ?? null, order: s?.episodeOrder ?? "tmdb",
        seasons: s?.seasons.length ?? 0, episodes: s?.seasons.reduce((n, x) => n + x.episodes.length, 0) ?? 0,
        linked: paths.length, existOnDisk: exist,
        // Episodes linked vs distinct files behind them: the gap is links sharing one file.
        distinctFiles: new Set(paths).size, distinctOnDisk: new Set(paths.filter((p) => fs.existsSync(p))).size, withPlexKey: s?.seasons.reduce((n, x) => n + x.episodes.filter((e) => e.plexRatingKey).length, 0) ?? 0,
        samplePaths: paths.slice(0, 2).concat(paths.slice(-2)),
        duplicates: (json.plan?.duplicates ?? []).length, extras: (json.plan?.extras ?? []).length, source: json.plan?.source ?? null,
      };
    } catch (err) {
      return { name, error: (err as Error).message };
    }
  });

  // Status changes of this series' episodes.
  const transitions = getStatusTransitions().filter((t) => t.refType === "episode" && t.refId.startsWith(`${id}:`));
  const byDay: Record<string, number> = {};
  for (const t of transitions) {
    const k = `${new Date(t.t).toISOString().slice(0, 13)}h ${t.from}→${t.to}`;
    byDay[k] = (byDay[k] ?? 0) + 1;
  }

  const trashRoot = getTrashConfig().seriesPath;
  const trash = loadTrashManifest().filter((e) => e.id.includes(id) || e.title?.toLowerCase().includes(series.title.toLowerCase())).slice(-20);

  let plex: unknown = { configured: false };
  if (plexConfigured() && series.plexRatingKey) {
    const cfg = loadPlexConfig();
    if (cfg.adminToken) {
      const eps = await getShowEpisodes(cfg, series.plexRatingKey, cfg.adminToken).catch(() => []);
      const paths = eps.map((e) => e.file?.path).filter((p): p is string => !!p);
      plex = {
        showKey: series.plexRatingKey, episodes: eps.length, withFile: paths.length,
        samplePaths: paths.slice(0, 2).concat(paths.slice(-2)),
        readableByMovviz: paths.filter((p) => fs.existsSync(p)).length,
      };
    }
  }

  return NextResponse.json({
    series: { id, title: series.title, monitored: series.monitored, order: series.episodeOrder ?? "tmdb", plexRatingKey: series.plexRatingKey ?? null, linkedNow: now.length, distinctNow: new Set(now).size, sampleNow: now.slice(0, 2) },
    disk: roots.slice(0, 6).map(diskInventory),
    snapshots,
    transitions: { total: transitions.length, byHour: byDay, last: transitions.slice(0, 5) },
    trash: { root: trashRoot, entries: trash, rootListing: trashRoot ? diskInventory(trashRoot).folders.filter((f) => f.name.toLowerCase().includes(series.title.toLowerCase().split(" ")[0])) : [] },
    plex,
  });
}
