import { NextRequest, NextResponse } from "next/server";
import { getGenres } from "@/lib/metadata/tmdb";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const type = new URL(req.url).searchParams.get("type") === "series" ? "series" : "movie";
  return NextResponse.json({ genres: await getGenres(type) });
}
