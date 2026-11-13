/**
 * Resume list shown by "Continue watching".
 *
 * The progress store keys a record by `mediaId ?? ratingKey`. The same episode
 * played once by a client that sends its Movviz media id and once by a client
 * that only sends the Plex rating key therefore ends up as two records, each
 * with its own resume position. Clients then picked one or the other depending
 * on the screen (a title page said "Resume at 03:10" while the season page
 * said "05:45"). Only the most recently played record of a given media is a
 * resume point; older twins are dropped from the list (they stay in the store).
 */
export interface ResumeEntry {
  ratingKey: string;
  mediaType: "movie" | "episode";
  tmdbId?: number;
  seasonNumber?: number;
  episodeNumber?: number;
  lastPlayedAt?: number | null;
}

function identities(entry: ResumeEntry): string[] {
  const ids = [`key:${entry.ratingKey}`];
  if (entry.tmdbId != null) {
    if (entry.mediaType === "movie") ids.push(`movie:${entry.tmdbId}`);
    else if (entry.seasonNumber != null && entry.episodeNumber != null) {
      ids.push(`episode:${entry.tmdbId}:${entry.seasonNumber}:${entry.episodeNumber}`);
    }
  }
  return ids;
}

/** Most recent first, one entry per media (same rating key, or same TMDb movie / episode). */
export function dedupeResumeEntries<T extends ResumeEntry>(entries: T[]): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const entry of [...entries].sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0))) {
    const ids = identities(entry);
    if (ids.some((id) => seen.has(id))) continue;
    for (const id of ids) seen.add(id);
    result.push(entry);
  }
  return result;
}
