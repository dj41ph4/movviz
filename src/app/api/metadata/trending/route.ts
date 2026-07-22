import { NextRequest, NextResponse } from "next/server";
import { trending, tmdbConfigured } from "@/lib/metadata/tmdb";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!tmdbConfigured()) {
    return NextResponse.json({ configured: false, results: [], page: 1, totalPages: 0 });
  }
  const type = req.nextUrl.searchParams.get("type") === "series" ? "series" : "movie";
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? "1") || 1);
  const paged = await trending(type, page);
  return NextResponse.json({ configured: true, ...paged });
}
