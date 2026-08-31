import { loadPlexConfig } from "@/lib/plex/store";
import { resolveToken, getVerifiedOnDeck } from "@/lib/plex/watchWrite";

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
    return item && item.viewOffset > 0 ? item.viewOffset : localOffsetMs;
  } catch {
    return localOffsetMs;
  }
}
