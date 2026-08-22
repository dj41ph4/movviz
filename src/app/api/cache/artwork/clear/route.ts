import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { getArtworkWarmState } from "@/lib/metadata/artworkCacheWarm";
import { clearTmdbArtworkCache, type TmdbArtworkCachePart } from "@/lib/metadata/tmdbImageCache";
import { listCachedTitleArtwork } from "@/lib/metadata/titleArtworkCache";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (getArtworkWarmState().running) {
    return NextResponse.json({ error: "artwork_warm_running" }, { status: 409 });
  }

  const body = await req.json().catch(() => ({})) as { part?: unknown };
  const part: TmdbArtworkCachePart = body.part === "logos" || body.part === "backdrops" ? body.part : "all";
  const result = await clearTmdbArtworkCache(part, listCachedTitleArtwork());
  return NextResponse.json({ ok: true, part, ...result });
}
