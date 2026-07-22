import { loadPlexConfig } from "./store";
import { getLibrarySections, getSectionItems, getShowEpisodes } from "./client";
import { saveWatchStatus } from "./watchStore";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { User } from "@/lib/auth/types";

/**
 * Read this user's own watch state directly from their Plex account.
 *
 * Two modes:
 *   - Managed user (profile within a Plex Home) → use admin token +
 *     X-Plex-Profile header so Plex scopes viewCount to that profile.
 *   - Full account → use the user's own plexToken (standard flow).
 */
export async function syncUserWatchStatus(user: User) {
  const cfg = loadPlexConfig();
  const effectiveToken =
    user.plexManagedUserId && cfg.adminToken
      ? cfg.adminToken
      : user.plexToken;
  if (!cfg.hostname || !effectiveToken) return;

  const sections = await getLibrarySections(
    cfg,
    effectiveToken,
    user.plexManagedUserId ?? undefined,
  );
  const movies: number[] = [];
  const episodes: { tmdbId: number; season: number; episode: number }[] = [];

  for (const section of sections.filter((s) => s.type === "movie")) {
    const items = await getSectionItems(
      cfg,
      section.key,
      effectiveToken,
      undefined,
      user.plexManagedUserId ?? undefined,
    );
    for (const item of items) {
      if (item.tmdbId != null && item.viewCount > 0) movies.push(item.tmdbId);
    }
  }

  for (const section of sections.filter((s) => s.type === "show")) {
    const shows = await getSectionItems(
      cfg,
      section.key,
      effectiveToken,
      undefined,
      user.plexManagedUserId ?? undefined,
    );
    // One Plex round-trip per show, done one at a time, took several minutes
    // on a library with hundreds of shows — long enough to hold up the whole
    // job queue (only 1 job runs at a time while a download is active),
    // stalling anything queued behind it, like a user-triggered library
    // search. A small bounded concurrency cuts that down without hammering
    // the media server the way an unbounded Promise.all would.
    const showsWithTmdb = shows.filter((s) => s.tmdbId != null);
    await mapWithConcurrency(showsWithTmdb, 5, async (show) => {
      const eps = await getShowEpisodes(
        cfg,
        show.ratingKey,
        effectiveToken,
        user.plexManagedUserId ?? undefined,
      );
      for (const ep of eps) {
        if (ep.viewCount > 0) episodes.push({ tmdbId: show.tmdbId!, season: ep.seasonNumber, episode: ep.episodeNumber });
      }
    });
  }

  saveWatchStatus({ userId: user.id, movies, episodes, updatedAt: Date.now() });
}
