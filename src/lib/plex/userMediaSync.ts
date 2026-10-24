import path from "node:path";
import type { User } from "@/lib/auth/types";
import type { WatchlistItem } from "@/lib/watchlist/types";
import { getWatchlistItem, loadWatchlistHistory, addWatchlistItem, removeWatchlistItem, setWatchlistPlexIdentity } from "@/lib/watchlist/store";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import { mediaStateKey } from "@/lib/userContext/reconcile";
import { updateUserMediaSyncState } from "@/lib/userContext/syncState";
import { getPlexWatchlistSnapshot, addPlexWatchlistItem, removePlexWatchlistItem, resolvePlexDiscoverRatingKey } from "./client";

type RemoteEntry = { addedAt: number; ratingKey: string | null };
type Observation = { observedAt: number; items: Record<string, RemoteEntry>; emptyObservations?: number };
const FILE = path.join(process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data"), "plex-watchlist-observations.json");
const keyOf = (type: string, tmdbId: number) => `${type}:${tmdbId}`;
const eligible = (item: WatchlistItem) => (item.type === "movie" || item.type === "series") && item.seriesPart !== "tybw";

function markSynced(userId: string, item: WatchlistItem, at: number) {
  updateUserMediaSyncState({ userId, stateKey: mediaStateKey(userId, item.type, item.tmdbId, item.seasonNumber, item.episodeNumber), field: "watchlist", target: "plex", capability: "SYNCED", observedAt: at, ackAt: at });
}

/** Fast path after the response; the scheduled pass retries failures. */
export async function syncPlexWatchlistMutation(user: User, item: WatchlistItem): Promise<void> {
  if (!user.plexToken || !eligible(item)) return;
  const current = getWatchlistItem(user.id, item.type, item.tmdbId, item.seasonNumber ?? undefined, item.episodeNumber ?? undefined, item.seriesPart);
  if (!current || current.updatedAt !== item.updatedAt || current.present !== item.present) return;
  const ratingKey = current.plexDiscoverRatingKey ?? await resolvePlexDiscoverRatingKey(user.plexToken, current.type as "movie" | "series", current.tmdbId);
  if (!ratingKey) return;
  setWatchlistPlexIdentity(user.id, current.type as "movie" | "series", current.tmdbId, ratingKey);
  const latest = getWatchlistItem(user.id, item.type, item.tmdbId, item.seasonNumber ?? undefined, item.episodeNumber ?? undefined, item.seriesPart);
  if (!latest || latest.updatedAt !== item.updatedAt || latest.present !== item.present) return;
  const ok = latest.present ? await addPlexWatchlistItem(user.plexToken, ratingKey) : await removePlexWatchlistItem(user.plexToken, ratingKey);
  if (ok) markSynced(user.id, latest, Date.now());
}

/** Reconciles timestamped additions and observed removals off the page path. */
export async function syncPlexUserMedia(user: User): Promise<void> {
  if (!user.plexToken) return;
  const remote = await getPlexWatchlistSnapshot(user.plexToken);
  if (!remote) return; // Failed fetch is not an empty list.
  const now = Date.now();
  const observations = readJsonCached<Record<string, Observation>>(FILE, {});
  const previous = observations[user.id];
  if (remote.length === 0 && previous && Object.keys(previous.items).length >= 10 && !previous.emptyObservations) {
    // A transient Plex 200/empty response must not wipe a large watchlist.
    observations[user.id] = { ...previous, emptyObservations: 1 };
    writeJsonCached(FILE, observations);
    return;
  }
  const currentRemote: Record<string, RemoteEntry> = {};
  let imported = 0;
  for (const entry of remote) {
    if (entry.tmdbId == null || entry.addedAt == null) continue;
    const key = keyOf(entry.type, entry.tmdbId);
    currentRemote[key] = { addedAt: entry.addedAt, ratingKey: entry.discoverRatingKey ?? null };
    const local = getWatchlistItem(user.id, entry.type, entry.tmdbId);
    if (local && local.updatedAt >= entry.addedAt) {
      if (entry.discoverRatingKey) setWatchlistPlexIdentity(user.id, entry.type, entry.tmdbId, entry.discoverRatingKey);
      if (local.present) markSynced(user.id, local, now);
      continue;
    }
    const saved = addWatchlistItem({
      userId: user.id, type: entry.type, tmdbId: entry.tmdbId,
      title: local?.title || entry.title, year: local?.year ?? null,
      posterPath: local?.posterPath ?? null, rating: local?.rating ?? 0,
      addedAt: entry.addedAt, updatedAt: entry.addedAt,
      source: "plex_watchlist", plexGuid: entry.plexGuid,
      plexDiscoverRatingKey: entry.discoverRatingKey,
    });
    if (saved.present) { markSynced(user.id, saved, now); imported++; }
  }

  // Plex does not supply deletion time. Disappearance between two successful
  // snapshots is observed now. A local edit since the prior snapshot wins.
  if (previous) for (const key of Object.keys(previous.items)) {
    if (currentRemote[key]) continue;
    const [type, id] = key.split(":");
    const local = getWatchlistItem(user.id, type, Number(id));
    if (local?.present && local.updatedAt <= previous.observedAt) {
      removeWatchlistItem(user.id, type, Number(id), undefined, undefined, now, undefined, "plex_watchlist");
      const removed = getWatchlistItem(user.id, type, Number(id));
      if (removed && !removed.present) markSynced(user.id, removed, now);
    }
  }

  let attempts = 0;
  for (const item of loadWatchlistHistory(user.id)) {
    if (!eligible(item) || attempts >= 12) continue;
    const key = keyOf(item.type, item.tmdbId);
    const remoteItem = currentRemote[key];
    if (!previous && item.source === "plex_watchlist" && item.present && !remoteItem) {
      removeWatchlistItem(user.id, item.type, item.tmdbId, undefined, undefined, now, undefined, "plex_watchlist");
      const removed = getWatchlistItem(user.id, item.type, item.tmdbId);
      if (removed && !removed.present) markSynced(user.id, removed, now);
      continue;
    }
    if (item.present === !!remoteItem) continue;
    if (item.present && previous?.items[key] && item.updatedAt <= previous.observedAt) continue;
    if (!item.present && remoteItem && item.updatedAt < remoteItem.addedAt) continue;
    attempts++;
    const ratingKey = item.plexDiscoverRatingKey ?? remoteItem?.ratingKey ?? await resolvePlexDiscoverRatingKey(user.plexToken, item.type as "movie" | "series", item.tmdbId);
    if (!ratingKey) continue;
    setWatchlistPlexIdentity(user.id, item.type as "movie" | "series", item.tmdbId, ratingKey);
    const latest = getWatchlistItem(user.id, item.type, item.tmdbId);
    if (!latest || latest.updatedAt !== item.updatedAt || latest.present !== item.present) continue;
    const ok = item.present ? await addPlexWatchlistItem(user.plexToken, ratingKey) : await removePlexWatchlistItem(user.plexToken, ratingKey);
    if (ok) markSynced(user.id, item, now);
  }
  observations[user.id] = { observedAt: now, items: currentRemote };
  writeJsonCached(FILE, observations);
  if (imported > 0) recordSearchLog("info", "plex.userMediaSync", `${user.username}: ${imported} nouvel(s) élément(s) Watchlist Plex importé(s)`);
}
