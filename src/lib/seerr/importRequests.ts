import { loadSeerrConfig, seerrConfigured } from "@/lib/seerr/store";
import { getSeerrUsers, getSeerrRequests } from "@/lib/seerr/client";
import { getUserByPlexId, getUserByUsername, loadUsers } from "@/lib/auth/store";
import { getMovieByTmdbId, getSeriesByTmdbId } from "@/lib/library/store";
import { addMovieToLibrary } from "@/lib/library/autoGrab";
import { addSeriesToLibrary } from "@/lib/library/autoGrabSeries";
import { addRequest, loadRequests } from "@/lib/requests/store";
import { isBlocked } from "@/lib/blocklist/store";
import { reconcileLibrary } from "@/lib/library/reconcile";
import { getMovie as fetchTmdbMovie, getSeries as fetchTmdbSeries } from "@/lib/metadata/tmdb";
import { mapWithConcurrency } from "@/lib/concurrency";
import { setMediaMapEntry, notifySeerrStatus } from "@/lib/seerr/mediaMap";
import type { User } from "@/lib/auth/types";
import type { SeerrUser, SeerrRequest } from "@/lib/seerr/types";

const IMPORT_CONCURRENCY = 4;

export interface SeerrImportResult {
  seerrUsers: number;
  seerrRequests: number;
  importedApproved: number;
  importedPending: number;
  alreadyInLibrary: number;
  alreadyRequested: number;
  skippedDeclined: number;
  skippedBlocked: number;
  failed: number;
  unmatchedUsers: string[];
}

type ItemOutcome =
  | { kind: "declined" }
  | { kind: "blocked" }
  | { kind: "alreadyInLibrary" }
  | { kind: "alreadyRequested" }
  | { kind: "pending" }
  | { kind: "approved" }
  | { kind: "failed" };

function matchUser(seerrUser: SeerrUser, fallback: User): User {
  if (seerrUser.plexId) {
    const byPlex = getUserByPlexId(seerrUser.plexId);
    if (byPlex) return byPlex;
  }
  const candidates = [seerrUser.plexUsername, seerrUser.username, seerrUser.displayName].filter(
    (v): v is string => !!v
  );
  for (const name of candidates) {
    const byUsername = getUserByUsername(name);
    if (byUsername) return byUsername;
  }
  return fallback;
}

export async function importSeerrRequests(): Promise<SeerrImportResult> {
  if (!seerrConfigured()) return { seerrUsers: 0, seerrRequests: 0, importedApproved: 0, importedPending: 0, alreadyInLibrary: 0, alreadyRequested: 0, skippedDeclined: 0, skippedBlocked: 0, failed: 0, unmatchedUsers: [] };

  const cfg = loadSeerrConfig();
  const [seerrUsers, seerrRequests] = await Promise.all([getSeerrUsers(cfg), getSeerrRequests(cfg)]);

  const found = loadUsers().find((u) => u.role === "admin");
  if (!found) return { seerrUsers: seerrUsers.length, seerrRequests: seerrRequests.length, importedApproved: 0, importedPending: 0, alreadyInLibrary: 0, alreadyRequested: 0, skippedDeclined: 0, skippedBlocked: 0, failed: 0, unmatchedUsers: [] };
  const admin = found;

  for (const sr of seerrRequests) {
    setMediaMapEntry(sr.media.mediaType === "tv" ? "series" : "movie", sr.media.tmdbId, sr.media.id);
  }

  const reserved = new Set<string>();

  async function processOne(sr: SeerrRequest): Promise<ItemOutcome> {
    if (sr.status === 3) return { kind: "declined" };
    const type = sr.media.mediaType === "tv" ? "series" : "movie";
    const tmdbId = sr.media.tmdbId;
    const key = `${type}:${tmdbId}`;
    if (isBlocked(type, tmdbId)) return { kind: "blocked" };
    if (type === "movie") {
      const libMovie = getMovieByTmdbId(tmdbId);
      if (libMovie) {
        if (libMovie.status === "available") {
          void notifySeerrStatus("movie", tmdbId, "available").catch(() => {});
        }
        return { kind: "alreadyInLibrary" };
      }
    } else {
      if (getSeriesByTmdbId(tmdbId)) return { kind: "alreadyInLibrary" };
    }
    const existingRequest = loadRequests().find(
      (r) => r.type === type && r.tmdbId === tmdbId && (r.status === "pending" || r.status === "approved")
    );
    if (existingRequest || reserved.has(key)) return { kind: "alreadyRequested" };
    reserved.add(key);

    const matched = matchUser(sr.requestedBy, admin);

    if (sr.status === 1) {
      const meta = type === "movie" ? await fetchTmdbMovie(tmdbId) : await fetchTmdbSeries(tmdbId);
      if (!meta) return { kind: "failed" };
      addRequest({
        id: `req_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        userId: matched.id,
        username: matched.username,
        type,
        tmdbId: meta.tmdbId,
        title: meta.title,
        year: meta.year,
        posterPath: meta.posterPath,
        overview: meta.overview,
        rating: meta.rating,
        status: "pending",
        createdAt: Date.now(),
        decidedAt: null,
        decidedBy: null,
        seasonNumbers: sr.media.seasons,
      });
      return { kind: "pending" };
    }

    const result = type === "movie" ? await addMovieToLibrary(tmdbId) : await addSeriesToLibrary(tmdbId, undefined, sr.media.seasons);
    if ("error" in result) return { kind: "failed" };
    const item = "movie" in result ? result.movie : result.series;
    addRequest({
      id: `req_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      userId: matched.id,
      username: matched.username,
      type,
      tmdbId: item.tmdbId,
      title: item.title,
      year: item.year,
      posterPath: item.posterPath,
      overview: item.overview,
      rating: item.rating,
      status: "approved",
      createdAt: Date.now(),
      decidedAt: Date.now(),
      decidedBy: admin.username,
      seasonNumbers: sr.media.seasons,
    });
    return { kind: "approved" };
  }

  const outcomes = await mapWithConcurrency(seerrRequests, IMPORT_CONCURRENCY, processOne);

  let alreadyInLibrary = 0, alreadyRequested = 0, skippedDeclined = 0, skippedBlocked = 0;
  let importedApproved = 0, importedPending = 0, failed = 0;
  for (const o of outcomes) {
    if (o.kind === "declined") skippedDeclined++;
    else if (o.kind === "blocked") skippedBlocked++;
    else if (o.kind === "alreadyInLibrary") alreadyInLibrary++;
    else if (o.kind === "alreadyRequested") alreadyRequested++;
    else if (o.kind === "pending") importedPending++;
    else if (o.kind === "approved") importedApproved++;
    else if (o.kind === "failed") failed++;
  }

  await reconcileLibrary();

  return {
    seerrUsers: seerrUsers.length,
    seerrRequests: seerrRequests.length,
    importedApproved,
    importedPending,
    alreadyInLibrary,
    alreadyRequested,
    skippedDeclined,
    skippedBlocked,
    failed,
    unmatchedUsers: [] as string[],
  };
}
