import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { compressedJson } from "@/lib/http/compressedJson";
import { tmdbConfigured } from "@/lib/metadata/tmdb";
import { getAnnouncedMovies } from "@/lib/metadata/announcedMovies";

export const dynamic = "force-dynamic";

/** « Prochainement » — every film announced for the next 12 months, with
 *  poster and synopsis, in release order. Shared by every client's home. */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!tmdbConfigured()) return NextResponse.json({ results: [] });
  return compressedJson(req, { results: await getAnnouncedMovies() });
}
