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

/**
 * Titles that identify an episode as a scheduled-but-undated placeholder
 * rather than a real name — TVDB/TMDb pre-populate not-yet-announced
 * episodes as "TBA". Such an episode can't exist anywhere yet, so it must
 * never be searched as if released.
 */
const TBA_TITLE = /^tba(?:\s*[.:;,\-–—]+\s*.*)?$/i;

export function isTbaTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  return TBA_TITLE.test(title.trim());
}

/**
 * Single source of truth for an episode's pre-release status, with the two
 * distinct rules for "coming soon":
 * - the air date exists and is in the future → "upcoming";
 * - there is no air date at all, but the title is a TBA placeholder → still
 *   "upcoming" (scheduled, undated — nothing can exist yet).
 * Everything else keeps the historical behavior: "missing" (no date is not
 * evidence the content doesn't exist, so it stays searchable).
 */
export function episodeStatus(
  airDate: string | null,
  title: string | null | undefined,
  now = Date.now()
): "upcoming" | "missing" {
  if (!airDate) return isTbaTitle(title) ? "upcoming" : "missing";
  return episodeHasAired(airDate, now) ? "missing" : "upcoming";
}

/**
 * Season-aware version of episodeStatus(): an undated episode normally
 * defaults to "missing" (no date isn't evidence the content doesn't exist —
 * see the file header), but that's wrong once an EARLIER episode in the same
 * season is itself "upcoming" — a show can't have aired episode 6 before
 * episode 4/5 have. Any undated episode numbered after the first upcoming
 * one in the season inherits "upcoming" too, instead of showing as a
 * searchable "missing" gap. Dated episodes are never overridden by this —
 * only the "no date at all" case is ambiguous enough to infer from context.
 */
export function seasonEpisodeStatuses<T extends { episodeNumber: number; airDate: string | null; title?: string | null }>(
  episodes: readonly T[],
  now = Date.now()
): Map<number, "upcoming" | "missing"> {
  const sorted = [...episodes].sort((a, b) => a.episodeNumber - b.episodeNumber);
  const result = new Map<number, "upcoming" | "missing">();
  let sawUpcoming = false;
  for (const ep of sorted) {
    let status = episodeStatus(ep.airDate, ep.title, now);
    if (status === "missing" && !ep.airDate && sawUpcoming) status = "upcoming";
    if (status === "upcoming") sawUpcoming = true;
    result.set(ep.episodeNumber, status);
  }
  return result;
}

/** Whole days between now and a future ISO date — null if the date is unknown/invalid/past. */
export function daysUntil(date: string | null, now = Date.now()): number | null {
  if (!date) return null;
  const t = new Date(date).getTime();
  if (Number.isNaN(t) || t <= now) return null;
  return Math.ceil((t - now) / 86400000);
}
