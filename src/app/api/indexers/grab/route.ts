import { NextRequest, NextResponse } from "next/server";
import { ENGINE_BASE, engineHeaders } from "@/lib/engine/server";
import { buildGrabPayload } from "@/lib/indexers/grabPayload";
import { decodeLibraryRef } from "@/lib/library/types";
import { getMovie, updateMovie, getSeries, updateSeries } from "@/lib/library/store";
import { logActivityV2, createReleaseRef, createDownloadRef } from "@/lib/activity/v2/store";
import { requireUser } from "@/lib/auth/guard";
import { markPendingVersionIntent } from "@/lib/library/pendingVersionIntent";
import { markManualGrab } from "@/lib/library/manualGrab";
import { isBlockedRelease } from "@/lib/library/blockedReleases";

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

  // Grab manuel sur un film DÉJÀ disponible (movie.file) : c'est un
  // REMPLACEMENT — marquer l'intention "replace" sur l'infoHash de la release
  // grabée AVANT le grab, pour que le callback d'import (applyImportedFiles →
  // finalizeReplacePath) supprime l'ancien fichier et renomme le nouveau vers
  // son nom final au lieu de laisser le moteur créer " (2)"/" (3)". Première
  // acquisition (movie.file === null) : aucune intention, rien à remplacer.
  // Les séries/épisodes ne sont jamais concernés.
  const versionInfoHash = typeof body.infoHash === "string" ? body.infoHash : null;
  if (isBlockedRelease(versionInfoHash)) {
    return NextResponse.json({ error: "release_blocked" }, { status: 409 });
  }
  if (versionInfoHash && decodedRef?.kind === "movie") {
    const movie = getMovie(decodedRef.movieId);
    if (movie?.file) markPendingVersionIntent(versionInfoHash, "replace");
  }

  const resolved = await buildGrabPayload({
    magnetUrl: body.magnetUrl,
    downloadUrl: body.downloadUrl,
    indexerId: body.indexerId,
  });
  if ("error" in resolved) {
    return NextResponse.json({ error: "download_failed", detail: resolved.error }, { status: 502 });
  }

  // Mirror autoGrabSeries's episodeTargets: without them the engine has NO
  // file list to match against, so _import pulls in every file of the pack
  // and renames anything it can't episode-tag to an empty "S01E" name —
  // multiple such files then collide on the same destination and silently
  // overwrite each other (confirmed live: a Noblesse season pack collapsed
  // into a single "Noblesse - S01E.mkv", 11 episodes never imported). A
  // manual grab from a library card must behave exactly like an automatic
  // one for the same season/series.
  let episodeTarget: { season: number; episode: number } | undefined;
  let episodeTargets: { season: number; episode: number }[] | undefined;
  if (decodedRef?.kind === "episode") {
    episodeTarget = { season: decodedRef.season, episode: decodedRef.episode };
  } else if (decodedRef?.kind === "season" || decodedRef?.kind === "series") {
    const series = getSeries(decodedRef.seriesId);
    if (series) {
      const targets: { season: number; episode: number }[] = [];
      for (const s of series.seasons) {
        if (decodedRef.kind === "season" && s.seasonNumber !== decodedRef.season) continue;
        if (!s.monitored) continue;
        for (const ep of s.episodes) {
          if (ep.monitored && (ep.status === "missing" || ep.status === "searching")) {
            targets.push({ season: s.seasonNumber, episode: ep.episodeNumber });
          }
        }
      }
      if (targets.length > 0) episodeTargets = targets;
    }
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
        episodeTarget,
        episodeTargets,
      }),
    });
    const data = await res.json();
    const replacingInfoHash = typeof body.replacingInfoHash === "string" ? body.replacingInfoHash : null;
    if (res.ok && libraryRef && data.infoHash) applyDownloadingStatus(libraryRef, data.infoHash, replacingInfoHash);

    // Manual grab = user picked this release with their own eyes; the
    // blocklist ("mots interdits") is an AUTOMATIC-search rule and must not
    // veto it. Mark the engine-resolved infoHash so the import callback
    // skips its post-download blocked-word check for this torrent.
    if (res.ok && typeof data.infoHash === "string") markManualGrab(data.infoHash);

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
