import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { resyncAnimeSeasonsFromTvdb } from "@/lib/library/autoGrabSeries";
import { getSeries } from "@/lib/library/store";
import { BLEACH_TMDB_ID } from "@/lib/metadata/bleachEpisodeOrder";
import { parseBleachSeriesPart } from "@/lib/library/bleachScope";
import { refreshBleachMetadata } from "@/lib/library/bleachRepairService";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/**
 * Rebuilds an already-in-library series' season/episode structure from TVDB
 * when TVDB breaks it into more (and more accurate) seasons than TMDb did —
 * see resyncAnimeSeasonsFromTvdb for the remapping rules.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const part = parseBleachSeriesPart(body.seriesPart);
  const series = getSeries(id);
  if (body.seriesPart != null && (!part || series?.tmdbId !== BLEACH_TMDB_ID)) return NextResponse.json({ error: "invalid_series_part" }, { status: 400 });
  const result = series?.tmdbId === BLEACH_TMDB_ID ? await refreshBleachMetadata(id, part) : await resyncAnimeSeasonsFromTvdb(id);
  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result);
}
