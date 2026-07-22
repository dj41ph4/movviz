import { NextRequest, NextResponse } from "next/server";
import { getEngineToken } from "@/lib/engine/token";
import { decodeLibraryRef, encodeLibraryRef } from "@/lib/library/types";
import { getMovie, updateMovie, getSeries, updateSeries } from "@/lib/library/store";
import { emitNotification } from "@/lib/notifications/store";
import { refreshPlexLibraryFor } from "@/lib/plex/librarySync";
import { logActivity } from "@/lib/activity/store";
import { logActivityV2, createMediaRef, createReleaseRef, createImportRef } from "@/lib/activity/v2/store";

export const dynamic = "force-dynamic";

interface MovedFile {
  path: string;
  quality: string | null;
  resolution: string | null;
  videoCodec: string | null;
  audioCodec: string | null;
  hdr: string | null;
  source: string | null;
  size: number;
  season?: number | null;
  episode?: number | null;
  /** Set when one file covers a combined range of episodes (e.g. S04E01E02) — see src/lib/naming/parser.ts. */
  episodeEnd?: number | null;
}

/** True when `episodeNumber` is the file's episode, or falls inside its combined-episode range. */
function movedFileCoversEpisode(f: MovedFile, episodeNumber: number): boolean {
  if (f.episode == null) return false;
  if (f.episode === episodeNumber) return true;
  return f.episodeEnd != null && episodeNumber > f.episode && episodeNumber <= f.episodeEnd;
}

interface EpisodeLike {
  status: string;
  activeInfoHash: string | null;
}

/**
 * A multi-episode-target grab (season/series pack, or an episode grab that
 * fell back to one) can leave some of its targeted episodes without a
 * matching file — a filename that doesn't parse cleanly, an odd episode
 * numbering scheme, etc. Since the torrent this callback fires for is fully
 * imported, nothing more is ever coming for that episode from this grab: if
 * we leave it as "downloading" it stays stuck forever, because its
 * activeInfoHash now points at a completed/imported torrent that
 * reconcileDownloadingItems will never consider "gone". Release it back to
 * "missing" here instead so the next search tries again.
 */
function releaseIfOrphaned<T extends EpisodeLike>(ep: T, infoHash: string | undefined): T {
  if (infoHash && ep.status === "downloading" && ep.activeInfoHash === infoHash) {
    return { ...ep, status: "missing", activeInfoHash: null };
  }
  return ep;
}

/**
 * Called by the download engine once a monitored title's files have been
 * renamed and moved into the library folder. This is the step that actually
 * makes a completed grab show up as "available" instead of vanishing into an
 * anonymous folder on disk.
 */
export async function POST(req: NextRequest) {
  if (req.headers.get("x-movviz-token") !== getEngineToken()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const ref = decodeLibraryRef(String(body.libraryRef ?? ""));
  const files: MovedFile[] = Array.isArray(body.files) ? body.files : [];
  const infoHash: string | undefined = typeof body.infoHash === "string" ? body.infoHash : undefined;
  if (!ref || files.length === 0) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  if (ref.kind === "movie") {
    const movie = getMovie(ref.movieId);
    if (!movie) return NextResponse.json({ error: "movie not found" }, { status: 404 });
    const best = [...files].sort((a, b) => b.size - a.size)[0];
    updateMovie(movie.id, {
      status: "available",
      activeInfoHash: null,
      file: {
        path: best.path,
        quality: best.quality ?? "—",
        resolution: best.resolution,
        videoCodec: best.videoCodec,
        audioCodec: best.audioCodec,
        hdr: best.hdr,
        source: best.source,
        size: best.size,
        addedAt: Date.now(),
      },
    });
    emitNotification("import_movie_available", `${movie.title} est maintenant disponible`, "/library", { title: movie.title });
    logActivity("imported", "system", movie.title, "/library", {
      libraryRef: `movie:${movie.id}`,
      quality: best.quality ?? undefined,
    });
    logActivityV2({
      kind: "imported",
      media: createMediaRef("movie", movie.id, movie.tmdbId, movie.title),
      actor: "system",
      release: best.quality ? createReleaseRef("", "Importé", "torrent", best.size, best.quality, 0) : undefined,
      import: createImportRef(best.path, best.size, movie.title, best.quality ?? "—"),
    });
    void refreshPlexLibraryFor("movie").catch(() => {});
    return NextResponse.json({ ok: true, updated: "movie", id: movie.id });
  }

  const series = getSeries(ref.seriesId);
  if (!series) return NextResponse.json({ error: "series not found" }, { status: 404 });

  if (ref.kind === "season") {
    // A file's own parsed season must agree with the season this grab was
    // FOR — without this check, a season pack that turns out to actually
    // contain a different season's episodes (mislabeled release, or a
    // release matched under the wrong season somewhere upstream) would still
    // get filed into ref.season just because the episode numbers happen to
    // line up (e.g. every season starts at episode 1). A season-less file
    // (f.season == null, e.g. a bare "01.mkv" the engine couldn't season-tag)
    // is still accepted — that's a real gap in the filename, not a mismatch.
    const seasonFiles = files.filter((f) => f.season == null || f.season === ref.season);
    const seasons = series.seasons.map((season) => {
      if (season.seasonNumber !== ref.season) return season;
      const episodes = season.episodes.map((ep) => {
        const match = seasonFiles.find((f) => movedFileCoversEpisode(f, ep.episodeNumber));
        if (!match) return releaseIfOrphaned(ep, infoHash);
        return {
          ...ep,
          status: "available" as const,
          activeInfoHash: null,
            file: {
              path: match.path,
              quality: match.quality ?? "—",
              resolution: match.resolution,
              videoCodec: match.videoCodec,
              audioCodec: match.audioCodec,
              hdr: match.hdr,
              source: match.source,
              size: match.size,
              addedAt: Date.now(),
            },
        };
      });
      return { ...season, episodes };
    });
    updateSeries(series.id, { seasons });
    emitNotification("import_season_available", `${series.title} — saison ${ref.season} est maintenant disponible`, `/title/series/${series.tmdbId}`, { title: series.title, season: ref.season });
    logActivity("imported", "system", `${series.title} — saison ${ref.season}`, `/title/series/${series.tmdbId}`, {
      libraryRef: encodeLibraryRef({ kind: "season", seriesId: series.id, season: ref.season }),
      quality: files[0]?.quality ?? undefined,
    });
    logActivityV2({
      kind: "imported",
      media: createMediaRef("series", series.id, series.tmdbId, `${series.title} — Saison ${ref.season}`, ref.season),
      actor: "system",
      release: files[0]?.quality ? createReleaseRef("", "Importé", "torrent", files[0].size, files[0].quality, 0) : undefined,
    });
    void refreshPlexLibraryFor("tv").catch(() => {});
    return NextResponse.json({ ok: true, updated: "season", id: series.id });
  }

  if (ref.kind === "series") {
    // Complete-series pack — dispatch each file to its correct episode
    // across multiple seasons. Files without season/episode metadata are
    // skipped (they don't belong to any tracked episode).
    const seasons = series.seasons.map((season) => {
      const seasonFiles = files.filter((f) => f.season === season.seasonNumber);
      if (seasonFiles.length === 0) return season;
      const episodes = season.episodes.map((ep) => {
        const match = seasonFiles.find((f) => movedFileCoversEpisode(f, ep.episodeNumber));
        if (!match) return releaseIfOrphaned(ep, infoHash);
        return {
          ...ep,
          status: "available" as const,
          activeInfoHash: null,
            file: {
              path: match.path,
              quality: match.quality ?? "—",
              resolution: match.resolution,
              videoCodec: match.videoCodec,
              audioCodec: match.audioCodec,
              hdr: match.hdr,
              source: match.source,
              size: match.size,
              addedAt: Date.now(),
            },
        };
      });
      return { ...season, episodes };
    });
    updateSeries(series.id, { seasons });
    const importedCount = files.filter((f) => f.season != null && f.episode != null).length;
    emitNotification("import_series_available", `${series.title} — ${importedCount} épisode(s) importés`, `/title/series/${series.tmdbId}`, { title: series.title });
    logActivity("imported", "system", `${series.title} — intégrale (${importedCount} ép.)`, `/title/series/${series.tmdbId}`, {
      libraryRef: encodeLibraryRef({ kind: "series", seriesId: series.id }),
      quality: files[0]?.quality ?? undefined,
    });
    logActivityV2({
      kind: "imported",
      media: createMediaRef("series", series.id, series.tmdbId, `${series.title} — Intégrale`),
      actor: "system",
      release: files[0]?.quality ? createReleaseRef("", "Importé", "torrent", files[0].size, files[0].quality, 0) : undefined,
    });
    void refreshPlexLibraryFor("tv").catch(() => {});
    return NextResponse.json({ ok: true, updated: "series", id: series.id, imported: importedCount });
  }

  // ref.kind === "episode" — two very different situations land here:
  //
  // 1. A plain single-episode grab: exactly one file, always meant for
  //    ref.episode regardless of what its own filename happens to parse to
  //    (a mislabeled/off-by-one release is still THE release the user or
  //    auto-search picked for this episode — there's no other candidate
  //    episode it could rightfully belong to). Assign it directly and leave
  //    every other episode alone; matching it against the whole season by
  //    parsed episode number risks silently overwriting a same-numbered
  //    but otherwise unrelated episode elsewhere in the library.
  //
  // 2. A season-pack grab targeting several missing episodes at once
  //    (searchAndGrabEpisode's season-pack fallback, or tryGrabSeasonPack's
  //    episodeTargets) that only carries ONE episode in libraryRef, but the
  //    engine moved files for every targeted episode in the same batch —
  //    match each file to its own episode by parsed number, or every
  //    episode past the first would stay stuck "downloading" forever
  //    despite already having a file.
  const singleFile = files.length === 1 ? files[0] : null;
  // Same season-consistency guard as the "season" branch above — a file's
  // own parsed season must agree with ref.season before it can be matched by
  // episode number alone.
  const seasonFiles = files.filter((f) => f.season == null || f.season === ref.season);
  const seasons = series.seasons.map((season) => {
    if (season.seasonNumber !== ref.season) return season;
    const episodes = season.episodes.map((ep) => {
      if (singleFile) {
        if (ep.episodeNumber !== ref.episode) return releaseIfOrphaned(ep, infoHash);
        return {
          ...ep,
          status: "available" as const,
          activeInfoHash: null,
          file: {
            path: singleFile.path,
            quality: singleFile.quality ?? "—",
            resolution: singleFile.resolution,
            videoCodec: singleFile.videoCodec,
            audioCodec: singleFile.audioCodec,
            hdr: singleFile.hdr,
            source: singleFile.source,
            size: singleFile.size,
            addedAt: Date.now(),
          },
        };
      }
      const match = seasonFiles.find((f) => movedFileCoversEpisode(f, ep.episodeNumber));
      if (!match) return releaseIfOrphaned(ep, infoHash);
      return {
        ...ep,
        status: "available" as const,
        activeInfoHash: null,
        file: {
          path: match.path,
          quality: match.quality ?? "—",
          resolution: match.resolution,
          videoCodec: match.videoCodec,
          audioCodec: match.audioCodec,
          hdr: match.hdr,
          source: match.source,
          size: match.size,
          addedAt: Date.now(),
        },
      };
    });
    return { ...season, episodes };
  });

  updateSeries(series.id, { seasons });
  emitNotification("import_episode_available", `${series.title} — ${ref.season}x${String(ref.episode).padStart(2, "0")} est maintenant disponible`, `/title/series/${series.tmdbId}`, { title: series.title, code: `${ref.season}x${String(ref.episode).padStart(2, "0")}` });
  logActivity("imported", "system", `${series.title} — ${ref.season}x${String(ref.episode).padStart(2, "0")}`, `/title/series/${series.tmdbId}`, {
    libraryRef: encodeLibraryRef({ kind: "episode", seriesId: series.id, season: ref.season, episode: ref.episode }),
    quality: files[0]?.quality ?? undefined,
  });
  logActivityV2({
    kind: "imported",
    media: createMediaRef("series", series.id, series.tmdbId, series.title, ref.season, ref.episode),
    actor: "system",
    release: files[0]?.quality ? createReleaseRef("", "Importé", "torrent", files[0].size, files[0].quality, 0) : undefined,
  });
  void refreshPlexLibraryFor("tv").catch(() => {});
  return NextResponse.json({ ok: true, updated: "episode", id: series.id });
}
