import { getMovie, updateMovie } from "@/lib/library/store";
import { searchFromCache } from "@/lib/indexers/rssCache";
import { MOVIE_CATEGORY_IDS } from "@/lib/indexers/categories";
import { parseRelease } from "@/lib/naming/parser";
import { releaseTitleMatches, yearIsCompatible } from "@/lib/library/matching";
import { loadReleaseRules } from "@/lib/library/releaseRules";
import { isBlockedForAutoGrab } from "@/lib/library/decisionGuard";
import { isRecentlyFailedRelease } from "@/lib/library/failedReleases";
import { buildGrabPayload } from "@/lib/indexers/grabPayload";
import { recordDecision } from "@/lib/library/decisionLog";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import { ENGINE_BASE, engineHeaders, ENGINE_TIMEOUT_MS } from "@/lib/engine/server";
import { encodeLibraryRef } from "@/lib/library/types";
import { markPendingVersionIntent, type VersionGrabMode } from "@/lib/library/pendingVersionIntent";
import { loadIndexers } from "@/lib/indexers/store";
import { withoutRateLimited } from "@/lib/indexers/rateLimit";
import { searchMovie } from "@/lib/indexers/torznab";
import type { IndexerRelease } from "@/lib/indexers/types";

/**
 * "Ajouter une version" (LOT6.2/6.10) — an explicitly user-triggered search
 * that deliberately IGNORES the quality profile's resolution/size limits
 * (the whole point is to find something DIFFERENT, e.g. a smaller mobile
 * copy or a different-language cut) while keeping every safety filter from
 * `checkQualityUpgrades`/`searchAndGrabMovie` intact: forbidden words,
 * title/franchise/year matching, recently-failed releases. Never grabs on
 * its own — always returns candidates for the UI's replace-vs-add
 * confirmation (see AddVersionModal, LOT6.5/6.10).
 */
export interface VersionCandidate {
  release: IndexerRelease;
  resolution: string | null;
  videoCodec: string | null;
  audioCodec: string | null;
  hdr: string | null;
}

export type SearchAlternateVersionResult =
  | { ok: true; candidates: VersionCandidate[] }
  | { ok: false; error: "movie_not_found" | "no_file" | "no_candidates" };

/** Coarse duplicate guard — exact same resolution+codec+audio combo already owned as a version. */
function isDuplicateOfOwnedVersion(
  movie: { file: { resolution: string | null; videoCodec: string | null; audioCodec: string | null } | null; versions?: { resolution: string | null; videoCodec: string | null; audioCodec: string | null }[] },
  candidate: { resolution: string | null; videoCodec: string | null; audioCodec: string | null }
): boolean {
  const owned = movie.versions && movie.versions.length > 0 ? movie.versions : movie.file ? [movie.file] : [];
  return owned.some((v) => v.resolution === candidate.resolution && v.videoCodec === candidate.videoCodec && v.audioCodec === candidate.audioCodec);
}

/** Runs the shared filter chain over a raw release list, producing sorted VersionCandidates. */
function filterCandidates(
  releases: IndexerRelease[],
  movie: Parameters<typeof isDuplicateOfOwnedVersion>[0] & { title: string; year: number | null },
  rules: ReturnType<typeof loadReleaseRules>
): VersionCandidate[] {
  return releases
    .map((r) => ({ release: r, parsed: parseRelease(r.title) }))
    .filter(({ parsed }) => releaseTitleMatches(parsed.title, movie.title))
    .filter(({ parsed }) => yearIsCompatible(parsed.year, movie.year))
    .filter(({ release }) => !isBlockedForAutoGrab(release.title, rules, movie.title).blocked)
    .filter(({ release }) => !isRecentlyFailedRelease(release.infoHash))
    .map(({ release, parsed }) => ({
      release,
      resolution: parsed.resolution,
      videoCodec: parsed.videoCodec,
      audioCodec: parsed.audioCodec,
      hdr: parsed.hdr,
    }))
    .filter((c) => !isDuplicateOfOwnedVersion(movie, c))
    .sort((a, b) => b.release.score - a.release.score);
}

/**
 * The RSS cache only ever holds the ~100-150 most recent releases across
 * every configured indexer (see rssCache.ts) — an already-owned catalog
 * title (which is exactly what "add a version" always targets) essentially
 * never has a fresh matching release sitting in that narrow window. Same gap
 * already fixed for first acquisition (autoGrab.ts) and manual search
 * (api/indexers/search/route.ts): fall back to a live per-indexer search
 * when the cache comes up empty, instead of reporting "nothing found" on a
 * search that was never actually attempted against the real catalog.
 */
export async function searchAlternateVersion(movieId: string): Promise<SearchAlternateVersionResult> {
  const movie = getMovie(movieId);
  if (!movie) return { ok: false, error: "movie_not_found" };
  if (!movie.file) return { ok: false, error: "no_file" };

  const rules = loadReleaseRules();
  const cached = searchFromCache(MOVIE_CATEGORY_IDS);
  let candidates = filterCandidates(cached, movie, rules);

  if (candidates.length === 0) {
    const configuredIndexers = loadIndexers().filter((i) => i.enabled && i.protocol === "torrent");
    const indexers = withoutRateLimited(configuredIndexers);
    if (indexers.length > 0) {
      recordSearchLog("info", "additional_version.fallback_direct", `${movie.title} — cache vide, recherche directe sur ${indexers.length} indexeur(s)`);
      const directReleases: IndexerRelease[] = [];
      for (const ix of indexers) {
        const results = await searchMovie(ix, { title: movie.title, year: movie.year, imdbId: movie.imdbId, tmdbId: movie.tmdbId }, MOVIE_CATEGORY_IDS).catch(() => [] as IndexerRelease[]);
        directReleases.push(...results);
      }
      candidates = filterCandidates(directReleases, movie, rules);
      recordSearchLog(
        candidates.length > 0 ? "info" : "warn",
        candidates.length > 0 ? "additional_version.fallback_match" : "additional_version.fallback_empty",
        `${movie.title} — recherche directe: ${directReleases.length} release(s) brute(s), ${candidates.length} candidat(s) après filtrage`
      );
    }
  }

  if (candidates.length === 0) return { ok: false, error: "no_candidates" };
  return { ok: true, candidates: candidates.slice(0, 10) };
}

export type GrabAlternateVersionResult =
  | { ok: true; release: IndexerRelease }
  | { ok: false; error: string };

/**
 * Actually submits the chosen candidate to the engine, tagged with the
 * user's explicit replace-vs-add choice (LOT6.10) so the import callback
 * (`/api/library/import`) knows whether to ADD a version or replace the
 * primary file once the download completes.
 */
export async function grabAlternateVersion(movieId: string, candidate: VersionCandidate, mode: VersionGrabMode = "add"): Promise<GrabAlternateVersionResult> {
  const movie = getMovie(movieId);
  if (!movie) return { ok: false, error: "movie_not_found" };

  const payload = await buildGrabPayload({
    magnetUrl: candidate.release.magnetUrl,
    downloadUrl: candidate.release.downloadUrl,
    indexerId: candidate.release.indexerId,
  });
  if ("error" in payload) {
    recordSearchLog("warn", "additional_version.grab_payload_failed", `${movie.title} — "${candidate.release.title}" a échoué (${payload.error})`);
    return { ok: false, error: payload.error };
  }

  if (candidate.release.infoHash) markPendingVersionIntent(candidate.release.infoHash, mode);

  recordDecision({
    refTitle: movie.title,
    releaseTitle: candidate.release.title,
    decision: "accepted",
    intent: "additional_version",
    reasons: [{ type: "additional_version", message: "Version supplémentaire demandée par l'utilisateur" }],
  });

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
    if (!res.ok) return { ok: false, error: "engine_unreachable" };
    const torrent = await res.json();
    updateMovie(movie.id, { status: "downloading", activeInfoHash: torrent.infoHash });
    recordSearchLog("info", "additional_version.grabbed", `${movie.title} — ${candidate.release.title} (version supplémentaire, infoHash:${torrent.infoHash})`);
    return { ok: true, release: candidate.release };
  } catch {
    recordSearchLog("error", "additional_version.engine_unreachable", `${movie.title} — moteur de téléchargement injoignable`);
    return { ok: false, error: "engine_unreachable" };
  }
}
