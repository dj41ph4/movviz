import { NextRequest, NextResponse } from "next/server";
import { searchMulti, searchTv, tmdbConfigured } from "@/lib/metadata/tmdb";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!tmdbConfigured()) {
    return NextResponse.json({ configured: false, results: [], page: 1, totalPages: 0 });
  }
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (!q) return NextResponse.json({ configured: true, results: [], page: 1, totalPages: 0 });
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page") ?? "1") || 1);
  const type = req.nextUrl.searchParams.get("type");

  let paged;
  if (type === "series") {
    paged = await searchTv(q, page);
  } else if (type === "movie") {
    paged = await searchMulti(q, page);
    paged.results = paged.results.filter((r) => r.type === "movie");
  } else {
    paged = await searchMulti(q, page);
  }
  return NextResponse.json({ configured: true, ...paged });
}
