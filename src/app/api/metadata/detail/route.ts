import { NextRequest, NextResponse } from "next/server";
import { getDetail } from "@/lib/metadata/tmdb";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") === "series" ? "series" : "movie";
  const tmdbId = Number(searchParams.get("tmdbId"));
  if (!tmdbId) return NextResponse.json({ error: "tmdbId required" }, { status: 400 });
  const detail = await getDetail(type, tmdbId);
  if (!detail) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(detail);
}
