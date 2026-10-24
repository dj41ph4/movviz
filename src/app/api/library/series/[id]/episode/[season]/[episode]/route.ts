import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import { requireAdmin } from "@/lib/auth/guard";
import { getSeries, loadSeries, loadMovies, clearEpisodeFile } from "@/lib/library/store";
import { withKeyLock } from "@/lib/library/locks";
import { addToTrash, addTrashEntry, getTrashConfig, loadTrash } from "@/lib/library/trashStore";
import { moveToTrash } from "@/lib/library/trashMove";
import { logActivity } from "@/lib/activity/store";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; season: string; episode: string }> };

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id, season, episode } = await params;
  const seasonNumber = Number(season);
  const episodeNumber = Number(episode);
  if (!Number.isInteger(seasonNumber) || seasonNumber < 0 || !Number.isInteger(episodeNumber) || episodeNumber < 1) {
    return NextResponse.json({ error: "invalid_episode" }, { status: 400 });
  }
  const deleteFiles = req.nextUrl.searchParams.get("deleteFiles") === "true";
  return withKeyLock(`series:${id}`, async () => {
    const series = getSeries(id);
    const ep = series?.seasons.find((s) => s.seasonNumber === seasonNumber)?.episodes.find((e) => e.episodeNumber === episodeNumber);
    if (!series || !ep) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (loadTrash().some((item) => item.type === "episode" && item.tmdbId === series.tmdbId && item.seasonNumber === seasonNumber && item.episodeNumber === episodeNumber)) {
      return NextResponse.json({ error: "already_removed" }, { status: 409 });
    }
    if (ep.activeInfoHash || ep.status === "downloading" || ep.status === "searching") {
      return NextResponse.json({ error: "episode_busy" }, { status: 409 });
    }
    const filePath = ep.file?.diskPath ?? ep.file?.path;
    if (deleteFiles && !filePath) return NextResponse.json({ error: "no_file" }, { status: 409 });
    if (deleteFiles && ep.file) {
      const paths = new Set([ep.file.path, ep.file.diskPath].filter((p): p is string => !!p));
      const shared = loadSeries().some((candidate) => candidate.seasons.some((s) => s.episodes.some((other) => {
        if (candidate.id === id && s.seasonNumber === seasonNumber && other.episodeNumber === episodeNumber) return false;
        return !!other.file && [other.file.path, other.file.diskPath].some((p) => p && paths.has(p));
      }))) || loadMovies().some((movie) => [movie.file, ...(movie.versions ?? [])].some((file) => file && [file.path, file.diskPath].some((p) => p && paths.has(p))));
      if (shared) return NextResponse.json({ error: "shared_file" }, { status: 409 });
    }

    let trashedPath: string | null = null;
    if (deleteFiles && filePath) {
      try {
        const trashPath = getTrashConfig().seriesPath;
        if (trashPath) trashedPath = await moveToTrash(filePath, trashPath);
        else await fs.unlink(filePath);
      } catch (error) {
        return NextResponse.json({ error: "file_removal_failed", detail: (error as Error).message }, { status: 500 });
      }
    }
    addToTrash({
      id: `episode_${series.tmdbId}_${seasonNumber}_${episodeNumber}`,
      tmdbId: series.tmdbId, type: "episode", title: `${series.title} — S${seasonNumber}E${episodeNumber}`,
      posterPath: series.posterPath, backdropPath: series.backdropPath, year: series.year,
      rating: series.rating, overview: series.overview, snapshot: ep,
      seriesTmdbId: series.tmdbId, seasonNumber, episodeNumber, origin: "manual", deletedAt: Date.now(),
    });
    clearEpisodeFile(id, seasonNumber, episodeNumber);
    if (trashedPath) addTrashEntry({ id: `episode:${id}:${seasonNumber}:${episodeNumber}:${Date.now()}`, kind: "series", title: `${series.title} — S${seasonNumber}E${episodeNumber}`, trashPath: trashedPath, deletedAt: Date.now() });
    logActivity("removed", admin.username, `${series.title} — S${seasonNumber}E${episodeNumber}`, null);
    return NextResponse.json({ removed: true, filesDeleted: deleteFiles });
  });
}
