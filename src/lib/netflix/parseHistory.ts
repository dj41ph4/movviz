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

/** Splits a Netflix title into a movie OR a series/season/episode. Netflix
 *  always separates hierarchy levels with ": " (colon-space) — a title with
 *  fewer than 3 segments is a movie (a bare title, or a 2-segment title we
 *  don't try to guess at rather than risk misclassifying). For 3+ segments,
 *  segment 1 (the would-be season label) is checked for a digit:
 *  - has a digit ("Saison 5", "Season 5", "Volume 4") → segment 0 = series,
 *    segment 1 = season number, everything after = episode title.
 *  - no digit → segment 1 usually isn't a season label at all, it's part of
 *    a limited-series title that itself contains a colon (real example:
 *    "Monstre : L'histoire d'Ed Gein: Radioamateur" — the SHOW is "Monstre :
 *    L'histoire d'Ed Gein", there's no season label, Netflix went straight
 *    from title to episode). Segments 0..n-2 are rejoined as the series
 *    title, only the LAST segment is the episode, season defaults to 1
 *    (limited series are single-season). Either way, episode titles can
 *    themselves legitimately contain a colon (only the segments actually
 *    consumed as series/season are ever removed from it). */
export function classifyNetflixTitle(raw: string): ClassifiedTitle {
  const parts = raw.split(": ");
  if (parts.length < 3) return { kind: "movie", movieTitle: raw.trim() };

  const seasonMatch = parts[1].trim().match(/(\d+)/);
  const seriesTitle = seasonMatch ? parts[0].trim() : parts.slice(0, -1).join(": ").trim();
  const seasonNumber = seasonMatch ? parseInt(seasonMatch[1], 10) : 1;
  const episodeTitle = (seasonMatch ? parts.slice(2) : parts.slice(-1)).join(": ").trim();

  if (!seriesTitle || !episodeTitle) return { kind: "movie", movieTitle: raw.trim() };
  return { kind: "episode", seriesTitle, seasonNumber, episodeTitle };
}
