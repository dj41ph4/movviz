import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { restoreFromTrash } from "@/lib/library/trashStore";
import { addMovie, addSeries, restoreEpisodeMonitoring, loadSeries } from "@/lib/library/store";
import type { LibraryEpisode } from "@/lib/library/types";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = requireAdmin(req);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const parts = id.split("_");
  const [type, rawTmdb] = parts;
  const tmdbId = Number(rawTmdb);
  if (!tmdbId || !type || !["movie", "series", "episode"].includes(type)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  if (type === "episode") {
    const seasonNumber = Number(parts[2]);
    const episodeNumber = Number(parts[3]);
    if (!seasonNumber || !episodeNumber) return NextResponse.json({ error: "invalid id" }, { status: 400 });
    const item = restoreFromTrash(tmdbId, "episode", { season: seasonNumber, episode: episodeNumber });
    if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
    // The episode was never removed from its series (see clearEpisodeFile) —
    // restoring only means putting its original `monitored` value back so it
    // re-enters normal RSS/retry eligibility as a plain "missing" episode.
    const series = loadSeries().find((s) => s.tmdbId === item.seriesTmdbId);
    const snapshot = item.snapshot as LibraryEpisode | undefined;
    if (series) restoreEpisodeMonitoring(series.id, item.seasonNumber!, item.episodeNumber!, snapshot?.monitored ?? true);
    return NextResponse.json({ ok: true });
  }

  const item = restoreFromTrash(tmdbId, type as "movie" | "series");
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (type === "movie") {
    // "runtime" is unique to LibraryMovie among the three snapshot shapes —
    // "file" alone would also match a LibraryEpisode snapshot now.
    const snapshot = item.snapshot && "runtime" in item.snapshot ? item.snapshot : null;
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
      plexRatingKey: null,
    });
  }
  return NextResponse.json({ ok: true });
}
