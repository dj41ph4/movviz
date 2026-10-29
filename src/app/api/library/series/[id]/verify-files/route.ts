import { NextRequest, NextResponse } from "next/server";
import { existsSync } from "node:fs";
import { requireAdmin } from "@/lib/auth/guard";
import { getSeries, clearEpisodeFile } from "@/lib/library/store";
import { withKeyLock } from "@/lib/library/locks";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/**
 * Checks every episode file of the series on disk and drops the library
 * record of those that no longer exist (deleted by hand outside Movviz).
 * Never touches the filesystem itself.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  return withKeyLock(`series:${id}`, async () => {
    const series = getSeries(id);
    if (!series) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const missing: Array<{ season: number; episode: number }> = [];
    for (const season of series.seasons) {
      for (const ep of season.episodes) {
        if (!ep.file || ep.activeInfoHash) continue;
        const paths = [ep.file.diskPath, ep.file.path].filter((p): p is string => !!p);
        if (paths.some((p) => existsSync(p))) continue;
        missing.push({ season: season.seasonNumber, episode: ep.episodeNumber });
      }
    }
    for (const m of missing) clearEpisodeFile(id, m.season, m.episode);
    return NextResponse.json({ checked: true, removed: missing.length });
  });
}
