import type { User } from "@/lib/auth/types";
import { getPlexWatchlist } from "./client";
import { addWatchlistItem } from "@/lib/watchlist/store";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";
import { mediaStateKey } from "@/lib/userContext/reconcile";
import { updateUserMediaSyncState } from "@/lib/userContext/syncState";

// Éléments déjà vus par utilisateur (en mémoire) : sert seulement à ne
// journaliser que les vraies nouveautés.
const gw = globalThis as typeof globalThis & { __movvizPlexWatchlistSeen?: Map<string, Set<string>> };
const seenByUser: Map<string, Set<string>> = (gw.__movvizPlexWatchlistSeen ??= new Map());

/** Pull only causally timestamped Plex watchlist additions. Absence is never
 * interpreted as removal: Plex does not expose a reliable deletion time. */
export async function syncPlexUserMedia(user: User): Promise<void> {
  if (!user.plexToken) return;
  const items = await getPlexWatchlist(user.plexToken);
  let imported = 0;
  const seen = seenByUser.get(user.id) ?? new Set<string>();
  const nowSeen = new Set<string>();
  for (const item of items) {
    if (item.tmdbId == null || item.addedAt == null) continue;
    const saved = addWatchlistItem({
      userId: user.id,
      type: item.type,
      tmdbId: item.tmdbId,
      title: item.title,
      year: null,
      posterPath: null,
      rating: 0,
      addedAt: item.addedAt,
      updatedAt: item.addedAt,
      source: "plex_watchlist",
      plexGuid: item.plexGuid,
      plexDiscoverRatingKey: item.discoverRatingKey,
    });
    if (saved.source === "plex_watchlist" && saved.updatedAt === item.addedAt) {
      updateUserMediaSyncState({
        userId: user.id,
        stateKey: mediaStateKey(user.id, saved.type, saved.tmdbId, saved.seasonNumber, saved.episodeNumber),
        field: "watchlist",
        target: "plex",
        capability: "SYNCED",
        observedAt: item.addedAt,
        remoteHash: `${item.type}:${item.tmdbId}:${item.addedAt}`,
      });
    }
    const key = `${item.type}:${item.tmdbId}:${item.addedAt}`;
    nowSeen.add(key);
    if (!seen.has(key)) imported++;
  }
  seenByUser.set(user.id, nowSeen);
  // Journalisé seulement quand quelque chose arrive (avant : une ligne par
  // utilisateur à chaque passage, plus de 1400 par jour).
  if (imported > 0) recordSearchLog("info", "plex.userMediaSync", `${user.username}: ${imported} nouvel(s) élément(s) Watchlist Plex importé(s), aucune absence distante interprétée comme suppression`);
}
