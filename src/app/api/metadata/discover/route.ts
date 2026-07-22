import { NextRequest, NextResponse } from "next/server";
import { discoverByFilters } from "@/lib/metadata/tmdb";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") === "series" ? "series" : "movie";
  const page = Math.max(1, Number(searchParams.get("page") ?? "1") || 1);
  const paged = await discoverByFilters(
    type,
    {
      genre: searchParams.get("genre") ?? undefined,
      year: searchParams.get("year") ?? undefined,
      sort: searchParams.get("sort") ?? undefined,
      company: searchParams.get("company") ?? undefined,
      network: searchParams.get("network") ?? undefined,
    },
    page
  );
  return NextResponse.json(paged);
}
