/**
 * Netflix has no public API for viewing history (confirmed — the only
 * legitimate way to get it is the user's own "Compte → Activité de
 * visionnage → Télécharger tout" CSV export). This module only ever parses
 * a file the user explicitly downloaded from their own Netflix account and
 * uploaded themselves — no credentials, no scraping, no session cookies,
 * ever touch this codebase.
 */

export interface NetflixHistoryRow {
  /** Raw title exactly as Netflix wrote it — "Movie Title" or
   *  "Series Name: Season 2: Episode Title". */
  title: string;
  /** Epoch ms, or null if the date column couldn't be parsed (row still
   *  usable for matching, just without a "recent" timestamp). */
  watchedAt: number | null;
}

const MAX_ROWS = 5000;

/** Minimal RFC 4180-ish CSV line splitter — handles quoted fields (Netflix
 *  wraps a title in quotes whenever it contains a comma) and doubled-quote
 *  escaping. Not a general CSV parser, just enough for Netflix's own
 *  two-column export. */
function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuotes) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      cells.push(cur);
      cur = "";
    } else {
      cur += c;
    }
  }
  cells.push(cur);
  return cells;
}

/** Netflix's export date column is ALWAYS month/day/year, confirmed against
 *  a real French-account export ("7/27/26" — 27 can't be a month, so this
 *  is M/D/Y regardless of the account's own interface language). Falls back
 *  to day/month if the second number can't possibly be a month (>12), so a
 *  genuinely D/M/Y file (older exports, other regions) still parses instead
 *  of silently producing a wrong date. ISO (yyyy-mm-dd) tried first since
 *  it's unambiguous. */
function parseNetflixDate(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const iso = Date.parse(trimmed);
  if (!Number.isNaN(iso) && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) return iso;
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const year = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    // Default M/D/Y (a=month, b=day); if `a` can't be a month (>12), it must
    // actually be the day, so swap to D/M/Y instead.
    const [month, day] = a > 12 ? [b, a] : [a, b];
    const d = new Date(Date.UTC(year, month - 1, day));
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }
  return null;
}

/** Parses a raw Netflix "viewing activity" CSV into rows. First line is
 *  always treated as the header and skipped, regardless of its exact text
 *  (French/English/other locale exports use different column names) —
 *  Netflix's export is always title-then-date, in that column order.
 *  Bounded to MAX_ROWS so a huge file can't turn one import into an
 *  unbounded batch of TMDb lookups. */
export function parseNetflixCsv(csv: string): NetflixHistoryRow[] {
  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const rows: NetflixHistoryRow[] = [];
  for (const line of lines.slice(1, 1 + MAX_ROWS)) {
    const cells = parseCsvLine(line);
    const title = (cells[0] ?? "").trim();
    if (!title) continue;
    rows.push({ title, watchedAt: parseNetflixDate(cells[1] ?? "") });
  }
  return rows;
}

export interface ClassifiedTitle {
  kind: "movie" | "episode";
  movieTitle?: string;
  seriesTitle?: string;
  seasonNumber?: number;
  episodeTitle?: string;
}

// Bug fix (confirmed live against a real export): the original rule ("any
// digit in segment 1 = season number") wrongly treated "Épisode 24"/
// "Episode 24" as SEASON 24 — Netflix uses that exact shape for shows with
// no real season structure ("Gloutons & Dragons: Épisode 24 : Raviolis...")
// where the digit is an episode number, not a season, and TMDb obviously
// has no season 24. Only a recognized season-ish KEYWORD next to the digit
// ("Saison"/"Season"/"Partie"/"Part"/"Volume", all real Netflix season-
// grouping labels) is trusted as an actual season number now; a bare
// "Épisode N"/"Episode N" segment is treated the same as a no-digit
// anthology segment (see below) instead.
const SEASON_LABEL_RE = /(?:saison|season|partie|part|volume|vol)\.?\s*(\d+)/i;
const BARE_EPISODE_LABEL_RE = /^[eé]pisode\s*\d+$/i;

/** Splits a Netflix title into a movie OR a series/season/episode. Netflix
 *  always separates hierarchy levels with ": " (colon-space) — a title with
 *  fewer than 3 segments is a movie (a bare title, or a 2-segment title we
 *  don't try to guess at rather than risk misclassifying — a real 2-segment
 *  "Series: Episode" with no season label at all, e.g. "Batman: The
 *  Animated Series: L'homme invisible" collapsed to 2 parts, is instead
 *  recovered downstream when the movie search fails and the title resolver
 *  itself retries as a series, see resolveTitle.ts / importHistory.ts).
 *  For 3+ segments, segment 1 (the would-be season label) is checked:
 *  - a recognized season keyword + digit ("Saison 5", "Partie 2") → segment
 *    0 = series, segment 1 = season number, everything after = episode.
 *  - a BARE "Épisode N" with nothing else → not a season at all: segment 0
 *    = series, season defaults to 1, everything AFTER "Épisode N" is the
 *    episode title (matching against the real TMDb episode title works
 *    better without the literal "Épisode 24" prefix baked in).
 *  - anything else (no digit, or a digit that isn't a recognized season/
 *    episode label) → segment 1 usually isn't a season label at all, it's
 *    part of a limited-series title that itself contains a colon (real
 *    example: "Monstre : L'histoire d'Ed Gein: Radioamateur" — the SHOW is
 *    "Monstre : L'histoire d'Ed Gein", there's no season label). Segments
 *    0..n-2 are rejoined as the series title, only the LAST segment is the
 *    episode, season defaults to 1. Either way, episode titles can
 *    themselves legitimately contain a colon (only the segments actually
 *    consumed as series/season are ever removed from it). */
export function classifyNetflixTitle(raw: string): ClassifiedTitle {
  const parts = raw.split(": ");
  if (parts.length < 3) return { kind: "movie", movieTitle: raw.trim() };

  const seasonLabel = parts[1].trim();
  const seasonMatch = seasonLabel.match(SEASON_LABEL_RE);
  const bareEpisode = !seasonMatch && BARE_EPISODE_LABEL_RE.test(seasonLabel);

  let seriesTitle: string;
  let seasonNumber: number;
  let episodeTitle: string;
  if (seasonMatch) {
    seriesTitle = parts[0].trim();
    seasonNumber = parseInt(seasonMatch[1], 10);
    episodeTitle = parts.slice(2).join(": ").trim();
  } else if (bareEpisode) {
    seriesTitle = parts[0].trim();
    seasonNumber = 1;
    episodeTitle = parts.slice(2).join(": ").trim();
  } else {
    seriesTitle = parts.slice(0, -1).join(": ").trim();
    seasonNumber = 1;
    episodeTitle = parts[parts.length - 1].trim();
  }

  if (!seriesTitle || !episodeTitle) return { kind: "movie", movieTitle: raw.trim() };
  return { kind: "episode", seriesTitle, seasonNumber, episodeTitle };
}
