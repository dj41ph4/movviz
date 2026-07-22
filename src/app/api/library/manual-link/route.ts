import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { decodeLibraryRef } from "@/lib/library/types";
import { getMovie, updateMovie, getSeries, updateSeries } from "@/lib/library/store";
import { emitNotification } from "@/lib/notifications/store";
import { refreshPlexLibraryFor } from "@/lib/plex/librarySync";
import { getActivityEntryV2, updateActivityEntryV2, createMediaRef } from "@/lib/activity/v2/store";
import { parseRelease } from "@/lib/naming/parser";

export const dynamic = "force-dynamic";

/**
 * Retroactively links an already-completed, never-matched download to a
 * library movie or episode — the manual counterpart to the engine's own
 * /api/library/import (which only fires when a torrent was grabbed WITH a
 * libraryRef to begin with). The file was already renamed and moved onto
 * disk by the engine when it completed; this only points a library item at
 * that existing path, exactly like a normal import does otherwise.
 */
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const entryId = String(body.entryId ?? "");
  const ref = decodeLibraryRef(String(body.libraryRef ?? ""));
  if (!entryId || !ref) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  const entry = getActivityEntryV2(entryId);
  if (!entry || entry.kind !== "imported" || !entry.import) {
    return NextResponse.json({ error: "not_linkable" }, { status: 404 });
  }

  const parsed = parseRelease(entry.import.fileName);
  const file = {
    path: entry.import.destinationPath,
    quality: entry.import.qualityDetected || "—",
    resolution: parsed.resolution,
    videoCodec: parsed.videoCodec,
    audioCodec: parsed.audioCodec,
    hdr: parsed.hdr,
    source: parsed.source,
    size: entry.import.fileSize,
    addedAt: Date.now(),
  };

  if (ref.kind === "movie") {
    const movie = getMovie(ref.movieId);
    if (!movie) return NextResponse.json({ error: "movie_not_found" }, { status: 404 });
    updateMovie(movie.id, { status: "available", activeInfoHash: null, file });
    updateActivityEntryV2(entryId, { media: createMediaRef("movie", movie.id, movie.tmdbId, movie.title) });
    emitNotification("import_movie_available", `${movie.title} est maintenant disponible`, "/library", { title: movie.title });
    void refreshPlexLibraryFor("movie").catch(() => {});
    return NextResponse.json({ ok: true, updated: "movie", id: movie.id });
  }

  const series = getSeries(ref.seriesId);
  if (!series) return NextResponse.json({ error: "series_not_found" }, { status: 404 });

  // Season/series scope: only one file is actually being linked here (an
  // orphaned single-file download), so figure out which episode within that
  // scope it actually is from its own filename — same idea as the engine's
  // multi-file pack matching (movedFileCoversEpisode in
  // /api/library/import), just applied to a single already-placed file.
  const targetSeason = ref.kind === "episode" ? ref.season : parsed.season;
  const targetEpisode = ref.kind === "episode" ? ref.episode : parsed.episode;
  if (targetSeason == null || targetEpisode == null) {
    return NextResponse.json({ error: "cannot_determine_episode" }, { status: 422 });
  }
  if (ref.kind === "season" && targetSeason !== ref.season) {
    return NextResponse.json({ error: "season_mismatch" }, { status: 422 });
  }

  let matched = false;
  const seasons = series.seasons.map((season) => {
    if (season.seasonNumber !== targetSeason) return season;
    return {
      ...season,
      episodes: season.episodes.map((ep) => {
        if (ep.episodeNumber !== targetEpisode) return ep;
        matched = true;
        return { ...ep, status: "available" as const, activeInfoHash: null, file };
      }),
    };
  });
  if (!matched) return NextResponse.json({ error: "no_matching_episode" }, { status: 422 });

  updateSeries(series.id, { seasons });
  updateActivityEntryV2(entryId, {
    media: createMediaRef("series", series.id, series.tmdbId, series.title, targetSeason, targetEpisode),
  });
  emitNotification(
    "import_episode_available",
    `${series.title} — ${targetSeason}x${String(targetEpisode).padStart(2, "0")} est maintenant disponible`,
    `/title/series/${series.tmdbId}`,
    { title: series.title, code: `${targetSeason}x${String(targetEpisode).padStart(2, "0")}` }
  );
  void refreshPlexLibraryFor("tv").catch(() => {});
  return NextResponse.json({ ok: true, updated: "episode", id: series.id });
}
