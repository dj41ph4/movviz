import type { ReleaseInfo } from "@/lib/naming/types";

/**
 * Release-to-library matching — the piece most naive downloaders skip:
 * a text search against an indexer returns whatever it thinks is
 * relevant, not necessarily the exact title asked for. Grabbing the top-scored
 * result without checking it's actually the right movie/show is how you end up
 * downloading the wrong thing. This module gates candidates by parsed title
 * (fuzzy, accent/punctuation-insensitive), release year (movies), and season/
 * episode number (series) before scoring ever comes into play.
 */

// Combining diacritical marks (U+0300-U+036F), built from code points to
// avoid embedding literal combining characters in source.
const DIACRITICS_RE = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  "g"
);

export function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(DIACRITICS_RE, "")
    .replace(/&/g, "and")
    .replace(/\+/g, " plus ")
    .replace(/[‘’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/^(the|a|an)\s+/, "")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  let prev = new Array(n + 1);
  let curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * Whole-word containment: "the office" contains "office", but "chi" must
 * NOT be considered contained in "machina" just because the letters appear
 * in sequence mid-word. Word-boundary anchored so short titles (a real
 * hazard after normalizeTitle strips "the"/"a"/"an" down to a 3-4 letter
 * word) can't silently swallow unrelated longer ones.
 */
function containsAsWords(haystack: string, needle: string): boolean {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(haystack);
}

/**
 * Whole-string character-edit-distance is blind to a wholesale word
 * substitution when the differing word happens to be similar in spelling
 * and length — confirmed live: "How I Met Your Father" (a real, unrelated
 * spin-off show) scored ~91% similar to a search for "How I Met Your
 * Mother" by raw Levenshtein distance alone, comfortably above the match
 * threshold, because "father"/"mother" differ by only 2 of 6 characters
 * relative to the full ~22-character title. When both titles have the same
 * word count, a single word that isn't at least a plausible spelling
 * variant of its counterpart (typo/accent difference, not a different word
 * entirely) is disqualifying on its own, regardless of how close the
 * character-level ratio makes the two strings look overall.
 */
function hasWholesaleWordSubstitution(na: string, nb: string): boolean {
  const wa = na.split(" ").filter(Boolean);
  const wb = nb.split(" ").filter(Boolean);
  if (wa.length !== wb.length || wa.length < 2) return false;
  for (let i = 0; i < wa.length; i++) {
    if (wa[i] === wb[i]) continue;
    const wDist = levenshtein(wa[i], wb[i]);
    const wMaxLen = Math.max(wa[i].length, wb[i].length);
    // A word-level edit distance under 25% of the word's own length is a
    // plausible spelling variant (e.g. "colour"/"color"); anything more is
    // a genuinely different word standing in the same position, not a
    // variant of the same one.
    if (wMaxLen === 0 || wDist / wMaxLen > 0.25) return true;
  }
  return false;
}

/** 0..1 similarity — 1 is identical, accent/case/punctuation-insensitive.
 *  Optional `yearInfo` gates the containment bonus on the release year:
 *  without it (other callers) the bonus applies whenever the title is fully
 *  contained — they enforce the year themselves right after this call. */
export function titleSimilarity(
  a: string,
  b: string,
  yearInfo?: { year: string | null; targetYear: number | null }
): number {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  // Containment is only trustworthy once the shorter title is long enough
  // that a coincidental substring match is implausible.
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  if (shorter.length >= 4 && containsAsWords(longer, shorter)) {
    // A short release title fully contained in the official one is usually
    // a real match (e.g. "Agents of Shield" inside "Marvel's Agents of
    // S.H.I.E.L.D."). But when the longer side just keeps going with extra
    // words, it's often a DIFFERENT, related title entirely — e.g. "Once
    // Upon a Time" is fully contained in "Once Upon a Time in Wonderland",
    // a distinct spin-off series, not a variant release title of the same
    // show. Scale the score down as that extra tail grows.
    const extraWords = longer.split(" ").filter(Boolean).length - shorter.split(" ").filter(Boolean).length;
    // Single-word short titles matched by containment are extremely likely
    // false positives ("Lucky" inside "Lucky Luke"), since nearly every
    // multi-word series shares its first word with something else. Penalise
    // them so only longer, more distinctive short titles pass.
    const shortWords = shorter.split(" ").filter(Boolean).length;
    const singleWordPenalty = shortWords <= 1 && extraWords > 0 ? 0.15 : 0;
    const base = Math.max(0.5, 0.9 - extraWords * 0.15 - singleWordPenalty);
    // Containment bonus: scene releases routinely DROP subtitle words, so
    // the official title is longer than the release name ("Tafiti" ⊂
    // "Tafiti - Ab durch die Wüste" — French release "Tafiti 2026 MULTi VFF
    // 1080p" parsed to the single word "Tafiti"). The extra-words penalty
    // floors those at 0.5, under the 0.72 threshold, silently rejecting the
    // only real releases of the movie. When the year agrees (or the release
    // states none), the year gate can't disambiguate, so full containment
    // wins. When the release DOES state a year that conflicts (a genuine
    // different film), the year gate below (or the caller's own
    // yearIsCompatible right after this call) still rejects it.
    const yearOk = yearIsCompatible(yearInfo?.year ?? null, yearInfo?.targetYear ?? null);
    return yearOk ? Math.max(base, 0.85) : base;
  }
  const dist = levenshtein(na, nb);
  const charSim = Math.max(0, 1 - dist / Math.max(na.length, nb.length));
  if (hasWholesaleWordSubstitution(na, nb)) return Math.min(charSim, 0.5);
  return charSim;
}

const TITLE_MATCH_THRESHOLD = 0.72;

/** Extracts a trailing sequel/part number (1-2 digits) from an already
 *  normalized title, e.g. "rush hour 3" -> { base: "rush hour", num: 3 }.
 *  Capped at 2 digits on purpose — a 4-digit trailing number is almost
 *  always a year baked into the title itself (Blade Runner 2049), not a
 *  sequel count, and treating it as one would misfire on those. */
function extractTrailingSequelNumber(normalized: string): { base: string; num: number } | null {
  const m = normalized.match(/^(.*\S)\s(\d{1,2})$/);
  if (!m) return null;
  return { base: m[1], num: parseInt(m[2], 10) };
}

/**
 * Franchise awareness: a release parsed as "Rush Hour 3" must never be
 * accepted for a search targeting "Rush Hour 4" just because the strings are
 * ~91% similar by Levenshtein distance — same protection applies to any
 * numbered sequel (Avatar 2 vs 3, John Wick 4 vs 3, Toy Story 5 vs 4, …) with
 * no franchise names hardcoded. Only fires when the two titles are identical
 * except for that trailing number, so it can never misfire on an unrelated
 * title that merely ends in a digit with nothing to compare it against
 * (e.g. "District 9", "Blade Runner 2049" against a completely different
 * target) — those have no matching "base" on the other side.
 */
export function sequelNumbersConflict(parsedTitle: string, targetTitle: string): boolean {
  const a = extractTrailingSequelNumber(normalizeTitle(parsedTitle));
  const b = extractTrailingSequelNumber(normalizeTitle(targetTitle));
  if (!a || !b) return false;
  return a.base === b.base && a.num !== b.num;
}

/** True when `parsedTitle`, once normalized, is EXACTLY the official title
 *  concatenated with one of the configured aliases (either order, single
 *  space between) — the "localized title + romanized original title glued
 *  together" pattern many anime release/fansub groups use (e.g. "Moi Quand
 *  Je Me Reincarne En Slime Tensei Shitara Slime Datta Ken"), which the
 *  extra-words penalty in titleSimilarity() above scores below threshold.
 *  Deliberately exact-match only, never fuzzy: this is an opt-in,
 *  admin-confirmed exception to that penalty, not a loosening of it — an
 *  alias must be added by a human confirming it's genuinely another name for
 *  this exact title before it has any effect. With no aliases configured
 *  (the default) this function is a no-op. */
function matchesConcatenatedAlias(parsedTitle: string, targetTitle: string, aliases: string[]): boolean {
  const np = normalizeTitle(parsedTitle);
  const nt = normalizeTitle(targetTitle);
  if (!np || !nt) return false;
  for (const alias of aliases) {
    const na = normalizeTitle(alias);
    if (!na) continue;
    if (np === `${nt} ${na}`.trim() || np === `${na} ${nt}`.trim()) return true;
  }
  return false;
}

/** Does this parsed release's title plausibly refer to the target movie/series? */
export function releaseTitleMatches(
  parsedTitle: string,
  targetTitle: string,
  aliases: string[] = [],
  yearInfo?: { year: string | null; targetYear: number | null }
): boolean {
  const candidates = [targetTitle, ...aliases];
  // A sequel-number conflict is disqualifying on its own — a close name
  // never overrides it, checked before everything below.
  if (candidates.some((t) => sequelNumbersConflict(parsedTitle, t))) return false;
  // Opt-in exact "official title + alias" concatenation, checked before the
  // fuzzy pass since that's exactly the shape the extra-words penalty rejects.
  if (matchesConcatenatedAlias(parsedTitle, targetTitle, aliases)) return true;
  return candidates.some((t) => titleSimilarity(parsedTitle, t, yearInfo) >= TITLE_MATCH_THRESHOLD);
}

interface LibraryTitleLike {
  title: string;
  year: number | null;
  originalTitle?: string | null;
  aliases?: string[];
}

/**
 * Duplicate-library-entry guard: two records describe the same title when
 * ANY of their name variants (official title, original title, aliases)
 * agree, AND the years are compatible. TMDb hosts duplicate entries (same
 * show, different tmdbId — Yellowstone 19355/73586, My Life with the Walter
 * Boys, Lucky, Berserk, One Piece, Ben 10, Scrubs, Avatar, Hot Ones…), which
 * a tmdbId-only lookup lets slip in as a second library entry. Never merges
 * reboots: different years never match.
 */
export function libraryEntriesMatch(a: LibraryTitleLike, b: LibraryTitleLike): boolean {
  if (!yearIsCompatible(a.year != null ? String(a.year) : null, b.year)) return false;
  const aNames = [a.title, a.originalTitle ?? "", ...(a.aliases ?? [])].filter(Boolean);
  const bNames = [b.title, b.originalTitle ?? "", ...(b.aliases ?? [])].filter(Boolean);
  for (const an of aNames) {
    for (const bn of bNames) {
      if (an === bn) return true;
      if (titleSimilarity(an, bn) >= TITLE_MATCH_THRESHOLD) return true;
    }
  }
  return false;
}

/** Movies: if the release states a year, it must be within 2 of the target — absent year is not disqualifying.
 *  Tolerance is 2 (not 1) to cover physical releases (BD/DVD) that lag up to two years behind the theatrical date,
 *  e.g. a German film released in 2024 whose French Blu-ray says 2026 in the release name. */
export function yearIsCompatible(parsedYear: string | null, targetYear: number | null): boolean {
  if (!parsedYear || !targetYear) return true;
  return Math.abs(parseInt(parsedYear, 10) - targetYear) <= 2;
}

/**
 * Series: the parsed season must match exactly. For a specific-episode search
 * the parsed episode must match too; for a season-pack search the release
 * must not itself be a single unrelated episode.
 *
 * Single-season part fallback (series split in the DVD order — e.g.
 * Disjointed: 1 season of 20 episodes, released as "S01.PART.01" +
 * "S02.S01.PART.02" or plainly "S01"/"S02"): a release parsed as part P ≥ 2
 * covers the tail of the season, episodes
 * ((P-1)*partSize+1 .. min(total, P*partSize)) with partSize = ceil(total/P).
 * Only active when the caller passes `singleSeasonTotalEpisodes` (i.e. the
 * series has exactly ONE season) — for any multi-season series the exact
 * season match below stays the only rule, so a real season 2 is never
 * reinterpreted as a part.
 */
export function partPackEpisodeRange(totalEpisodes: number, partNumber: number): { start: number; end: number } {
  const partSize = Math.ceil(totalEpisodes / partNumber);
  return { start: (partNumber - 1) * partSize + 1, end: Math.min(totalEpisodes, partNumber * partSize) };
}

/** Deliberately minimal structural series shape — callers pass a
 *  LibrarySeries without this module importing the store. */
export interface PartPackSeriesLike {
  seasons: Array<{ episodes: Array<unknown> }>;
}

/** Resolves a parsed release to its season-part mapping, or null when it is
 *  not a part release of a single-season series. A release parses as part P
 *  when it carries an explicit PART marker (S01.PART.02 → part 2) or when
 *  its season number is ≥ 2 while the series has a single season (S02 →
 *  part 2, the DVD-ordering convention — TMDb/TVDB aired order keeps the
 *  whole run as one season). Multi-season series always return null. */
export function partPackInfo(series: PartPackSeriesLike, parsed: ReleaseInfo): { partNumber: number; partSize: number } | null {
  if (series.seasons.length !== 1) return null;
  const total = series.seasons[0]?.episodes.length ?? 0;
  if (total < 2) return null;
  const partNumber = parsed.seasonPart ?? (parsed.season != null && parsed.season >= 2 ? parsed.season : null);
  if (partNumber == null || partNumber < 2) return null;
  const partSize = Math.ceil(total / partNumber);
  if (partSize < 1) return null;
  return { partNumber, partSize };
}

export function seasonEpisodeMatches(
  parsed: ReleaseInfo,
  seasonNumber: number,
  episodeNumber?: number | null,
  singleSeasonTotalEpisodes?: number | null
): boolean {
  if (parsed.season == null && episodeNumber === null) return true;
  const partNumber = parsed.seasonPart ?? (parsed.season != null && parsed.season !== seasonNumber ? parsed.season : null);
  if (partNumber != null && partNumber >= 2 && singleSeasonTotalEpisodes != null) {
    const { start, end } = partPackEpisodeRange(singleSeasonTotalEpisodes, partNumber);
    if (episodeNumber != null) return episodeNumber >= start && episodeNumber <= end;
    return true;
  }
  if (parsed.season !== seasonNumber) return false;
  if (episodeNumber != null) return parsed.episode === episodeNumber;
  return true;
}
