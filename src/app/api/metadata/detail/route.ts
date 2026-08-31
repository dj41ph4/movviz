import { NextRequest, NextResponse } from "next/server";
import { getDetail } from "@/lib/metadata/tmdb";
import { requireUser } from "@/lib/auth/guard";
import { loadDashboardLayout } from "@/lib/dashboard/store";

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
  return NextResponse.json(detail);
}
