import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadSeerrConfig, seerrConfigured } from "@/lib/seerr/store";
import { getSeerrUsers, getSeerrRequests } from "@/lib/seerr/client";
import { getUserByPlexId, getUserByUsername } from "@/lib/auth/store";
import { getMovieByTmdbId, getSeriesByTmdbId } from "@/lib/library/store";
import { addMovieToLibrary } from "@/lib/library/autoGrab";
import { addSeriesToLibrary } from "@/lib/library/autoGrabSeries";
import { addRequest, loadRequests } from "@/lib/requests/store";
import { isBlocked } from "@/lib/blocklist/store";
import { reconcileLibrary } from "@/lib/library/reconcile";
import { getMovie as fetchTmdbMovie, getSeries as fetchTmdbSeries } from "@/lib/metadata/tmdb";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { User } from "@/lib/auth/types";
import type { SeerrUser, SeerrRequest } from "@/lib/seerr/types";

/** Items are processed IMPORT_CONCURRENCY at a time instead of one by one — cuts wall-clock time roughly by that factor without changing per-item behavior. */
const IMPORT_CONCURRENCY = 4;

type ItemOutcome =
  | { kind: "declined" }
  | { kind: "blocked" }
  | { kind: "alreadyInLibrary" }
  | { kind: "alreadyRequested" }
  | { kind: "pending" }
  | { kind: "approved" }
  | { kind: "failed" };

export const dynamic = "force-dynamic";

/**
 * Match a Seerr requester to an existing Movviz account: by Plex account id
 * first (both apps are usually Plex-linked in the same household), then by
 * username. No fuzzy matching — a wrong auto-match would misattribute
 * someone else's request history, so an unmatched user falls back to the
 * importing admin and is called out in the report instead.
 */
function matchUser(seerrUser: SeerrUser, admin: User): User {
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
  return admin;
}

export async function POST(req: NextRequest) {
  const requester = requireAdmin(req);
  if (!requester) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const admin = requester;
  if (!seerrConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 400 });

  const cfg = loadSeerrConfig();
  const [seerrUsers, seerrRequests] = await Promise.all([getSeerrUsers(cfg), getSeerrRequests(cfg)]);

  const unmatchedSeerrUsernames = new Set<string>();
  // Guards against two concurrent items in this same import racing on the
  // same title (both passing the "not already requested" check before
  // either has written its request yet) — reserved synchronously, before
  // any `await`, so it's safe even though items now run in parallel.
  const reserved = new Set<string>();

  async function processOne(sr: SeerrRequest): Promise<ItemOutcome> {
    if (sr.status === 3) return { kind: "declined" };

    const type = sr.media.mediaType === "tv" ? "series" : "movie";
    const tmdbId = sr.media.tmdbId;
    const key = `${type}:${tmdbId}`;

    if (isBlocked(type, tmdbId)) return { kind: "blocked" };
    if ((type === "movie" ? getMovieByTmdbId(tmdbId) : getSeriesByTmdbId(tmdbId))) return { kind: "alreadyInLibrary" };
    const existingRequest = loadRequests().find(
      (r) => r.type === type && r.tmdbId === tmdbId && (r.status === "pending" || r.status === "approved")
    );
    if (existingRequest || reserved.has(key)) return { kind: "alreadyRequested" };
    reserved.add(key);

    const matched = matchUser(sr.requestedBy, admin);
    if (matched.id === admin.id) {
      const label = sr.requestedBy.plexUsername ?? sr.requestedBy.username ?? sr.requestedBy.displayName ?? sr.requestedBy.email ?? `#${sr.requestedBy.id}`;
      unmatchedSeerrUsernames.add(label);
    }

    if (sr.status === 1) {
      // Still pending on Seerr: create the same pending request here, goes through the normal approval flow.
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
      });
      return { kind: "pending" };
    }

    // Approved on Seerr: add to the library and search, same as an auto-approved Movviz request.
    const result = type === "movie" ? await addMovieToLibrary(tmdbId) : await addSeriesToLibrary(tmdbId);
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
    });
    return { kind: "approved" };
  }

  const outcomes = await mapWithConcurrency(seerrRequests, IMPORT_CONCURRENCY, processOne);

  let alreadyInLibrary = 0;
  let alreadyRequested = 0;
  let skippedDeclined = 0;
  let skippedBlocked = 0;
  let importedApproved = 0;
  let importedPending = 0;
  let failed = 0;
  for (const o of outcomes) {
    if (o.kind === "declined") skippedDeclined++;
    else if (o.kind === "blocked") skippedBlocked++;
    else if (o.kind === "alreadyInLibrary") alreadyInLibrary++;
    else if (o.kind === "alreadyRequested") alreadyRequested++;
    else if (o.kind === "pending") importedPending++;
    else if (o.kind === "approved") importedApproved++;
    else if (o.kind === "failed") failed++;
  }

  // Picks up titles that were already sitting on disk (imported from Seerr as
  // "available") without triggering a fresh download for them.
  await reconcileLibrary();

  return NextResponse.json({
    seerrUsers: seerrUsers.length,
    seerrRequests: seerrRequests.length,
    importedApproved,
    importedPending,
    alreadyInLibrary,
    alreadyRequested,
    skippedDeclined,
    skippedBlocked,
    failed,
    unmatchedUsers: Array.from(unmatchedSeerrUsernames),
  });
}
