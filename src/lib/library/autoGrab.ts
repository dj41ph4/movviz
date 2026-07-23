import { getMovie, getMovieByTmdbId, addMovie, updateMovie, loadMovies } from "@/lib/library/store";
import { DEFAULT_QUALITY_PROFILES, defaultQualityProfile } from "@/lib/library/qualityProfiles";
import { encodeLibraryRef, type LibraryMovie } from "@/lib/library/types";
import { searchFromCache } from "@/lib/indexers/rssCache";
import { MOVIE_CATEGORY_IDS } from "@/lib/indexers/categories";
import { parseRelease } from "@/lib/naming/parser";
import { releaseTitleMatches, yearIsCompatible } from "@/lib/library/matching";
import { withinSizeLimit } from "@/lib/library/releaseRules";
import type { IndexerRelease } from "@/lib/indexers/types";
import { buildGrabPayload } from "@/lib/indexers/grabPayload";
import { ENGINE_BASE, engineHeaders, ENGINE_TIMEOUT_MS } from "@/lib/engine/server";
import { getMovie as fetchTmdbMovie } from "@/lib/metadata/tmdb";
import { emitNotification } from "@/lib/notifications/store";
import { logActivity } from "@/lib/activity/store";
import { logActivityV2, createMediaRef, createFailureRef } from "@/lib/activity/v2/store";
import { isQualityUpgradesEnabled } from "@/lib/settings/qualityUpgrades";
import { isRecentlyFailedRelease } from "@/lib/library/failedReleases";
import { notifySeerrStatus } from "@/lib/seerr/mediaMap";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import { searchMovie, searchIndexer } from "@/lib/indexers/torznab";
import { loadIndexers } from "@/lib/indexers/store";
import { withoutRateLimited, countNewlyRateLimited } from "@/lib/indexers/rateLimit";

const RESOLUTION_ORDER = ["480p", "720p", "1080p", "2160p"];
const rank = (res: string | null) => (res ? RESOLUTION_ORDER.indexOf(res) : -1);

/**
 * Create (or reuse) the library entry for a movie and kick off the automatic
 * search + grab. Shared by: an admin/auto-approved user adding a title
 * directly, and an admin approving someone else's pending request.
 */
export async function addMovieToLibrary(tmdbId: number, qualityProfileId?: string, options?: { skipSearch?: boolean }) {
  const existing = getMovieByTmdbId(tmdbId);
  if (existing) return { movie: existing, searchResult: null };

  const meta = await fetchTmdbMovie(tmdbId);
  if (!meta) return { error: "movie not found on TMDb" as const };

  const movie: LibraryMovie = {
    id: `mv_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    tmdbId: meta.tmdbId,
    imdbId: meta.imdbId,
    title: meta.title,
    year: meta.year,
    releaseDate: meta.releaseDate,
    vfReleaseDate: meta.vfReleaseDate,
    overview: meta.overview,
    posterPath: meta.posterPath,
    backdropPath: meta.backdropPath,
    rating: meta.rating,
    runtime: meta.runtime,
    genres: meta.genres,
    monitored: true,
    qualityProfileId: qualityProfileId ?? defaultQualityProfile().id,
    status: "missing",
    file: null,
    activeInfoHash: null,
    addedAt: Date.now(),
    tags: [],
    plexRatingKey: null,
    plexMediaInfo: null,
    tmdbCollectionId: meta.collectionId,
  };
  addMovie(movie);

  // Skipped when this add is the side effect of linking an already-picked
  // release (see TitleTargetPicker's addAndPick) — searching would grab a
  // SECOND, different file for the same movie right alongside the one the
  // user just chose themselves. A plain "add to library" (Discover, request
  // approval, Plex watchlist sync, …) never sets this, so it keeps
  // auto-searching exactly as before.
  const searchResult = options?.skipSearch ? null : await searchAndGrabMovie(movie.id);
  return { movie, searchResult };
}

/**
 * The core automation loop: search every configured indexer for a monitored
 * movie, keep only releases the quality profile accepts, grab the best one,
 * and tag the download with a libraryRef so the engine's completion callback
 * can mark this exact movie as available once it's renamed and moved.
 *
 * Shared by the manual "search now" action and by auto-search on add.
 */
export async function searchAndGrabMovie(movieId: string) {
  const movie = getMovie(movieId);
  if (!movie) return { error: "movie not found" as const };

  const profile =
    DEFAULT_QUALITY_PROFILES.find((p) => p.id === movie.qualityProfileId) ??
    DEFAULT_QUALITY_PROFILES[0];

  const media = createMediaRef("movie", movie.id, movie.tmdbId, movie.title);

  updateMovie(movie.id, { status: "searching" });

  const tCache = performance.now();
  const releases = searchFromCache(MOVIE_CATEGORY_IDS);
  const cacheMs = Math.round(performance.now() - tCache);
  recordSearchLog("debug", "search_movie.cache_read", `${movie.title} (${movie.year}) — cache RSS donne ${releases.length} release(s) (${cacheMs}ms)`, cacheMs);

  const tScore = performance.now();
  const candidates = releases
    .map((r) => ({ release: r, parsed: parseRelease(r.title) }))
    .filter(({ parsed }) => releaseTitleMatches(parsed.title, movie.title))
    .filter(({ parsed }) => yearIsCompatible(parsed.year, movie.year))
    .filter(({ parsed }) => !parsed.resolution || profile.allowedResolutions.includes(parsed.resolution))
    .filter(({ release }) => release.score >= profile.minScore)
    .filter(({ release }) => withinSizeLimit(release.size, "movie"))
    .filter(({ release }) => !isRecentlyFailedRelease(release.infoHash))
    .sort((a, b) => b.release.score - a.release.score);
  const scoreMs = Math.round(performance.now() - tScore);
  recordSearchLog("debug", "search_movie.scoring", `${movie.title} — ${candidates.length} candidat(s) sur ${releases.length} brut(s) (${scoreMs}ms)`, scoreMs);

  // Cache n'a rien donné — fallback vers une recherche directe (titre+année) sur les indexeurs.
  // Le cache RSS ne contient que les ~100 dernières sorties ; un film plus ancien n'y apparaît
  // jamais. La recherche directe interroge TOUT le catalogue avec le bon mode (t=movie + tmdbid
  // si supporté, t=search sinon), au prix d'un appel HTTP par indexeur — c'est ce qui se passait
  // avant le passage au cache-only en v1.1.14, mais limité aux seuls cas où le cache échoue.
  let finalCandidates = candidates;
  if (candidates.length === 0) {
    const configuredIndexers = loadIndexers().filter((i) => i.enabled && i.protocol === "torrent");
    const indexers = withoutRateLimited(configuredIndexers);
    const alreadyLimited = configuredIndexers.length - indexers.length;
    if (indexers.length > 0) {
      const tDirect = performance.now();
      recordSearchLog(
        "info",
        "search_movie.fallback_direct",
        `${movie.title} — cache vide, recherche directe sur ${indexers.length} indexeur(s)` +
          (alreadyLimited > 0 ? ` (${alreadyLimited} exclu(s), déjà rate-limité(s))` : "")
      );
      // Sequential: un indexeur à la fois pour éviter les 429 en parallèle.
      const directReleases: IndexerRelease[] = [];
      for (const ix of indexers) {
        const results = await searchMovie(ix, { title: movie.title, year: movie.year, imdbId: movie.imdbId, tmdbId: movie.tmdbId }, MOVIE_CATEGORY_IDS).catch(() => [] as IndexerRelease[]);
        directReleases.push(...results);
      }
      const directMs = Math.round(performance.now() - tDirect);
      const newlyLimited = countNewlyRateLimited(indexers);
      recordSearchLog("info", "search_movie.fallback_result", `${movie.title} — recherche directe: ${directReleases.length} release(s) (${directMs}ms)`, directMs);

      const candidates2 = directReleases
        .map((r) => ({ release: r, parsed: parseRelease(r.title) }))
        .filter(({ parsed }) => releaseTitleMatches(parsed.title, movie.title))
        .filter(({ parsed }) => yearIsCompatible(parsed.year, movie.year))
        .filter(({ parsed }) => !parsed.resolution || profile.allowedResolutions.includes(parsed.resolution))
        .filter(({ release }) => release.score >= profile.minScore)
        .filter(({ release }) => withinSizeLimit(release.size, "movie"))
        .filter(({ release }) => !isRecentlyFailedRelease(release.infoHash))
        .sort((a, b) => b.release.score - a.release.score);

      if (candidates2.length > 0) {
        finalCandidates = candidates2;
        recordSearchLog("info", "search_movie.fallback_match", `${movie.title} — ${candidates2.length} candidat(s) via recherche directe`);
      } else if (newlyLimited > 0) {
        recordSearchLog("warn", "search_movie.fallback_rate_limited", `${movie.title} — 0 résultat : ${newlyLimited} indexeur(s) ont répondu 429 (rate-limité) pendant cette recherche, pas forcément "rien trouvé"`);
      } else {
        recordSearchLog("warn", "search_movie.fallback_empty", `${movie.title} — recherche directe: ${directReleases.length} brut(s), 0 candidat après filtrage (taux d'échec: titre=${movie.title}, année=${movie.year})`);
      }
    } else {
      recordSearchLog("warn", "search_movie.no_indexers_available", `${movie.title} — aucun indexeur disponible : tous rate-limités (${alreadyLimited}/${configuredIndexers.length})`);
    }
  }

  if (finalCandidates.length === 0) {
    updateMovie(movie.id, { status: "missing" });
    logActivity("failed", "system", movie.title, "/library", { libraryRef: `movie:${movie.id}`, error: "Aucune release ne correspond au profil de qualité" });
    logActivityV2({
      kind: "failed",
      media,
      actor: "system",
      failure: createFailureRef(
        "no_release_found",
        candidates.length === 0
          ? "Aucun résultat trouvé sur les indexeurs pour ce film."
          : `${candidates.length} résultat(s) trouvé(s) sur les indexeurs, mais aucun ne correspond au titre, à l'année, à la résolution autorisée ou au score minimum du profil de qualité.`
      ),
    });
    return { error: "no_match" as const, detail: "No release matched the title/year or met the quality profile", queried: 0 };
  }

  const best = finalCandidates[0].release;
  const payload = await buildGrabPayload({
    magnetUrl: best.magnetUrl,
    downloadUrl: best.downloadUrl,
    indexerId: best.indexerId,
  });
  if ("error" in payload) {
    updateMovie(movie.id, { status: "missing" });
    recordSearchLog("error", "search_movie.grab_payload_failed", `${movie.title} — ${best.title}: ${payload.error}`);
    logActivity("failed", "system", movie.title, "/library", { libraryRef: `movie:${movie.id}`, releaseTitle: best.title, indexer: best.indexerId, error: payload.error });
    logActivityV2({ kind: "failed", media, actor: "system", failure: createFailureRef("download_failed", `Impossible de récupérer le lien de téléchargement (${best.title}) : ${payload.error}`) });
    return { error: "grab_failed" as const, detail: payload.error };
  }

  try {
    const res = await fetch(`${ENGINE_BASE}/torrents`, {
      method: "POST",
      headers: engineHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({
        ...payload,
        category: "movie",
        libraryRef: encodeLibraryRef({ kind: "movie", movieId: movie.id }),
        title: movie.title,
        year: movie.year,
      }),
      signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS),
    });
    const torrent = await res.json();
    if (!res.ok) {
      updateMovie(movie.id, { status: "missing" });
      recordSearchLog("error", "search_movie.engine_rejected", `${movie.title} — "${best.title}" refusé par le moteur (${JSON.stringify(torrent)})`);
      logActivity("failed", "system", movie.title, "/library", { libraryRef: `movie:${movie.id}`, releaseTitle: best.title, indexer: best.indexerId, error: "Le moteur a refusé le téléchargement" });
      logActivityV2({ kind: "failed", media, actor: "system", failure: createFailureRef("download_failed", `Le moteur de téléchargement a refusé la release "${best.title}".`) });
      return { error: "engine_rejected" as const, detail: torrent };
    }
    updateMovie(movie.id, { status: "downloading", activeInfoHash: torrent.infoHash });
    void notifySeerrStatus("movie", movie.tmdbId, "processing").catch(() => {});
    recordSearchLog("info", "search_movie.grabbed", `${movie.title} — ${best.title} (score:${best.score}, indexeur:${best.indexerId}, infoHash:${torrent.infoHash})`);
    logActivity("grabbed", "system", movie.title, "/library", { libraryRef: `movie:${movie.id}`, releaseTitle: best.title, indexer: best.indexerId, infoHash: torrent.infoHash });
    emitNotification("grab_movie", `${movie.title} — release récupérée, import en cours`, "/library", { title: movie.title });
    return { ok: true as const, release: best, torrent };
  } catch {
    updateMovie(movie.id, { status: "missing" });
    recordSearchLog("error", "search_movie.engine_unreachable", `${movie.title} — moteur de téléchargement injoignable`);
    logActivity("failed", "system", movie.title, "/library", { libraryRef: `movie:${movie.id}`, error: "Moteur de téléchargement inaccessible" });
    logActivityV2({ kind: "failed", media, actor: "system", failure: createFailureRef("timeout", "Le moteur de téléchargement est injoignable.") });
    return { error: "engine_unreachable" as const };
  }
}

/**
 * Look for a better release for every available movie whose current file is
 * still below its quality profile's cutoff. Real re-search, not a placeholder
 * — reuses the same scoring and grab path as a fresh add.
 */
export async function checkQualityUpgrades() {
  if (!isQualityUpgradesEnabled()) return;
  const upgraded: string[] = [];
  for (const movie of loadMovies()) {
    if (movie.status !== "available" || !movie.file || !movie.monitored) continue;
    const profile =
      DEFAULT_QUALITY_PROFILES.find((p) => p.id === movie.qualityProfileId) ?? DEFAULT_QUALITY_PROFILES[0];
    if (rank(movie.file.resolution) >= rank(profile.cutoffResolution)) continue;

    const releases = searchFromCache(MOVIE_CATEGORY_IDS);

    const better = releases
      .map((r) => ({ release: r, parsed: parseRelease(r.title) }))
      .filter(({ parsed }) => releaseTitleMatches(parsed.title, movie.title))
      .filter(({ parsed }) => yearIsCompatible(parsed.year, movie.year))
      .filter(({ parsed }) => parsed.resolution && profile.allowedResolutions.includes(parsed.resolution))
      .filter(({ parsed }) => rank(parsed.resolution) > rank(movie.file!.resolution))
      .filter(({ release }) => release.score >= profile.minScore)
      .filter(({ release }) => withinSizeLimit(release.size, "movie"))
      .filter(({ release }) => !isRecentlyFailedRelease(release.infoHash))
      .sort((a, b) => rank(b.parsed.resolution) - rank(a.parsed.resolution) || b.release.score - a.release.score);

    if (better.length === 0) {
      if (releases.length === 0) {
        recordSearchLog("debug", "quality_upgrade.no_cache", `${movie.title} — cache RSS vide`);
      }
      continue;
    }

    const best = better[0].release;
    const payload = await buildGrabPayload({ magnetUrl: best.magnetUrl, downloadUrl: best.downloadUrl, indexerId: best.indexerId });
    if ("error" in payload) continue;

    try {
      const res = await fetch(`${ENGINE_BASE}/torrents`, {
        method: "POST",
        headers: engineHeaders({ "content-type": "application/json" }),
        body: JSON.stringify({
          ...payload,
          category: "movie",
          libraryRef: encodeLibraryRef({ kind: "movie", movieId: movie.id }),
          title: movie.title,
          year: movie.year,
        }),
      });
      const torrent = await res.json();
      if (!res.ok) continue;
      updateMovie(movie.id, { status: "downloading", activeInfoHash: torrent.infoHash });
      emitNotification(
        "grab_movie_upgrade",
        `${movie.title} — mise à niveau vers ${best.title.match(/\d{3,4}p/i)?.[0] ?? "meilleure qualité"}`,
        "/library",
        { title: movie.title, quality: best.title.match(/\d{3,4}p/i)?.[0] ?? "?" }
      );
      upgraded.push(movie.id);
    } catch {
      continue;
    }
  }
  return { upgraded };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Retry every monitored movie still "missing" whose VF (France digital/
 * physical) release date has actually arrived — releases routinely land on
 * indexers a few days late, so a single check on release day itself isn't
 * enough. Bounded to a two-week window so this doesn't degrade into an
 * unbounded retry of every old missing movie; the manual Wanted list already
 * covers those. Meant to run a few times a day.
 */
export async function searchReleasedMissingMovies() {
  const now = Date.now();
  const searched: string[] = [];
  for (const movie of loadMovies()) {
    if (!movie.monitored || movie.status !== "missing" || !movie.vfReleaseDate) continue;
    const releasedAt = new Date(movie.vfReleaseDate).getTime();
    if (Number.isNaN(releasedAt) || releasedAt > now || now - releasedAt > 14 * DAY_MS) continue;
    await searchAndGrabMovie(movie.id);
    searched.push(movie.id);
  }
  return { searched };
}

/**
 * Searches every monitored missing movie, regardless of release date.
 * Enforces all quality profile rules: forbidden terms, size limits, codec scoring.
 * Respects indexer caps and only searches enabled indexers.
 * Runs within the caller's own interval — limits the batch to avoid
 * hammering indexers on a huge library.
 */
export async function searchMissingMovies(max = 100) {
  const movies = loadMovies().filter((m) => m.monitored && m.status === "missing");
  const batch = movies.slice(0, max);
  const searched: string[] = [];
  for (const movie of batch) {
    await searchAndGrabMovie(movie.id);
    searched.push(movie.id);
  }
  return { searched, total: movies.length };
}
