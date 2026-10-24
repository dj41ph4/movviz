import { getCachedVerifiedOnDeck } from "@/lib/plex/watchWrite";
import { getPlaybackProgress } from "@/lib/playback/progressStore";
import type { User } from "@/lib/auth/types";

/**
 * Merge the local Movviz position with Plex's Continue Watching position.
 * Only an already verified Plex snapshot may enrich the local position.
 * Starting a player never makes a Plex network request or waits for one.
 */
export function mergePlexResume(
  user: User,
  ratingKey: string,
  localOffsetMs: number | null,
): number | null {
  const item = getCachedVerifiedOnDeck(user.id).find((candidate) => candidate.ratingKey === ratingKey);
  if (!item || item.viewOffset <= 0) return localOffsetMs;
  const local = getPlaybackProgress(user.id, ratingKey);
  const remoteAt = item.lastViewedAt ?? item.updatedAt ?? null;
  // Plex may replace a local position only when its clock is newer. A later
  // restart at 12% legitimately beats an older local 82%.
  return remoteAt != null && (local?.updatedAt == null || remoteAt > local.updatedAt)
    ? item.viewOffset
    : localOffsetMs;
}
