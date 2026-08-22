import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { restoreFromTrash } from "@/lib/library/trashStore";
import { addMovie, addSeries } from "@/lib/library/store";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = requireAdmin(req);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const [type, rawTmdb] = id.split("_");
  const tmdbId = Number(rawTmdb);
  if (!tmdbId || !type || !["movie", "series"].includes(type)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const item = restoreFromTrash(tmdbId, type as "movie" | "series");
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (type === "movie") {
    const snapshot = item.snapshot && "file" in item.snapshot ? item.snapshot : null;
    addMovie(snapshot ?? {
      id: `mv_${Date.now()}_${tmdbId}`,
      tmdbId: item.tmdbId,
      imdbId: null,
      title: item.title,
      year: item.year,
      releaseDate: null,
      vfReleaseDate: null,
      overview: item.overview,
      posterPath: item.posterPath,
      backdropPath: item.backdropPath,
      rating: item.rating,
      runtime: null,
      genres: [],
      monitored: true,
      qualityProfileId: "default",
      status: "missing",
      file: null,
      activeInfoHash: null,
      addedAt: Date.now(),
      tags: [],
      plexRatingKey: null,
      plexMediaInfo: null,
    });
  } else {
    const snapshot = item.snapshot && "seasons" in item.snapshot ? item.snapshot : null;
    addSeries(snapshot ?? {
      id: `sr_${Date.now()}_${tmdbId}`,
      tmdbId: item.tmdbId,
      imdbId: null,
      title: item.title,
      year: item.year,
      releaseDate: null,
      overview: item.overview,
      posterPath: item.posterPath,
      backdropPath: item.backdropPath,
      rating: item.rating,
      genres: [],
      tvStatus: "ended",
      monitored: true,
      qualityProfileId: "default",
      seasons: [],
      addedAt: Date.now(),
      tags: [],
      plexRatingKey: null,
    });
  }
  return NextResponse.json({ ok: true });
}
