import type { ReleaseInfo } from "./types";

/**
 * Release name parser — extracts structured metadata (title, year, quality,
 * codecs, release group, season/episode) from a scene-style release name using
 * the widely-used community naming conventions (dots/underscores as
 * separators, tags like 1080p/WEB-DL/x265, SxxExx season/episode markers,
 * trailing -GROUP). This is generic pattern matching, not tied to any specific
 * application.
 */

const RESOLUTION_RE = /\b(4320p|2160p|1080p|720p|480p)\b/i;
const SOURCE_RE = /\b(BluRay|Blu-Ray|BDRemux|REMUX|BDRip|BRRip|WEB-?DL|WEBRip|HDTV|PDTV|SDTV|DVDRip|DVD|CAM|TS)\b/i;
const VIDEO_CODEC_RE = /\b(x265|x264|H ?265|H ?264|HEVC|AVC10|AVC|AV1|XviD|DivX)\b/i;
const AUDIO_CODEC_RE = /\b(Atmos|DDP?5[. ]?1|DD5[. ]?1|DTS-?HD|DTS-X|DTS|TrueHD|FLAC|AAC2[. ]?0|AAC|AC3|EAC3|OPUS)\b/i;
// Dolby Vision and the HDR10/HDR10+/HLG family are independent tags a release
// can carry at the same time ("2160p Dolby Vision HDR10" masters exist) — kept
// as two separate patterns so both can be detected instead of only the first
// one matched. No "SDR" branch: absence of any HDR tag already means SDR (see
// buildMediaBadgeItems), so a release explicitly tagged SDR and one with no
// HDR tag at all are treated identically rather than needing their own case.
const DV_RE = /\b(Dolby\s?Vision|DV)\b/i;
const HDR_FAMILY_RE = /\b(HDR10\+|HDR10|HDR|HLG)\b/i;
// French-scene language tags. MULTI always bundles a French track alongside
// others, so it's treated as implying VF for scoring/badge purposes.
const LANGUAGE_RE = /\b(MULTI|VFQ|VFF|TRUEFRENCH|FRENCH|VOSTFR|SUBFRENCH|VOST|VFI|VF2|VF|VO|ITA|ITALIAN|GER|GERMAN|DEUTSCH|DUTCH|NEDERLANDS|NL|SPANISH|ESPANOL|ES|ENGLISH)\b/i;
// Combined multi-episode file, tried before the plain single-episode
// pattern: S04E01E02, S04E01-E02, and S04E01-02 all match, capturing both
// episode numbers. The suffix requires an explicit "-" or "E" separator (not
// just bare digits) — without that, greedy backtracking on the first \d{1,3}
// would misparse an ordinary two-digit episode like "S04E03" as episode 0
// ranging to 3, since "0" then "3" are both valid digit matches with no
// separator between them. A normal "S04E01.1080p..." has no such separator
// right after the number, so it correctly falls through to SEASON_EPISODE_RE.
const SEASON_EPISODE_RANGE_RE = /\bS(\d{1,2})E(\d{1,3})(?:-E?|E)(\d{1,3})\b/i;
const SEASON_EPISODE_RE = /\bS(\d{1,2})E(\d{1,3})\b/i;
const ALT_SEASON_EPISODE_RE = /\b(\d{1,2})x(\d{1,3})\b/;
// Scene names almost always use the terse "S07" code, but a chunk of
// releases (esp. English-titled packs) spell it out as "Season 7"/"Saison 7"
// instead — both forms need to resolve to the same season number, or these
// releases silently fall through with no season detected at all.
// "Arc" shows up on some anime releases in place of a season number (story
// arc numbering instead of season numbering), and "Livre" is how Kaamelott
// specifically labels its seasons — as a Roman numeral ("Livre I", "Livre
// II"...), not a plain digit — both need to resolve to the same season
// concept as "Saison"/"Season"/"S07".
const SEASON_ONLY_RE = /\b(?:Saison|Season|Livre|Arc)\.?\s?(\d{1,2}|[IVX]{1,5})\b|\bS(\d{1,2})\b/i;
// Part marker of a season-split release ("S01.PART.02", "Part 1", "Partie 2",
// "S02.S01.PART.02") — a single-season show whose releases were split in the
// DVD order (e.g. Disjointed: DVD S1 = episodes 1-10, S2 = episodes 11-20).
// The separator is strictly dot/space/dash/nothing followed by a digit, so
// plain English words like "Party" or "Departure" can never match.
const SEASON_PART_RE = /\b(?:PART|Part(?:ie)?)[.\s-]?(\d{1,2})\b/i;
// Anime specials/OVAs rarely carry a literal S00Exx marker — fansub/scene
// naming predates and never fully converged on that convention. "OVA1",
// "OAV 02", "SP03", "Special.04" etc. all mean the same thing: episode N of
// season 0. Checked only as a fallback (see below) after the normal SxxExx
// patterns fail, so a real "SP03" appearing incidentally inside an
// otherwise-normal SxxExx release name never overrides a genuine match.
// The trailing number is optional for OVA/OAV/OAD/Special: a lot of real
// releases (esp. a show with only one OAD/OVA released so far) never number
// it at all — "...Slime.2029.OAD.MULTI..." with nothing after "OAD" is a
// real release title, not an edge case. Un-numbered defaults to episode 1
// rather than staying unparsed — leaving season/episode null here let a
// genuinely-special release silently pass as a wildcard match against
// whatever season a search happened to target, so it got imported as
// "Saison 4" instead of Specials (confirmed live). "SP" alone keeps
// requiring a number (second alternative) — as a bare 2-letter word it's
// far more likely to collide with something unrelated in a release title
// than the longer, more specific OVA/OAV/OAD/Special words are.
const SPECIAL_EPISODE_RE = /\b(?:OVAs?|OAVs?|OADs?|Specials?)\.?\s?(\d{1,3})?\b|\bSPs?\.?\s?(\d{1,3})\b/i;
const ROMAN_VALUES: Record<string, number> = { I: 1, V: 5, X: 10 };

function romanToInt(roman: string): number {
  let total = 0;
  for (let i = 0; i < roman.length; i++) {
    const cur = ROMAN_VALUES[roman[i]];
    const next = ROMAN_VALUES[roman[i + 1]];
    total += next > cur ? -cur : cur;
  }
  return total;
}
const YEAR_RE = /\b(19|20)\d{2}\b/;
const VIDEO_EXT_RE = /\.(mkv|mp4|avi|ts|m2ts|wmv|mov|webm|flv)$/i;
// Complete-series pack markers, all languages scene releases actually use.
// This list is deliberately exhaustive (the mission requirement: the release
// NAME alone must identify a complete-series pack) — every marker below
// means "this release claims to cover the whole show". English, French,
// Italian, Spanish, Portuguese, Dutch, German, Polish.
// Single line: regex literals cannot span lines.
const PACK_DESC_RE = /\b(Complete[.\s]+(Series|Collection|Boxset|Box[.\s]Set|Seasons?|Edition|Set)|Complete|Full[.\s]+Series|Full[.\s]+Collection|Entire[.\s]+Series|All[.\s]+Seasons|Series[.\s]+Complete|Collection[.\s]+Complete|The[.\s]+Complete|Int[ée]grale|Int[ée]grale[.\s]+Compl[èe]te|Integral|Saisons?[.\s]+compl[èe]te?s?|Collection[.\s]+compl[èe]te|S[ée]rie[.\s]+compl[èe]te|Coffret[.\s]*(int[ée]gral|complet)|Toutes[.\s]+les[.\s]+saisons|La[.\s]+s[ée]rie[.\s]+compl[èe]te|Complet|Compl[èe]te|Serie[.\s]+Completa|Completa|Temporadas[.\s]+Completas|Colecci[oó]n[.\s]+Completa|Edici[oó]n[.\s]+Completa|(?:Todos?|Todas)[.\s]+(?:los|las)[.\s]+(?:episodios|temporadas)|S[ée]rie[.\s]+Compl[èe]te|S[ée]rie[.\s]+Completa|Cole[çc][ãa]o[.\s]+Completa|Temporadas[.\s]+Completas|Complete[.\s]+Serie|Compleet|Volledige[.\s]+(serie|collectie)|Alle[.\s]+seizoenen|Komplette[.\s]+Serie|Komplett|Komplettbox|Alle[.\s]+Staffeln|Komplette[.\s]+Sammlung|Wszystkie[.\s]+sezony|Pe[łl]na[.\s]+seria|Kompletna[.\s]+seria)\b/i;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** MULTI always bundles a French track, so it's surfaced as "MULTI · VF" rather than just "MULTI". */
function normalizeLanguage(raw: string | null): string | null {
  if (!raw) return null;
  const u = raw.toUpperCase();
  if (u === "MULTI") return "MULTI · VF";
  if (u === "VFQ") return "VFQ";
  if (u === "VFF" || u === "TRUEFRENCH" || u === "FRENCH" || u === "VF2" || u === "VFI") return "VF";
  if (u === "VOSTFR" || u === "SUBFRENCH") return "VOSTFR";
  if (u === "VOST") return "VOST";
  if (u === "VO") return "VO";
  if (u === "ITA" || u === "ITALIAN") return "ITA";
  if (u === "GER" || u === "GERMAN" || u === "DEUTSCH") return "GER";
  if (u === "DUTCH" || u === "NL" || u === "NEDERLANDS") return "NL";
  if (u === "SPANISH" || u === "ESPANOL" || u === "ES") return "ES";
  if (u === "ENGLISH") return "EN";
  return u;
}

function firstMatchIndex(source: string, patterns: (RegExp | null)[]): number {
  let min = source.length;
  for (const re of patterns) {
    if (!re) continue;
    const m = source.match(re);
    if (m && m.index != null && m.index < min) min = m.index;
  }
  return min;
}

// Every search (auto-grab, manual search, bulk "search missing") re-parses
// the same ~2000 cached indexer releases from scratch — parseRelease's
// output depends only on the raw string, and that string doesn't change
// between hourly RSS refreshes, so almost every call is redoing regex work
// on text it already parsed minutes ago. This is real, avoidable CPU cost on
// Node's single thread, not just something to spread out with a yield.
// Anchored on globalThis for the same reason as fsJsonCache's cache: Next.js
// compiles routes into separate bundles, so module-level state would
// otherwise exist once per bundle instead of once per process.
const g = globalThis as typeof globalThis & { __movvizParseReleaseCache?: Map<string, ReleaseInfo> };
const parseCache: Map<string, ReleaseInfo> = (g.__movvizParseReleaseCache ??= new Map());
const PARSE_CACHE_MAX = 8000;

export function parseRelease(rawName: string): ReleaseInfo {
  const cached = parseCache.get(rawName);
  if (cached) return cached;
  const result = parseReleaseUncached(rawName);
  if (parseCache.size >= PARSE_CACHE_MAX) parseCache.clear();
  parseCache.set(rawName, result);
  return result;
}

function parseReleaseUncached(rawName: string): ReleaseInfo {
  let s = rawName.replace(VIDEO_EXT_RE, "");

  // Release group: a trailing "-GROUP" segment (letters/digits only).
  let group: string | null = null;
  const groupMatch = s.match(/-([A-Za-z0-9]+)$/);
  if (groupMatch) {
    group = groupMatch[1];
    s = s.slice(0, groupMatch.index);
  }

  const resolution = s.match(RESOLUTION_RE)?.[0]?.toLowerCase() ?? null;
  const source = s.match(SOURCE_RE)?.[0] ?? null;
  const videoCodec = s.match(VIDEO_CODEC_RE)?.[0] ?? null;
  const audioCodec = s.match(AUDIO_CODEC_RE)?.[0] ?? null;

  // A release can carry Dolby Vision AND an HDR10/HDR10+/HLG tag at the same
  // time (dual-layer masters) — captured as two independent booleans rather
  // than one first-match-wins field so both show up instead of only whichever
  // tag happened to appear first in the filename.
  const hasDolbyVision = DV_RE.test(s);
  const hdrFamily = s.match(HDR_FAMILY_RE)?.[0] ?? null;
  const hdr = hasDolbyVision && hdrFamily
    ? `Dolby Vision ${hdrFamily}`
    : hasDolbyVision
      ? "Dolby Vision"
      : hdrFamily;

  const languageRaw = s.match(LANGUAGE_RE)?.[0] ?? null;
  const language = normalizeLanguage(languageRaw);

  let season: number | null = null;
  let episode: number | null = null;
  let episodeEnd: number | null = null;
  const range = s.match(SEASON_EPISODE_RANGE_RE);
  if (range && range[3] !== range[2]) {
    season = parseInt(range[1], 10);
    episode = parseInt(range[2], 10);
    episodeEnd = parseInt(range[3], 10);
  } else {
    const se = s.match(SEASON_EPISODE_RE) ?? s.match(ALT_SEASON_EPISODE_RE);
    if (se) {
      season = parseInt(se[1], 10);
      episode = parseInt(se[2], 10);
    } else {
      const seasonOnly = s.match(SEASON_ONLY_RE);
      if (seasonOnly) {
        const raw = seasonOnly[1] ?? seasonOnly[2];
        season = /^[IVX]+$/i.test(raw) ? romanToInt(raw.toUpperCase()) : parseInt(raw, 10);
      } else {
        const special = s.match(SPECIAL_EPISODE_RE);
        if (special) {
          season = 0;
          episode = special[1] ? parseInt(special[1], 10) : special[2] ? parseInt(special[2], 10) : 1;
        }
      }
    }
  }

  // Independent of the season number: "S01.PART.02" and "S02.S01.PART.02"
  // both mean "part 2" of the show's (single) season — the season prefix
  // belongs to the release's own ordering, the part number to the split.
  let seasonPart: number | null = null;
  const partMatch = s.match(SEASON_PART_RE);
  if (partMatch) seasonPart = parseInt(partMatch[1], 10);

  const isCompletePack = PACK_DESC_RE.test(s);

  const year = s.match(YEAR_RE)?.[0] ?? null;

  const titleEnd = firstMatchIndex(s, [
    SEASON_EPISODE_RE,
    ALT_SEASON_EPISODE_RE,
    SEASON_ONLY_RE,
    SEASON_PART_RE,
    SPECIAL_EPISODE_RE,
    year ? new RegExp(escapeRegex(year)) : null,
    PACK_DESC_RE,
    resolution ? new RegExp(escapeRegex(resolution), "i") : null,
    languageRaw ? new RegExp(escapeRegex(languageRaw), "i") : null,
  ]);

  const title = s
    .slice(0, titleEnd)
    .replace(/[._]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    // Cutting the title right before a spelled-out "Season 7"/"(2019" tag
    // (rather than a dot-separated "S07") often leaves a dangling separator
    // behind, e.g. "The Blacklist - " or "The Blacklist (" — strip it.
    .replace(/[-–:(\s]+$/, "")
    .trim();

  return {
    title: title || rawName,
    year,
    season,
    episode,
    episodeEnd,
    seasonPart,
    episodeTitle: null,
    resolution,
    source,
    videoCodec,
    audioCodec,
    hdr,
    language,
    group,
    isCompletePack,
  };
}
