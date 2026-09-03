import { loadPlexConfig } from "@/lib/plex/store";
import { resolveToken, getVerifiedOnDeck } from "@/lib/plex/watchWrite";
import { getPlaybackProgress } from "@/lib/playback/progressStore";

/**
 * Merge the local Movviz position with Plex's Continue Watching position.
 * Plex is queried best-effort: an unavailable Plex server must never prevent
 * local playback or erase a valid local position. getVerifiedOnDeck (not a
 * raw getPlexOnDeck call) protects a Plex Home managed profile from ever
 * being merged with the server owner's own resume position — see its doc
 * comment in watchWrite.ts.
 */
export async function mergePlexResume(
  user: Parameters<typeof resolveToken>[0],
  ratingKey: string,
  localOffsetMs: number | null,
): Promise<number | null> {
  try {
    const cfg = loadPlexConfig();
    if (!cfg.hostname) return localOffsetMs;
    const item = (await getVerifiedOnDeck(user, cfg))
      .find((candidate) => candidate.ratingKey === ratingKey);
    if (!item || item.viewOffset <= 0) return localOffsetMs;
    const local = getPlaybackProgress(user.id, ratingKey);
    const remoteAt = item.lastViewedAt ?? item.updatedAt ?? null;
    // Plex is only allowed to replace a local position when its real remote
    // clock is newer. Numeric offset is intentionally irrelevant: restarting
    // at 12% after a local 82% is a valid newer user action.
    return remoteAt != null && local?.updatedAt != null && remoteAt > local.updatedAt
      ? item.viewOffset
      : localOffsetMs;
  } catch {
    return localOffsetMs;
  }
}
