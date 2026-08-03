import { NextRequest, NextResponse } from "next/server";
import { ENGINE_BASE, engineHeaders } from "@/lib/engine/server";
import { buildGrabPayload } from "@/lib/indexers/grabPayload";
import { decodeLibraryRef } from "@/lib/library/types";
import { getMovie, updateMovie, getSeries, updateSeries } from "@/lib/library/store";
import { logActivityV2, createReleaseRef, createDownloadRef } from "@/lib/activity/v2/store";
import { requireUser } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/**
 * Apply "downloading" to the episodes claimed by a grab in ONE pass and ONE
 * updateSeries call. The pre-review version called setEpisodeStatus() per
 * episode, each rebuilding the whole seasons array from the same stale
 * snapshot — with the async-coalesced writes only the LAST episode kept
 * "downloading" and every other claimed episode silently reverted to
 * "missing" (wanted re-grabs, import misattribution). See setEpisodesStatus
 * in autoGrabSeries.ts for the same lesson.
 */
function applyDownloadingStatus(libraryRefStr: string, infoHash: string, replacingInfoHash?: string | null) {
  const ref = decodeLibraryRef(libraryRefStr);
  if (!ref) return;
  const eligible = (ep: { status: string; activeInfoHash: string | null }) =>
    ep.status === "missing" || (!!replacingInfoHash && ep.activeInfoHash === replacingInfoHash);
  if (ref.kind === "movie") {
    if (getMovie(ref.movieId)) updateMovie(ref.movieId, { status: "downloading", activeInfoHash: infoHash });
    return;
  }
  const series = getSeries(ref.seriesId);
  if (!series) return;

  const seasonNumbers = ref.kind === "series"
    ? series.seasons.map((s) => s.seasonNumber)
    : ref.kind === "season"
      ? [ref.season]
      : [ref.season];

  const seasons = series.seasons.map((s) => {
    if (!seasonNumbers.includes(s.seasonNumber)) return s;
    const episodes = s.episodes.map((e) => {
      if (ref.kind === "episode" && e.episodeNumber !== ref.episode) return e;
      if (e.monitored && eligible(e)) {
        return { ...e, status: "downloading" as const, activeInfoHash: infoHash };
      }
      return e;
    });
    return { ...s, episodes };
  });
  updateSeries(series.id, { seasons });
}

/**
 * Grab a release from Search: hand it to the download engine. A .torrent/nzb
 * URL is fetched server-side (with the indexer's credentials, when it's
 * protected by a login) and forwarded as base64 so the engine never has to
 * reach out to the indexer itself. When called with a libraryRef (manual
 * pick from a library card instead of the free-text Search page), the grab
 * is tied back to that movie/season/episode exactly like an automatic grab.
 */
export async function POST(req: NextRequest) {
  if (!requireUser(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const libraryRef = typeof body.libraryRef === "string" ? body.libraryRef : null;
  const decodedRef = libraryRef ? decodeLibraryRef(libraryRef) : null;

  // The libraryRef (when present) is the source of truth for what this grab
  // actually is — it's what determines the download's destination folder, so
  // it must win over a client-supplied category rather than being defaulted.
  const category = decodedRef ? (decodedRef.kind === "movie" ? "movie" : "series") : body.category;
  if (category !== "movie" && category !== "series") {
    return NextResponse.json({ error: "invalid_category" }, { status: 400 });
  }

  const resolved = await buildGrabPayload({
    magnetUrl: body.magnetUrl,
    downloadUrl: body.downloadUrl,
    indexerId: body.indexerId,
  });
  if ("error" in resolved) {
    return NextResponse.json({ error: "download_failed", detail: resolved.error }, { status: 502 });
  }

  try {
    const res = await fetch(`${ENGINE_BASE}/torrents`, {
      method: "POST",
      headers: engineHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({
        ...resolved,
        category,
        libraryRef,
        title: body.title ?? null,
        year: body.year ?? null,
      }),
    });
    const data = await res.json();
    const replacingInfoHash = typeof body.replacingInfoHash === "string" ? body.replacingInfoHash : null;
    if (res.ok && libraryRef && data.infoHash) applyDownloadingStatus(libraryRef, data.infoHash, replacingInfoHash);

    // Log the grab event when the engine accepted the torrent
    if (res.ok && data.infoHash) {
      const relQual = body.quality || "Inconnue";
      const relSize = body.size ?? 0;
      const relScore = body.score ?? 0;
      const relProtocol = body.protocol ?? "torrent";
      const relSeeders = body.seeders ?? 0;
      const relLeechers = body.leechers ?? 0;
      const indexerName = body.indexerName ?? body.indexerId ?? "Inconnu";
      // Resolve the real tmdbId for the href — the previous version left the
      // id segment out entirely (`/title/movie/?year=...`), a dead link for
      // every manually-grabbed release logged through this route.
      const refMedia = decodedRef
        ? decodedRef.kind === "movie"
          ? getMovie(decodedRef.movieId)
          : getSeries(decodedRef.seriesId)
        : null;

      // Complete-series pack (kind series): report how many episodes/seasons
      // the torrent covers, so Activité labels it "Intégrale — X épisodes".
      let packEpisodeCount: number | undefined;
      let seasonCount: number | undefined;
      if (decodedRef?.kind === "series" && refMedia && "seasons" in refMedia) {
        const monitoredSeasons = refMedia.seasons.filter((s) => s.monitored);
        packEpisodeCount = monitoredSeasons.reduce((sum, s) => sum + s.episodes.filter((e) => e.monitored).length, 0);
        seasonCount = monitoredSeasons.filter((s) => s.episodes.some((e) => e.monitored)).length;
      }

      logActivityV2({
        kind: "grabbed",
        media: {
          id: decodedRef
            ? (decodedRef.kind === "movie" ? decodedRef.movieId : decodedRef.seriesId)
            : data.infoHash,
          title: body.title ?? body.indexerName ?? "Inconnu",
          type: category,
          season: decodedRef?.kind === "series" ? 0 : undefined,
          packEpisodeCount,
          seasonCount,
          href: refMedia ? `/title/${category}/${refMedia.tmdbId}` : "#",
        },
        actor: "system",
        release: createReleaseRef(indexerName, data.name ?? "Release", relProtocol, relSize, relQual, relScore, relSeeders, relLeechers),
        download: createDownloadRef("Movviz", data.infoHash, 0, 0, 0, 0, 0, relSeeders, "downloading"),
        metadata: { libraryRef: libraryRef ?? undefined, year: body.year ?? undefined },
      });
    }

    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ error: "engine_unreachable" }, { status: 503 });
  }
}
