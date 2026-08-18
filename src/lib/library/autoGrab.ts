import { getMovie, getMovieByTmdbId, addMovie, updateMovie, loadMovies } from "@/lib/library/store";
import { DEFAULT_QUALITY_PROFILES, defaultQualityProfile } from "@/lib/library/qualityProfiles";
import { encodeLibraryRef, type LibraryMovie } from "@/lib/library/types";
import { searchFromCache } from "@/lib/indexers/rssCache";
import { MOVIE_CATEGORY_IDS } from "@/lib/indexers/categories";
import { getReleaseMatchPool } from "@/lib/workers/releaseMatchPool";
import { withinSizeLimit, loadReleaseRules, compareBySizePreference } from "@/lib/library/releaseRules";
import { isBlockedForAutoGrab } from "@/lib/library/decisionGuard";
import { recordDecision } from "@/lib/library/decisionLog";
import type { IndexerRelease } from "@/lib/indexers/types";
import { buildGrabPayload } from "@/lib/indexers/grabPayload";
import { ENGINE_BASE, engineHeaders, ENGINE_TIMEOUT_MS } from "@/lib/engine/server";
import { getMovie as fetchTmdbMovie } from "@/lib/metadata/tmdb";
import { emitNotification } from "@/lib/notifications/store";
import { logActivity } from "@/lib/activity/store";
import { logActivityV2, createMediaRef, createFailureRef } from "@/lib/activity/v2/store";
import { isQualityUpgradesEnabled } from "@/lib/settings/qualityUpgrades";
import { markPendingVersionIntent } from "@/lib/library/pendingVersionIntent";
import { findUpgradeCandidates, grabUpgradeCandidate } from "@/lib/library/searchAndReplace";
import { findEpisodeUpgradeCandidates, grabEpisodeUpgradeCandidate } from "@/lib/library/searchAndReplaceSeries";
import { isUpgradeIgnored } from "@/lib/library/ignoredUpgrades";
import { isRecentlyFailedRelease } from "@/lib/library/failedReleases";
import { notifySeerrProcessingOnce } from "@/lib/seerr/mediaMap";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import { searchMovie, searchIndexer } from "@/lib/indexers/torznab";
import { normalizeTitle } from "@/lib/library/matching";
import { loadIndexers } from "@/lib/indexers/store";
import { withoutRateLimited, countNewlyRateLimited } from "@/lib/indexers/rateLimit";
import { movieHasReleased } from "@/lib/library/releaseSchedule";
import { withSearchLock } from "@/lib/library/autoGrabSeries";
import { runBackground } from "@/lib/priority/lane";
import { yieldToUser } from "@/lib/priority/userActivity";

const RESOLUTION_ORDER = ["480p", "720p", "1080p", "2160p"];
const rank = (res: string | null) => (res ? RESOLUTION_ORDER.indexOf(res) : -1);

/**
 * Create (or reuse) the library entry for a movie and kick off the automatic
 * search + grab. Shared by: an admin/auto-approved user adding a title
 * directly, and an admin approving someone else's pending request.
 */
export async function addMovieToLibrary(
  tmdbId: number,
  qualityProfileId?: string,
  options?: { skipSearch?: boolean; onAdded?: (movie: LibraryMovie) => void }
) {
  const existing = getMovieByTmdbId(tmdbId);
  if (existing) return { movie: existing, searchResult: null };

  const meta = await fetchTmdbMovie(tmdbId);
  if (!meta) return { error: "movie not found on TMDb" as const };

  // TMDb sometimes lists the same film under two ids — reuse the tracked
  // entry instead of duplicating it. Deliberately NOT using
  // libraryEntriesMatch/titleSimilarity here: those implement fuzzy,
  // containment-based matching for a completely different job (matching a
  // scene release's mangled filename against an official title), and
  // reusing that logic here caused two separate real false-merges,
  // confirmed live:
  //   1. An absent year on either side is "not disqualifying" by that
  //      logic's own design — fine for a release filename that just
  //      doesn't state a year, wrong here: it let an unreleased placeholder
  //      entry with no confirmed year yet ("Untitled Jurassic World Rebirth
  //      Sequel") match and reuse an unrelated, already-owned earlier
  //      installment ("Jurassic World", 2015) that merely shares franchise
  //      wording.
  //   2. Even with a real, close year on both sides, fuzzy containment
  //      still folded "X-Men: Le Commencement" (2011, the actual film)
  //      into "X-Men: Le commencement - 35mm Special" (2012, a 30-minute
  //      promotional documentary/featurette — same franchise wording, a
  //      completely different piece of content).
  // A genuine "same film under two TMDb ids" duplicate has the same title
  // (once accents/punctuation/case are normalized) AND the same release
  // year — not just similar-looking ones. Anything short of that — an
  // extra suffix, a different year — is a distinct entry that deserves its
  // own library record, not a silent merge.
  const metaNames = new Set([meta.title, meta.originalTitle].filter(Boolean).map((t) => normalizeTitle(t!)));
  const existingByTitle =
    meta.year != null
      ? loadMovies().find((m) => {
          if (m.year == null || meta.year !== m.year) return false;
          const mNames = [m.title, m.originalTitle].filter(Boolean).map((t) => normalizeTitle(t!));
          return mNames.some((n) => metaNames.has(n));
        })
      : undefined;
  if (existingByTitle) return { movie: existingByTitle, searchResult: null };

  const released = movieHasReleased(meta.vfReleaseDate, meta.releaseDate);

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
    status: released ? "missing" : "upcoming",
    file: null,
    activeInfoHash: null,
    addedAt: Date.now(),
    tags: [],
    originalTitle: meta.originalTitle,
    plexRatingKey: null,
    plexMediaInfo: null,
    tmdbCollectionId: meta.collectionId,
  };
  addMovie(movie);
  // A request must be persisted as soon as its library entry exists.  The
  // automatic search below is deliberately best-effort: a flaky indexer or
  // matching optimisation can never make the title vanish from Requests.
  options?.onAdded?.(movie);

  // Skipped when this add is the side effect of linking an already-picked
  // release (see TitleTargetPicker's addAndPick) — searching would grab a
  // SECOND, different file for the same movie right alongside the one the
  // user just chose themselves. A plain "add to library" (Discover, request
  // approval, Plex watchlist sync, …) never sets this, so it keeps
  // auto-searching exactly as before.
  // Also skipped for a movie that hasn't released yet — nothing to find on
  // any indexer, and this would just burn an API call for a guaranteed miss.
  // releaseDayTask (scheduler) picks it up automatically once its date passes.
  let searchResult: Awaited<ReturnType<typeof searchAndGrabMovie>> | null = null;
  if (!options?.skipSearch && released) {
    try {
      searchResult = await searchAndGrabMovie(movie.id);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      recordSearchLog("error", "search_movie.add_search_failed", `${movie.title} — ajout conservé, auto-recherche interrompue : ${detail}`);
      searchResult = { error: "search_failed" as const, detail };
    }
  }
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
  // Serialized per movie + try/finally safety net: two concurrent searches of
  // the same movie (bulk "search all missing" + scheduled retry) would each
  // grab the same release, and any exception between the "searching" flip and
  // its restore paths below would leave the movie stuck on "searching"
  // forever (see the finally in the wrapper — the boot-time reconcile is the
  // only other resumer, so this is the difference between a 1-line blip and
  // days of "Recherche…").
  return withSearchLock(`movie:${movieId}`, async () => {
    const movie = getMovie(movieId);
    if (!movie) return { error: "movie not found" as const };
    updateMovie(movie.id, { status: "searching" });
    try {
      return await searchAndGrabMovieInner(movie);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      // This boundary deliberately turns an infrastructure/matcher failure
      // into a normal failed search.  Every caller (including add-to-library)
      // can then keep its request and UI state instead of receiving a 500.
      recordSearchLog("error", "search_movie.unhandled_error", `${movie.title} — recherche interrompue : ${detail}`);
      return { error: "search_failed" as const, detail };
    } finally {
      const fresh = getMovie(movieId);
      if (fresh?.status === "searching") {
        updateMovie(movieId, { status: "missing" });
        recordSearchLog("warn", "search_movie.stale_search_restored", `${fresh.title} — remis à "manquant" (statut "recherche" laissé par une erreur en cours de recherche)`);
      }
    }
  });
}

/**
 * The actual search body of searchAndGrabMovie, extracted so the "searching"
 * flip and its restore are always paired in the wrapper above — see the
 * comment there for why the pairing matters.
 */
async function searchAndGrabMovieInner(movie: LibraryMovie) {
  const profile =
    DEFAULT_QUALITY_PROFILES.find((p) => p.id === movie.qualityProfileId) ??
    DEFAULT_QUALITY_PROFILES[0];

  const media = createMediaRef("movie", movie.id, movie.tmdbId, movie.title);

  // Scene/tracker releases are always named after the ORIGINAL title (e.g.
  // "The Man from Toronto" vs the French "Un homme de Toronto") — searching
  // the localized title alone misses real releases. The original title
  // becomes the primary search target; the localized title stays as an alias.
  const searchTitle = movie.originalTitle && movie.originalTitle !== movie.title ? movie.originalTitle : movie.title;
  const searchAliases = [
    ...(movie.aliases ?? []),
    ...(movie.originalTitle && movie.originalTitle !== movie.title ? [movie.originalTitle] : []),
  ];

  const rules = loadReleaseRules();
  const tCache = performance.now();
  const releases = searchFromCache(MOVIE_CATEGORY_IDS);
  const cacheMs = Math.round(performance.now() - tCache);
  recordSearchLog("debug", "search_movie.cache_read", `${movie.title} (${movie.year}) — cache RSS donne ${releases.length} release(s) (${cacheMs}ms)`, cacheMs);

  const tScore = performance.now();
  // Parse + title/year matching (the CPU-heavy regex pass over every cached
  // release) runs in a real worker thread — see releaseMatchWorker.mjs.
  const matched = await getReleaseMatchPool().run({
    releases: releases.map((r) => ({ title: r.title })),
    targetTitle: searchTitle,
    aliases: searchAliases,
    targetYear: movie.year,
  });
  const candidates = matched.survivors
    .map(({ idx, parsed }) => ({ release: releases[idx], parsed }))
    // Decision Guard: a blocked term is a hard veto here — no score, however
    // high, can rescue a release an admin explicitly forbade.
    .filter(({ release }) => !isBlockedForAutoGrab(release.title, rules, movie.title).blocked)
    .filter(({ parsed }) => !parsed.resolution || profile.allowedResolutions.includes(parsed.resolution))
    .filter(({ release }) => release.score >= profile.minScore)
    .filter(({ release }) => withinSizeLimit(release.size, "movie"))
    .filter(({ release }) => !isRecentlyFailedRelease(release.infoHash))
    .sort((a, b) => compareBySizePreference(rules.sizePreference, { ...a.release, videoCodec: a.parsed.videoCodec }, { ...b.release, videoCodec: b.parsed.videoCodec }));
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
        const results = await searchMovie(ix, { title: searchTitle, year: movie.year, imdbId: movie.imdbId, tmdbId: movie.tmdbId }, MOVIE_CATEGORY_IDS).catch(() => [] as IndexerRelease[]);
        directReleases.push(...results);
      }
      const directMs = Math.round(performance.now() - tDirect);
      const newlyLimited = countNewlyRateLimited(indexers);
      recordSearchLog("info", "search_movie.fallback_result", `${movie.title} — recherche directe: ${directReleases.length} release(s) (${directMs}ms)`, directMs);

      const matched2 = await getReleaseMatchPool().run({
        releases: directReleases.map((r) => ({ title: r.title })),
        targetTitle: searchTitle,
        aliases: searchAliases,
        targetYear: movie.year,
      });
      const candidates2 = matched2.survivors
        .map(({ idx, parsed }) => ({ release: directReleases[idx], parsed }))
        .filter(({ release }) => !isBlockedForAutoGrab(release.title, rules, movie.title).blocked)
        .filter(({ parsed }) => !parsed.resolution || profile.allowedResolutions.includes(parsed.resolution))
        .filter(({ release }) => release.score >= profile.minScore)
        .filter(({ release }) => withinSizeLimit(release.size, "movie"))
        .filter(({ release }) => !isRecentlyFailedRelease(release.infoHash))
        .sort((a, b) => compareBySizePreference(rules.sizePreference, { ...a.release, videoCodec: a.parsed.videoCodec }, { ...b.release, videoCodec: b.parsed.videoCodec }));

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

  // A candidate's download link can fail on its own (indexer-side quota,
  // dead link, transient error) without the release itself being at fault —
  // previously a single failed grab-payload fetch gave up on the movie
  // entirely even when other, lower-scored candidates (often on a different
  // indexer) were sitting right there. Now step down the sorted list and
  // only give up once every attempted candidate has failed.
  const MAX_GRAB_ATTEMPTS = 5;
  let best: IndexerRelease | null = null;
  let payload: Awaited<ReturnType<typeof buildGrabPayload>> | null = null;
  let lastGrabError: string | null = null;
  for (const candidate of finalCandidates.slice(0, MAX_GRAB_ATTEMPTS)) {
    const attempt = await buildGrabPayload({
      magnetUrl: candidate.release.magnetUrl,
      downloadUrl: candidate.release.downloadUrl,
      indexerId: candidate.release.indexerId,
    });
    if (!("error" in attempt)) {
      best = candidate.release;
      payload = attempt;
      break;
    }
    lastGrabError = attempt.error;
    recordSearchLog("warn", "search_movie.grab_payload_retry", `${movie.title} — "${candidate.release.title}" a échoué (${attempt.error}), tentative du candidat suivant`);
  }

  if (!best || !payload) {
    updateMovie(movie.id, { status: "missing" });
    recordSearchLog("error", "search_movie.grab_payload_failed", `${movie.title} — tous les candidats essayés ont échoué (dernière erreur: ${lastGrabError})`);
    logActivity("failed", "system", movie.title, "/library", { libraryRef: `movie:${movie.id}`, error: lastGrabError ?? "unknown" });
    logActivityV2({ kind: "failed", media, actor: "system", failure: createFailureRef("download_failed", `Impossible de récupérer le lien de téléchargement pour tous les candidats essayés : ${lastGrabError}`) });
    return { error: "grab_failed" as const, detail: lastGrabError ?? "unknown" };
  }

  recordDecision({
    refTitle: movie.title,
    releaseTitle: best.title,
    decision: "accepted",
    intent: "first_acquisition",
    reasons: best.scoreBreakdown?.length
      ? best.scoreBreakdown.map((b) => ({ type: "score", message: `${b.label} (${b.delta >= 0 ? "+" : ""}${b.delta})` }))
      : [{ type: "profile_match", message: "Correspond au profil de qualité" }],
  });

  // Film DÉJÀ disponible (movie.file) : cette nouvelle acquisition est un
  // REMPLACEMENT de l'ancien fichier. Marquer l'intention "replace" sur
  // l'infoHash de la release grabée AVANT le grab, pour que le callback
  // d'import (applyImportedFiles → finalizeReplacePath) supprime l'ancien
  // fichier et renomme le nouveau vers son nom final — sans quoi le moteur
  // renomme en " (2)"/" (3)" (avoidCollision) et le doublon reste. Première
  // acquisition (movie.file === null) : aucune intention, rien à remplacer.
  if (movie.file && best.infoHash) markPendingVersionIntent(best.infoHash, "replace");

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
      const detail = JSON.stringify(torrent);
      const hint = detail.includes("unauthorized") ? " — TOKEN MOTEUR INVALIDE : le moteur et le web doivent partager le même token (engine-token.json)" : "";
      recordSearchLog("error", "search_movie.engine_rejected", `${movie.title} — "${best.title}" refusé par le moteur (${detail})${hint}`);
      logActivity("failed", "system", movie.title, "/library", { libraryRef: `movie:${movie.id}`, releaseTitle: best.title, indexer: best.indexerId, error: "Le moteur a refusé le téléchargement" });
      logActivityV2({ kind: "failed", media, actor: "system", failure: createFailureRef("download_failed", `Le moteur de téléchargement a refusé la release "${best.title}".`) });
      return { error: "engine_rejected" as const, detail: torrent };
    }
    updateMovie(movie.id, { status: "downloading", activeInfoHash: torrent.infoHash });
    void notifySeerrProcessingOnce("movie", movie.tmdbId).catch(() => {});
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
  // Voie arrière-plan (quotas indexeurs réduits) + cession à l'utilisateur
  // actif à chaque item — tâche planifiée, jamais prioritaire sur un clic.
  return runBackground(() => checkQualityUpgradesInner());
}

async function checkQualityUpgradesInner() {
  const upgraded: string[] = [];
  for (const movie of loadMovies()) {
    await yieldToUser("upgrades qualité");
    if (movie.status !== "available" || !movie.file || !movie.monitored) continue;
    const profile =
      DEFAULT_QUALITY_PROFILES.find((p) => p.id === movie.qualityProfileId) ?? DEFAULT_QUALITY_PROFILES[0];
    if (rank(movie.file.resolution) >= rank(profile.cutoffResolution)) continue;

    const releases = searchFromCache(MOVIE_CATEGORY_IDS);
    const rules = loadReleaseRules();

    const matchedUpgrade = await getReleaseMatchPool().run({
      releases: releases.map((r) => ({ title: r.title })),
      targetTitle: movie.title,
      aliases: movie.aliases ?? [],
      targetYear: movie.year,
    });
    const better = matchedUpgrade.survivors
      .map(({ idx, parsed }) => ({ release: releases[idx], parsed }))
      .filter(({ release }) => !isBlockedForAutoGrab(release.title, rules, movie.title).blocked)
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

    // Same "try the next candidate before giving up" logic as searchAndGrabMovie.
    let best: IndexerRelease | null = null;
    let payload: Awaited<ReturnType<typeof buildGrabPayload>> | null = null;
    for (const candidate of better.slice(0, 5)) {
      const attempt = await buildGrabPayload({ magnetUrl: candidate.release.magnetUrl, downloadUrl: candidate.release.downloadUrl, indexerId: candidate.release.indexerId });
      if (!("error" in attempt)) {
        best = candidate.release;
        payload = attempt;
        break;
      }
      recordSearchLog("warn", "quality_upgrade.grab_payload_retry", `${movie.title} — "${candidate.release.title}" a échoué (${attempt.error}), tentative du candidat suivant`);
    }
    if (!best || !payload) continue;

    recordDecision({
      refTitle: movie.title,
      releaseTitle: best.title,
      decision: "accepted",
      intent: "quality_upgrade",
      reasons: best.scoreBreakdown?.length
        ? best.scoreBreakdown.map((b) => ({ type: "score", message: `${b.label} (${b.delta >= 0 ? "+" : ""}${b.delta})` }))
        : [{ type: "quality_upgrade", message: "Meilleure résolution disponible" }],
    });

    // Upgrade qualité : le film est forcément disponible ici (filtre
    // movie.file ci-dessus) — marquer l'intention "replace" sur l'infoHash
    // grabé AVANT le grab (même mécanique que searchAndGrabMovie).
    if (movie.file && best.infoHash) markPendingVersionIntent(best.infoHash, "replace");

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


/**
 * Auto-upgrade all eligible movies and episodes — run by the scheduler
 * every 6 hours when autoUpgradeEnabled is true in releaseRules.
 */
export async function autoUpgradeAll(): Promise<{ movies: number; episodes: number }> {
  const rules = loadReleaseRules();
  if (!rules.autoUpgradeEnabled) return { movies: 0, episodes: 0 };
  // Voie arrière-plan + cession à l'utilisateur : tâche planifiée 6h, jamais
  // prioritaire sur une interaction utilisateur.
  return runBackground(() => autoUpgradeAllInner());
}

async function autoUpgradeAllInner(): Promise<{ movies: number; episodes: number }> {
  const candidates = await findUpgradeCandidates();
  let movieCount = 0;
  for (const c of candidates) {
    await yieldToUser("auto-upgrade films");
    if (c.movieId && isUpgradeIgnored(c.movieId)) continue;
    await grabUpgradeCandidate(c.movieId!);
    movieCount++;
  }

  const epCandidates = await findEpisodeUpgradeCandidates();
  let epCount = 0;
  for (const c of epCandidates) {
    await yieldToUser("auto-upgrade épisodes");
    const result = await grabEpisodeUpgradeCandidate(c.seriesId, c.seasonNumber, c.episodeNumber);
    if (result.ok) epCount++;
  }

  return { movies: movieCount, episodes: epCount };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Bidirectional status reconciliation against the release date:
 *  - "upcoming" → "missing" once the date has actually passed, making it
 *    eligible for the normal search pipeline (searchAllMissing, the 6h retry
 *    task, RSS matching) for the first time.
 *  - "missing" → "upcoming" for anything whose date is still in the future —
 *    this catches every movie added before the "upcoming" status existed
 *    (or added via a path that doesn't check the date, e.g. addMediaSilent),
 *    so the backlog of already-"missing"-but-not-actually-released movies
 *    stops being searched needlessly too, not just newly-added ones.
 * Meant to run right before searchReleasedMissingMovies in the same
 * scheduled pass, so a movie that just released gets both its status flip
 * and its first real search attempt in the same tick.
 */
export function transitionUpcomingMovies() {
  const transitioned: string[] = [];
  for (const movie of loadMovies()) {
    if (movie.status !== "upcoming" && movie.status !== "missing") continue;
    const released = movieHasReleased(movie.vfReleaseDate, movie.releaseDate);
    if (movie.status === "upcoming" && released) {
      updateMovie(movie.id, { status: "missing" });
      transitioned.push(movie.id);
    } else if (movie.status === "missing" && !released) {
      updateMovie(movie.id, { status: "upcoming" });
      transitioned.push(movie.id);
    }
  }
  return { transitioned };
}

/**
 * Retry every monitored movie still "missing" whose VF (France digital/
 * physical) release date has actually arrived — releases routinely land on
 * indexers a few days late, so a single check on release day itself isn't
 * enough. Bounded to a two-week window so this doesn't degrade into an
 * unbounded retry of every old missing movie; the manual Wanted list already
 * covers those. Meant to run a few times a day.
 */
export async function searchReleasedMissingMovies() {
  // Voie arrière-plan + cession à l'utilisateur : tâche planifiée (4x/jour),
  // jamais prioritaire sur une interaction utilisateur.
  return runBackground(() => searchReleasedMissingMoviesInner());
}

async function searchReleasedMissingMoviesInner() {
  const now = Date.now();
  const searched: string[] = [];
  for (const movie of loadMovies()) {
    await yieldToUser("recherche films récents");
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
  // Voie arrière-plan + cession à l'utilisateur : bulk planifiée (relance
  // 6h), jamais prioritaire sur une interaction utilisateur. Le bulk MANUEL
  // (« Rechercher les manquants » du bouton) passe par searchAllMissing,
  // qui reste en voie utilisateur par défaut.
  return runBackground(() => searchMissingMoviesInner(max));
}

async function searchMissingMoviesInner(max: number) {
  const candidates = loadMovies().filter((m) => m.monitored && m.status === "missing");
  // Randomize to avoid re-searching the same movies every pass — every run
  // targets a different subset of the missing library.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const batch = candidates.slice(0, max);
  const searched: string[] = [];
  for (const movie of batch) {
    await yieldToUser("recherche films manquants");
    await searchAndGrabMovie(movie.id);
    searched.push(movie.id);
  }
  return { searched, total: candidates.length };
}
