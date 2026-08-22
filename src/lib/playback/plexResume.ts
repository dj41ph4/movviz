import { loadPlexConfig } from "@/lib/plex/store";
import { getPlexOnDeck } from "@/lib/plex/client";
import { resolveToken } from "@/lib/plex/watchWrite";

/**
 * Merge the local Movviz position with Plex's Continue Watching position.
 * Plex is queried best-effort: an unavailable Plex server must never prevent
 * local playback or erase a valid local position.
 */
export async function mergePlexResume(
  user: Parameters<typeof resolveToken>[0],
  ratingKey: string,
  localOffsetMs: number | null,
): Promise<number | null> {
  try {
    const cfg = loadPlexConfig();
    const auth = cfg.hostname ? resolveToken(user, cfg) : null;
    if (!auth) return localOffsetMs;
    const item = (await getPlexOnDeck(cfg, auth.token, auth.managedUserId))
      .find((candidate) => candidate.ratingKey === ratingKey);
    return item && item.viewOffset > 0 ? item.viewOffset : localOffsetMs;
  } catch {
    return localOffsetMs;
  }
}
