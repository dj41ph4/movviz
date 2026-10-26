import { discoverByFilters } from "./tmdb";
import type { MetaSearchResult } from "./types";

/**
 * « Prochainement » — every film with a real announced release date, as
 * opposed to « Vos prochaines sorties » (the user's own requests not out
 * yet). Bounded to the next 12 months: further out, a TMDb date is usually a
 * placeholder for a project that may never ship.
 */
export const ANNOUNCED_HORIZON_MONTHS = 12;
const PAGES = 5;
/** TMDb « Documentaire » — pas de documentaires dans « Prochainement ». */
const DOCUMENTARY_GENRE_ID = 99;
const MEMO_TTL_MS = 30 * 60_000;

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function announcedWindow(now: Date): { from: string; to: string } {
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() + 1);
  const to = new Date(now);
  to.setUTCMonth(to.getUTCMonth() + ANNOUNCED_HORIZON_MONTHS);
  return { from: isoDay(from), to: isoDay(to) };
}

/**
 * Keeps real announcements — a dated release inside the window, with a
 * poster for its card — in release order (most awaited first on the same day).
 */
export function selectAnnounced(results: MetaSearchResult[], now: Date): MetaSearchResult[] {
  const { from, to } = announcedWindow(now);
  const seen = new Set<number>();
  return results
    .filter((r) => {
      if (seen.has(r.tmdbId)) return false;
      seen.add(r.tmdbId);
      return !!r.releaseDate && r.releaseDate >= from && r.releaseDate <= to && !!r.posterPath
        && !r.genreIds?.includes(DOCUMENTARY_GENRE_ID);
    })
    .sort((a, b) => a.releaseDate!.localeCompare(b.releaseDate!) || (b.popularity ?? 0) - (a.popularity ?? 0));
}

const g = globalThis as unknown as { __movvizAnnounced?: { at: number; day: string; results: MetaSearchResult[] } };

export async function getAnnouncedMovies(now = new Date()): Promise<MetaSearchResult[]> {
  const day = isoDay(now);
  const memo = g.__movvizAnnounced;
  if (memo && memo.day === day && Date.now() - memo.at < MEMO_TTL_MS) return memo.results;
  const { from, to } = announcedWindow(now);
  // Most awaited first from TMDb, then re-ordered by date: the window holds
  // thousands of tiny productions, the popular pages are the announced ones.
  const pages = await Promise.all(Array.from({ length: PAGES }, (_, i) =>
    discoverByFilters("movie", { sort: "popularity.desc", releasedAfter: from, releasedBefore: to }, i + 1).catch(() => null)));
  const results = selectAnnounced(pages.flatMap((p) => p?.results ?? []), now);
  if (results.length > 0) g.__movvizAnnounced = { at: Date.now(), day, results };
  return results;
}
