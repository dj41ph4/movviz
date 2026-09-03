import type { User } from "@/lib/auth/types";
import { getPlexWatchlist } from "./client";
import { addWatchlistItem } from "@/lib/watchlist/store";
import { recordSearchLog } from "@/lib/diagnostic/searchLog";

/** Pull only causally timestamped Plex watchlist additions. Absence is never
 * interpreted as removal: Plex does not expose a reliable deletion time. */
export async function syncPlexUserMedia(user: User): Promise<void> {
  if (!user.plexToken) return;
  const items = await getPlexWatchlist(user.plexToken);
  let imported = 0;
  for (const item of items) {
    if (item.tmdbId == null || item.addedAt == null) continue;
    addWatchlistItem({
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
    imported++;
  }
  recordSearchLog("info", "plex.userMediaSync", `${user.username}: ${imported} élément(s) Watchlist Plex importé(s), aucune absence distante interprétée comme suppression`);
}
