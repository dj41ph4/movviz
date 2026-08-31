import { addMovieToLibrary } from "@/lib/library/autoGrab";
import { addSeriesToLibrary } from "@/lib/library/autoGrabSeries";
import { getMovieByTmdbId, getSeriesByTmdbId } from "@/lib/library/store";
import { addRequest, loadRequests } from "@/lib/requests/store";
import { getMovie as fetchTmdbMovie, getSeries as fetchTmdbSeries } from "@/lib/metadata/tmdb";
import { logActivity } from "@/lib/activity/store";
import { isBlocked } from "@/lib/blocklist/store";
import type { User } from "@/lib/auth/types";
import type { LibraryMovie, LibrarySeries } from "@/lib/library/types";
import { loadTrash, restoreFromTrash } from "@/lib/library/trashStore";

function addApprovedRequest(
  user: User,
  type: "movie" | "series",
  item: LibraryMovie | LibrarySeries,
  seasonNumbers?: number[]
) {
  return addRequest({
    id: `req_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    userId: user.id,
    username: user.username,
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
    decidedBy: user.username,
    seasonNumbers,
  });
}

/**
 * The single place that decides what happens when someone (a user clicking
 * "add", or the Plex watchlist sync) asks for a title: admins and
 * auto-approved users get it added and searched immediately, everyone else
 * gets a pending request. Shared by the movies/series POST routes and the
 * watchlist sync job so the rule only lives in one place.
 */
export async function requestMedia(
  user: User,
  type: "movie" | "series",
  tmdbId: number,
  qualityProfileId?: string,
  seasonNumbers?: number[],
  options?: { skipSearch?: boolean }
) {
  if (isBlocked(type, tmdbId)) return { blocked: true as const };

  const alreadyInLibrary = type === "movie" ? getMovieByTmdbId(tmdbId) : getSeriesByTmdbId(tmdbId);
  // The item itself rides along so a caller that asks for the title and finds
  // it already present can link to it right away — without re-fetching the
  // whole library and hoping the entry is there (the "Impossible d'ajouter ce
  // titre à la bibliothèque" failure in the link-before-download picker).
  if (alreadyInLibrary) return { alreadyInLibrary: true as const, item: alreadyInLibrary };

  // A removed title is not a brand-new acquisition.  Keep the normal add
  // pipeline (quality rules, blocklist, search locks and engine callbacks),
  // but expose the distinction to the caller and consume the metadata
  // tombstone only after the new library record has been created.  This
  // prevents a stale Requests entry or a deleted Plex ratingKey from making
  // the second add look like a duplicate, while preserving the existing
  // first-acquisition behaviour for titles never seen by Movviz.
  const wasDeleted = loadTrash().some((t) => t.type === type && t.tmdbId === tmdbId);

  const limit = type === "movie" ? user.requestLimitMovies : user.requestLimitSeries;
  if (user.role !== "admin" && limit != null) {
    const outstanding = loadRequests().filter(
      (r) => r.userId === user.id && r.type === type && (r.status === "pending" || r.status === "approved")
    ).length;
    if (outstanding >= limit) return { quotaReached: true as const };
  }

  const canAutoApprove = user.role === "admin" || user.autoApproveRequests;

  if (canAutoApprove) {
    // Persist the approved request immediately after the library record is
    // created, *before* the network-dependent automatic search begins.
    // This preserves the live Requests/status workflow even on a search
    // failure and prevents a 500 from hiding a title that was already added.
    let approvedRequest: ReturnType<typeof addRequest> | null = null;
    const onAdded = (item: LibraryMovie | LibrarySeries) => {
      approvedRequest = addApprovedRequest(user, type, item, seasonNumbers);
    };
    const result =
      type === "movie"
        ? await addMovieToLibrary(tmdbId, qualityProfileId, { ...options, onAdded })
        : await addSeriesToLibrary(tmdbId, qualityProfileId, seasonNumbers, { ...options, onAdded });
    if ("error" in result) return { error: result.error };
    const item = "movie" in result ? result.movie : result.series;
    const href = "movie" in result ? `/title/movie/${result.movie.tmdbId}` : `/title/series/${result.series.tmdbId}`;
    logActivity("added", user.username, item.title, href);
    // Auto-approved adds still land in the Requests menu (pre-approved), so
    // it shows every ask with a live status badge, not just the gated ones.
    // Reused/duplicate-title entries are returned without the callback; they
    // still represent this explicit request and must appear in Requests.
    approvedRequest ??= addApprovedRequest(user, type, item, seasonNumbers);
    if (wasDeleted) restoreFromTrash(tmdbId, type);
    return { added: item, searchResult: result.searchResult, readded: wasDeleted as true | false };
  }

  // Not just this user's own pending ask — anyone's. A title someone else
  // already requested shouldn't spawn a second, duplicate Request; the asker
  // just gets told it's already in the queue.
  const existingRequest = loadRequests().find(
    (r) => r.type === type && r.tmdbId === tmdbId && (r.status === "pending" || r.status === "approved")
  );
  if (existingRequest) {
    return existingRequest.userId === user.id
      ? { pendingRequest: existingRequest }
      : { duplicateRequest: existingRequest };
  }

  const meta = type === "movie" ? await fetchTmdbMovie(tmdbId) : await fetchTmdbSeries(tmdbId);
  if (!meta) return { error: `${type} not found on TMDb` };

  const request = addRequest({
    id: `req_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    userId: user.id,
    username: user.username,
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
    seasonNumbers,
  });

  return { pendingRequest: request };
}
