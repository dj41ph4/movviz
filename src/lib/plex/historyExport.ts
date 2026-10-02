import { getUserById } from "@/lib/auth/store";
import { listPlaybackProgress } from "@/lib/playback/progressStore";
import { getCanonicalWatchStatus, getCurrentWatchState } from "@/lib/userContext/watchBridge";
import { getUserMediaSyncStates } from "@/lib/userContext/syncState";
import { mediaStateKey } from "@/lib/userContext/reconcile";
import { withUserContextDb } from "@/lib/userContext/database";
import { resolvePlexUserContext } from "./plexUserContext";
import { loadPlexConfig } from "./store";
import { markPlexWatchedOutboxPending } from "./watchWrite";

/** Explicit administrator-authorized export. Ordinary Plex imports still
 * never echo to Plex. This only queues this user's CURRENT watched decisions;
 * original Movviz history dates and ongoing playback are left untouched. */
export async function queuePlexWatchHistoryExport(userId: string, apply: boolean) {
  const user = getUserById(userId);
  if (!user) throw new Error("user_not_found");
  const cfg = loadPlexConfig();
  const resolved = await resolvePlexUserContext(user.id);
  if (!resolved.ok) throw new Error(`plex_context_unresolved:${resolved.reason}`);
  const ctx = resolved.ctx;
  if (ctx.movvizUserId !== user.id || (ctx.authSource !== "owner" &&
    (!ctx.localAccountId || ctx.localAccountId === 1 || ctx.serverToken === cfg.adminToken))) {
    throw new Error("unsafe_plex_target_identity");
  }
  const watch = getCanonicalWatchStatus(user.id);
  if (!watch) throw new Error("canonical_watch_store_unavailable");
  const inProgress = new Set(listPlaybackProgress(user.id).filter((p) => p.tmdbId != null).map((p) =>
    mediaStateKey(user.id, p.mediaType, p.tmdbId!, p.seasonNumber, p.episodeNumber)));
  const synced = new Map(getUserMediaSyncStates(user.id)
    .filter((s) => s.target === "plex" && s.field === "watched").map((s) => [s.stateKey, s]));
  const revisions = withUserContextDb((db) => new Map(
    (db.prepare("SELECT state_key, watched_revision FROM user_media_state WHERE user_id = ? AND watched = 1")
      .all(user.id) as { state_key: string; watched_revision: number | null }[])
      .map((row) => [row.state_key, row.watched_revision])), new Map<string, number | null>());
  const report = { target: user.username, plexAccountId: ctx.plexAccountId ?? ctx.plexManagedUserId,
    localAccountId: ctx.localAccountId, dryRun: !apply, watched: 0,
    queued: 0, alreadySynced: 0, skippedInProgress: 0 };
  const enqueue = (tmdbId: number, mediaType: "movie" | "episode", season?: number, episode?: number) => {
    const key = mediaStateKey(user.id, mediaType, tmdbId, season, episode);
    if (getCurrentWatchState({ userId: user.id, tmdbId, mediaType, seasonNumber: season, episodeNumber: episode }) !== "watched") return;
    report.watched++;
    if (inProgress.has(key)) { report.skippedInProgress++; return; }
    const previous = synced.get(key);
    if (previous?.capability === "SYNCED" && previous.desiredState === "watched") {
      report.alreadySynced++; return;
    }
    if (apply && !markPlexWatchedOutboxPending(user.id, mediaType, tmdbId, season, episode, revisions.get(key), "watched")) {
      throw new Error("plex_export_outbox_write_failed");
    }
    report.queued++;
  };
  for (const id of watch.movies) enqueue(id, "movie");
  for (const e of watch.episodes) enqueue(e.tmdbId, "episode", e.season, e.episode);
  return report;
}
