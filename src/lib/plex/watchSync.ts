import { loadPlexConfig } from "./store";
import { getLibrarySections, getSectionItems, getShowEpisodes } from "./client";
import { saveWatchStatus, getWatchStatus } from "./watchStore";
import { mapWithConcurrency } from "@/lib/concurrency";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import type { User } from "@/lib/auth/types";

/**
 * Read this user's own watch state directly from their Plex account.
 *
 * Two modes:
 *   - Managed user (profile within a Plex Home) → use admin token +
 *     X-Plex-Profile header so Plex scopes viewCount to that profile.
 *   - Full/friend account (shared access, own separate Plex login) → use
 *     the user's own plexToken directly against the same server — Plex
 *     scopes viewCount to the requesting token automatically, no special
 *     header needed for this case.
 *
 * Every internal Plex call in client.ts fails silently (bare `catch {
 * return []; }`) so a transient network/auth hiccup for one specific
 * account previously looked IDENTICAL to "this account genuinely watched
 * nothing" — indistinguishable, and for a batch of several users, whichever
 * error surfaced could plausibly wipe out real watch history with an empty
 * result. Confirmed as a real gap when several friend accounts (own Plex
 * login, not a Home-managed profile) turned out to have no watch data
 * despite being properly linked — with zero trace of why. Now: a run that
 * comes back with zero sections is treated as "couldn't reach this
 * account's Plex data" and never overwrites whatever was already saved, and
 * every attempt — success or failure — logs a line to the diagnostic log
 * (Réglages → Journaux) tagged `plex.watchSync`, naming the account, so a
 * silent failure is finally visible instead of just looking like an empty
 * watch history.
 */
export async function syncUserWatchStatus(user: User) {
  const cfg = loadPlexConfig();
  const effectiveToken =
    user.plexManagedUserId && cfg.adminToken
      ? cfg.adminToken
      : user.plexToken;
  if (!cfg.hostname || !effectiveToken) return;

  try {
    const sections = await getLibrarySections(
      cfg,
      effectiveToken,
      user.plexManagedUserId ?? undefined,
    );

    if (sections.length === 0) {
      const previous = getWatchStatus(user.id);
      recordSearchLog(
        "warn",
        "plex.watchSync",
        `${user.username}: 0 section Plex accessible — sync ignorée, données précédentes conservées (${previous ? `${previous.movies.length} films / ${previous.episodes.length} épisodes` : "aucune donnée existante"})`
      );
      return;
    }

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
    // Temporary extra detail (plexId + a non-secret token fingerprint) while
    // diagnosing why every account came back with IDENTICAL counts on the
    // first run with this logging — proves whether these are genuinely
    // distinct Plex accounts/tokens or something is collapsing them onto
    // the same one before ever reaching Plex.
    const tokenFingerprint = effectiveToken ? `${effectiveToken.slice(0, 4)}…${effectiveToken.slice(-4)}` : "none";
    recordSearchLog(
      "info",
      "plex.watchSync",
      `${user.username} (plexId:${user.plexId ?? "?"}, token:${tokenFingerprint}, managed:${user.plexManagedUserId ?? "non"}): synchronisé — ${movies.length} film(s) vu(s), ${episodes.length} épisode(s) vu(s) sur ${sections.length} section(s)`
    );
  } catch (err: any) {
    recordSearchLog(
      "error",
      "plex.watchSync",
      `${user.username}: échec de synchronisation — ${err?.message ?? "erreur inconnue"} — données précédentes conservées`
    );
  }
}
