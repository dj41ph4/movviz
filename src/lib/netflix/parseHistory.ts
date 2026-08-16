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

/** Netflix's export date is locale-dependent (dd/mm/yy, mm/dd/yy, yyyy-mm-dd
 *  depending on account region/language) — tries the unambiguous ISO form
 *  first, then falls back to dd/mm/yyyy (the most common real-world case
 *  for a French-first userbase), then gives up rather than guess wrong. */
function parseNetflixDate(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const iso = Date.parse(trimmed);
  if (!Number.isNaN(iso) && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) return iso;
  const m = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
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
 *  don't try to guess at rather than risk misclassifying). For 3+ segments:
 *  segment 0 = series, segment 1 = season label (a number is extracted from
 *  it, defaulting to season 1 if none found — some Netflix exports label
 *  the first season just "Series" style), and everything after that
 *  (rejoined with ": ") is the episode title — episode titles can
 *  themselves legitimately contain a colon. */
export function classifyNetflixTitle(raw: string): ClassifiedTitle {
  const parts = raw.split(": ");
  if (parts.length < 3) return { kind: "movie", movieTitle: raw.trim() };
  const seriesTitle = parts[0].trim();
  const seasonLabel = parts[1].trim();
  const episodeTitle = parts.slice(2).join(": ").trim();
  const seasonMatch = seasonLabel.match(/(\d+)/);
  const seasonNumber = seasonMatch ? parseInt(seasonMatch[1], 10) : 1;
  if (!seriesTitle || !episodeTitle) return { kind: "movie", movieTitle: raw.trim() };
  return { kind: "episode", seriesTitle, seasonNumber, episodeTitle };
}
