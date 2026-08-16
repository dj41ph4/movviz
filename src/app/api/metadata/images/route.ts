import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getTitleImages } from "@/lib/metadata/tmdb";

export const dynamic = "force-dynamic";

/** Alternate backdrops/logos for a title, from TMDb — feeds the artwork picker on the title page. */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const tmdbId = Number(req.nextUrl.searchParams.get("tmdbId"));
  const type = req.nextUrl.searchParams.get("type");
  const locale = req.nextUrl.searchParams.get("locale") ?? undefined;

  if (!Number.isInteger(tmdbId) || tmdbId <= 0) return NextResponse.json({ error: "invalid_tmdbId" }, { status: 400 });
  if (type !== "movie" && type !== "series") return NextResponse.json({ error: "invalid_type" }, { status: 400 });

  const images = await getTitleImages(tmdbId, type, locale);
  return NextResponse.json(images);
}
