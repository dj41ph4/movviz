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

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(DIACRITICS_RE, "")
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
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

/** 0..1 similarity — 1 is identical, accent/case/punctuation-insensitive. */
export function titleSimilarity(a: string, b: string): number {
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
    return Math.max(0.5, 0.9 - extraWords * 0.15 - singleWordPenalty);
  }
  const dist = levenshtein(na, nb);
  return Math.max(0, 1 - dist / Math.max(na.length, nb.length));
}

const TITLE_MATCH_THRESHOLD = 0.72;

/** Does this parsed release's title plausibly refer to the target movie/series? */
export function releaseTitleMatches(parsedTitle: string, targetTitle: string, aliases: string[] = []): boolean {
  const candidates = [targetTitle, ...aliases];
  return candidates.some((t) => titleSimilarity(parsedTitle, t) >= TITLE_MATCH_THRESHOLD);
}

/** Movies: if the release states a year, it must be within 1 of the target — absent year is not disqualifying. */
export function yearIsCompatible(parsedYear: string | null, targetYear: number | null): boolean {
  if (!parsedYear || !targetYear) return true;
  return Math.abs(parseInt(parsedYear, 10) - targetYear) <= 1;
}

/**
 * Series: the parsed season must match exactly. For a specific-episode search
 * the parsed episode must match too; for a season-pack search the release
 * must not itself be a single unrelated episode.
 */
export function seasonEpisodeMatches(
  parsed: ReleaseInfo,
  seasonNumber: number,
  episodeNumber?: number | null
): boolean {
  if (parsed.season !== seasonNumber) return false;
  if (episodeNumber != null) return parsed.episode === episodeNumber;
  return true;
}
