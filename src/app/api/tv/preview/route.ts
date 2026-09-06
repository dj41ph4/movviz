import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadDashboardLayout } from "@/lib/dashboard/store";
import { getDetail } from "@/lib/metadata/tmdb";
import { resolveTrailerSources } from "@/lib/trailers/resolver";

export const dynamic = "force-dynamic";

/**
 * Une fiche compacte demandée uniquement après un focus TV stable. Elle
 * partage strictement les candidats trailer du desktop mais évite deux
 * allers-retours (detail + resolve) et ne révèle aucun jeton de lecture.
 */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const tmdbId = Number(searchParams.get("tmdbId"));
  if ((type !== "movie" && type !== "series") || !Number.isFinite(tmdbId) || tmdbId <= 0) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  const { youtubeTrailerSearch } = loadDashboardLayout(user.id);
  const detail = await getDetail(type, tmdbId, undefined, { youtubeTrailerSearch });
  if (!detail) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const directSources = await resolveTrailerSources(
    type,
    tmdbId,
    detail.title,
    detail.year ?? null,
    detail.imdbId ?? null,
  );

  return NextResponse.json({
    tmdbId,
    type,
    title: detail.title,
    backdropPath: detail.backdropPath,
    year: detail.year ?? null,
    runtime: detail.runtime ?? null,
    genres: detail.genres ?? [],
    overview: detail.overview ?? "",
    ambientVideoKeys: detail.ambientVideoKeys ?? [],
    directSources,
  });
}
