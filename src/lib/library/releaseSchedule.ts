/**
 * Shared "has this actually released yet" logic for movies/episodes — one
 * source of truth so the "upcoming" status (set at add time) and the daily
 * transition task (upcoming → missing) agree on exactly the same date.
 *
 * Movies: the VF (France) digital/physical date is what actually determines
 * whether a release could plausibly exist on an indexer — a movie can be in
 * cinemas for months before that date. Falls back to the theatrical
 * `releaseDate` only when no VF date is known yet, so a title never gets
 * stuck "upcoming" forever just because that field hasn't been resolved.
 *
 * Episodes: `airDate` is the only signal there is.
 *
 * No date at all is treated as "released" (eligible for normal search) —
 * an unknown date is not evidence the content doesn't exist yet, and
 * blocking search on missing metadata would silently strand a title.
 */

export function movieHasReleased(vfReleaseDate: string | null, releaseDate: string | null, now = Date.now()): boolean {
  const date = vfReleaseDate ?? releaseDate;
  if (!date) return true;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return true;
  return t <= now;
}

export function episodeHasAired(airDate: string | null, now = Date.now()): boolean {
  if (!airDate) return true;
  const t = new Date(airDate).getTime();
  if (Number.isNaN(t)) return true;
  return t <= now;
}

/** Whole days between now and a future ISO date — null if the date is unknown/invalid/past. */
export function daysUntil(date: string | null, now = Date.now()): number | null {
  if (!date) return null;
  const t = new Date(date).getTime();
  if (Number.isNaN(t) || t <= now) return null;
  return Math.ceil((t - now) / 86400000);
}
