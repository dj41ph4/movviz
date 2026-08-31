import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getTitleImages, pickEditorialArtwork } from "@/lib/metadata/tmdb";
import { cacheTitleArtwork } from "@/lib/metadata/titleArtworkCache";

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
  const artwork = pickEditorialArtwork(images);
  // The hero and the artwork picker share this route. Once either one has
  // seen a title, the editorial-card batch can reuse its chosen backdrop and
  // official title mark without another TMDb call.
  cacheTitleArtwork([{
    type,
    tmdbId,
    ...artwork,
  }], locale);
  return NextResponse.json(images, {
    headers: { "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800" },
  });
}
