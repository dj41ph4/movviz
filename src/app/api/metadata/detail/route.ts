import { NextRequest, NextResponse } from "next/server";
import { getDetail } from "@/lib/metadata/tmdb";
import { requireUser } from "@/lib/auth/guard";
import { loadDashboardLayout } from "@/lib/dashboard/store";
import { recordUserContextEvent } from "@/lib/userContext/ingest";

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
  const detail = await getDetail(type, tmdbId, lang, { youtubeTrailerSearch });
  if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
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
