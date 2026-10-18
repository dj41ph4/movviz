import { NextRequest, NextResponse } from "next/server";
import { getDetail, getBleachSequelPresentation } from "@/lib/metadata/tmdb";
import { requireUser } from "@/lib/auth/guard";
import { loadDashboardLayout } from "@/lib/dashboard/store";
import { recordUserContextEvent } from "@/lib/userContext/ingest";
import { getSeriesByTmdbId } from "@/lib/library/store";
import { BLEACH_TMDB_ID, needsBleachRepair } from "@/lib/metadata/bleachEpisodeOrder";
import { ensureBleachRepaired } from "@/lib/library/bleachRepairService";
import { parseBleachPart, projectBleachDetail } from "@/lib/metadata/bleachPresentation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") === "series" ? "series" : "movie";
  const tmdbId = Number(searchParams.get("tmdbId"));
  if (!tmdbId) return NextResponse.json({ error: "tmdbId required" }, { status: 400 });
  const lang = searchParams.get("lang") ?? undefined;
  const { youtubeTrailerSearch } = loadDashboardLayout(user.id);
  const library = type === "series" && tmdbId === BLEACH_TMDB_ID ? getSeriesByTmdbId(tmdbId) : null;
  if (library) await ensureBleachRepaired(library.id);
  const currentLibrary = library ? getSeriesByTmdbId(tmdbId) : null;
  let detail = await getDetail(type, tmdbId, lang, {
    youtubeTrailerSearch,
    ...(currentLibrary && needsBleachRepair(currentLibrary) ? { bleachOrder: "tmdb" as const } : {}),
  });
  if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
  const part = parseBleachPart(searchParams.get("seriesPart"));
  if (type === "series" && tmdbId === BLEACH_TMDB_ID && part) {
    detail = projectBleachDetail(detail, part);
    if (part === "tybw") {
      const sequel = await getBleachSequelPresentation(lang);
      if (sequel) detail = { ...detail, ...sequel, posterPath: sequel.posterPath ?? detail.posterPath };
    }
  }
  // Every fiche open hits this route — hour-bucketed sourceEventId so
  // re-fetches (SWR revalidate, tab refocus) collapse into one row instead
  // of one per request. This is the one signal that previously had ZERO
  // capture anywhere: interested-but-never-watched/added/rated titles.
  const hourBucket = Math.floor(Date.now() / 3_600_000);
  recordUserContextEvent({
    userId: user.id,
    eventType: "title_viewed",
    source: "metadata_detail",
    sourceEventId: `view:${user.id}:${type}:${tmdbId}:${hourBucket}`,
    tmdbId,
    mediaType: type,
    title: detail.title,
    occurredAt: Date.now(),
  });
  return NextResponse.json(detail);
}
