import { parentPort } from "node:worker_threads";

/**
 * Plain-JS duplicate of parseRelease() (../naming/parser.ts) and the
 * matching functions (../library/matching.ts) — same reason as
 * hashIndexWorker.mjs: a worker script runs outside Next.js's bundler and
 * path-alias resolution, so it can't `import "@/lib/..."`. Keep in sync with
 * those two files if the parsing/matching rules ever change; they stay the
 * source of truth (and what every other, non-batched call site still uses
 * directly on the main thread — this worker only exists for the hot,
 * many-releases-per-call path in autoGrab.ts/autoGrabSeries.ts's shared
 * grabRelease()).
 *
 * This is the actual CPU cost real bulk jobs (e.g. "Rechercher les
 * manquants") pay per item: parsing + fuzzy-matching every cached release
 * (up to ~175) against one target title. Measured live via
 * perf_hooks.monitorEventLoopDelay(): the main thread's event loop mean
 * delay jumped from ~20ms to a sustained 60-120ms (P99 up to 850ms) for the
 * whole duration of that job — this is what was blocking every other
 * request (even a trivial /api/health) on the single Node thread for as
 * long as the job ran. Running it in a real OS thread instead means it can
 * no longer do that, regardless of how large the library or the job gets.
 */

// ── naming/parser.ts (parseRelease) ─────────────────────────────────────

const RESOLUTION_RE = /\b(4320p|2160p|1080p|720p|480p)\b/i;
const SOURCE_RE = /\b(BluRay|Blu-Ray|BDRemux|REMUX|BDRip|BRRip|WEB-?DL|WEBRip|HDTV|PDTV|SDTV|DVDRip|DVD|CAM|TS)\b/i;
const VIDEO_CODEC_RE = /\b(x265|x264|H ?265|H ?264|HEVC|AVC10|AVC|AV1|XviD|DivX)\b/i;
const AUDIO_CODEC_RE = /\b(Atmos|DDP?5[. ]?1|DD5[. ]?1|DTS-?HD|DTS-X|DTS|TrueHD|FLAC|AAC2[. ]?0|AAC|AC3|EAC3|OPUS)\b/i;
const DV_RE = /\b(Dolby\s?Vision|DV)\b/i;
const HDR_FAMILY_RE = /\b(HDR10\+|HDR10|HDR|HLG)\b/i;
const LANGUAGE_RE = /\b(MULTI|VFQ|VFF|TRUEFRENCH|FRENCH|VOSTFR|SUBFRENCH|VOST|VFI|VF2|VF|VO)\b/i;
const SEASON_EPISODE_RANGE_RE = /\bS(\d{1,2})E(\d{1,3})(?:-E?|E)(\d{1,3})\b/i;
const SEASON_EPISODE_RE = /\bS(\d{1,2})E(\d{1,3})\b/i;
const ALT_SEASON_EPISODE_RE = /\b(\d{1,2})x(\d{1,3})\b/;
const SEASON_ONLY_RE = /\b(?:Saison|Season|Livre|Arc)\.?\s?(\d{1,2}|[IVX]{1,5})\b|\bS(\d{1,2})\b/i;
// Mirror of naming/parser.ts's SEASON_PART_RE (part marker of a
// season-split release — see parser.ts for the rationale).
const SEASON_PART_RE = /\b(?:PART|Part(?:ie)?)[.\s-]?(\d{1,2})\b/i;
// Keep in sync with SPECIAL_EPISODE_RE in src/lib/naming/parser.ts (trailing
// number optional for OVA/OAV/OAD/Special — a lot of releases never number
// their single one; "SP" alone stays digit-required, too collision-prone).
const SPECIAL_EPISODE_RE = /\b(?:OVAs?|OAVs?|OADs?|Specials?)\.?\s?(\d{1,3})?\b|\bSPs?\.?\s?(\d{1,3})\b/i;
const ROMAN_VALUES = { I: 1, V: 5, X: 10 };

function romanToInt(roman) {
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
// Mirror of naming/parser.ts's PACK_DESC_RE — the worker runs outside the
// bundler and can't import it. Keep in sync with parser.ts (single source of
// truth). Complete-series pack markers, all languages scene releases
// actually use: English, French, Italian, Spanish, Portuguese, Dutch,
// German, Polish. Single line: regex literals cannot span lines.
const PACK_DESC_RE = /\b(Complete[.\s]+(Series|Collection|Boxset|Box[.\s]Set|Seasons?|Edition|Set)|Complete|Full[.\s]+Series|Full[.\s]+Collection|Entire[.\s]+Series|All[.\s]+Seasons|Series[.\s]+Complete|Collection[.\s]+Complete|The[.\s]+Complete|Int[ée]grale|Int[ée]grale[.\s]+Compl[èe]te|Integral|Saisons?[.\s]+compl[èe]te?s?|Collection[.\s]+compl[èe]te|S[ée]rie[.\s]+compl[èe]te|Coffret[.\s]*(int[ée]gral|complet)|Toutes[.\s]+les[.\s]+saisons|La[.\s]+s[ée]rie[.\s]+compl[èe]te|Complet|Compl[èe]te|Serie[.\s]+Completa|Completa|Temporadas[.\s]+Completas|Colecci[oó]n[.\s]+Completa|Edici[oó]n[.\s]+Completa|(?:Todos?|Todas)[.\s]+(?:los|las)[.\s]+(?:episodios|temporadas)|S[ée]rie[.\s]+Compl[èe]te|S[ée]rie[.\s]+Completa|Cole[çc][ãa]o[.\s]+Completa|Temporadas[.\s]+Completas|Complete[.\s]+Serie|Compleet|Volledige[.\s]+(serie|collectie)|Alle[.\s]+seizoenen|Komplette[.\s]+Serie|Komplett|Komplettbox|Alle[.\s]+Staffeln|Komplette[.\s]+Sammlung|Wszystkie[.\s]+sezony|Pe[łl]na[.\s]+seria|Kompletna[.\s]+seria)\b/i;

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeLanguage(raw) {
  if (!raw) return null;
  const u = raw.toUpperCase();
  if (u === "MULTI") return "MULTI · VF";
  if (u === "VFQ") return "VFQ";
  if (u === "VFF" || u === "TRUEFRENCH" || u === "FRENCH" || u === "VF2" || u === "VFI") return "VF";
  if (u === "VOSTFR" || u === "SUBFRENCH") return "VOSTFR";
  if (u === "VOST") return "VOST";
  if (u === "VO") return "VO";
  return u;
}

function firstMatchIndex(source, patterns) {
  let min = source.length;
  for (const re of patterns) {
    if (!re) continue;
    const m = source.match(re);
    if (m && m.index != null && m.index < min) min = m.index;
  }
  return min;
}

function parseRelease(rawName) {
  let s = rawName.replace(VIDEO_EXT_RE, "");

  let group = null;
  const groupMatch = s.match(/-([A-Za-z0-9]+)$/);
  if (groupMatch) {
    group = groupMatch[1];
    s = s.slice(0, groupMatch.index);
  }

  const resolution = s.match(RESOLUTION_RE)?.[0]?.toLowerCase() ?? null;
  const source = s.match(SOURCE_RE)?.[0] ?? null;
  const videoCodec = s.match(VIDEO_CODEC_RE)?.[0] ?? null;
  const audioCodec = s.match(AUDIO_CODEC_RE)?.[0] ?? null;

  const hasDolbyVision = DV_RE.test(s);
  const hdrFamily = s.match(HDR_FAMILY_RE)?.[0] ?? null;
  const hdr = hasDolbyVision && hdrFamily
    ? `Dolby Vision ${hdrFamily}`
    : hasDolbyVision
      ? "Dolby Vision"
      : hdrFamily;

  const languageRaw = s.match(LANGUAGE_RE)?.[0] ?? null;
  const language = normalizeLanguage(languageRaw);

  let season = null;
  let episode = null;
  let episodeEnd = null;
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

  let seasonPart = null;
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

// ── library/matching.ts ──────────────────────────────────────────────────

const DIACRITICS_RE = new RegExp(`[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`, "g");

function normalizeTitle(s) {
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

function levenshtein(a, b) {
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

function containsAsWords(haystack, needle) {
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|\\s)${escaped}(?:\\s|$)`).test(haystack);
}

// Mirrors matching.ts's hasWholesaleWordSubstitution() — see that file for
// the full rationale (confirmed live: "How I Met Your Father" scoring ~91%
// similar to "How I Met Your Mother" by raw character distance alone).
function hasWholesaleWordSubstitution(na, nb) {
  const wa = na.split(" ").filter(Boolean);
  const wb = nb.split(" ").filter(Boolean);
  if (wa.length !== wb.length || wa.length < 2) return false;
  for (let i = 0; i < wa.length; i++) {
    if (wa[i] === wb[i]) continue;
    const wDist = levenshtein(wa[i], wb[i]);
    const wMaxLen = Math.max(wa[i].length, wb[i].length);
    if (wMaxLen === 0 || wDist / wMaxLen > 0.25) return true;
  }
  return false;
}

function titleSimilarity(a, b) {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const shorter = na.length <= nb.length ? na : nb;
  const longer = na.length <= nb.length ? nb : na;
  if (shorter.length >= 4 && containsAsWords(longer, shorter)) {
    const extraWords = longer.split(" ").filter(Boolean).length - shorter.split(" ").filter(Boolean).length;
    const shortWords = shorter.split(" ").filter(Boolean).length;
    const singleWordPenalty = shortWords <= 1 && extraWords > 0 ? 0.15 : 0;
    return Math.max(0.5, 0.9 - extraWords * 0.15 - singleWordPenalty);
  }
  const dist = levenshtein(na, nb);
  const charSim = Math.max(0, 1 - dist / Math.max(na.length, nb.length));
  if (hasWholesaleWordSubstitution(na, nb)) return Math.min(charSim, 0.5);
  return charSim;
}

const TITLE_MATCH_THRESHOLD = 0.72;

function extractTrailingSequelNumber(normalized) {
  const m = normalized.match(/^(.*\S)\s(\d{1,2})$/);
  if (!m) return null;
  return { base: m[1], num: parseInt(m[2], 10) };
}

function sequelNumbersConflict(parsedTitle, targetTitle) {
  const a = extractTrailingSequelNumber(normalizeTitle(parsedTitle));
  const b = extractTrailingSequelNumber(normalizeTitle(targetTitle));
  if (!a || !b) return false;
  return a.base === b.base && a.num !== b.num;
}

/** Mirror of matching.ts's matchesConcatenatedAlias — exact "official title +
 *  alias" concatenation (either order), the anime "localized title +
 *  romanized original title glued on" pattern. Exact-match only on purpose:
 *  it's an opt-in, admin-confirmed exception to titleSimilarity()'s
 *  extra-words penalty, not a loosening of it. */
function matchesConcatenatedAlias(parsedTitle, targetTitle, aliases) {
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

function releaseTitleMatches(parsedTitle, targetTitle, aliases = []) {
  const candidates = [targetTitle, ...aliases];
  if (candidates.some((t) => sequelNumbersConflict(parsedTitle, t))) return false;
  if (matchesConcatenatedAlias(parsedTitle, targetTitle, aliases)) return true;
  return candidates.some((t) => titleSimilarity(parsedTitle, t) >= TITLE_MATCH_THRESHOLD);
}

function yearIsCompatible(parsedYear, targetYear) {
  if (!parsedYear || !targetYear) return true;
  return Math.abs(parseInt(parsedYear, 10) - targetYear) <= 2;
}

// Mirror of matching.ts's seasonEpisodeMatches + part-pack fallback — see
// matching.ts for the full rationale (single-season series split in the DVD
// order: part P ≥ 2 covers episodes ((P-1)*partSize+1 .. min(total, P*partSize))).
function partPackEpisodeRange(totalEpisodes, partNumber) {
  const partSize = Math.ceil(totalEpisodes / partNumber);
  return { start: (partNumber - 1) * partSize + 1, end: Math.min(totalEpisodes, partNumber * partSize) };
}

function seasonEpisodeMatches(parsed, seasonNumber, episodeNumber, singleSeasonTotalEpisodes = null) {
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

// ── batch entry point ─────────────────────────────────────────────────────

/**
 * One call per grabRelease()/searchAndGrabMovie() invocation — batches every
 * cached release's parse+match against a single target so the round-trip
 * cost is paid once per item, not once per release.
 */
function matchReleases({ releases, targetTitle, aliases, targetYear, seasonNumber, episodeNumber, filterPack, partTotalEpisodes }) {
  const isSeries = seasonNumber != null;
  const step1 = releases.map((r, idx) => ({ idx, parsed: parseRelease(r.title) }));
  const step2 = step1.filter(({ parsed }) => releaseTitleMatches(parsed.title, targetTitle, aliases ?? []));
  const step3 = isSeries
    ? step2.filter(({ parsed }) => seasonEpisodeMatches(parsed, seasonNumber, filterPack ? null : episodeNumber, partTotalEpisodes ?? null))
    : step2.filter(({ parsed }) => yearIsCompatible(parsed.year, targetYear ?? null));
  const step4 = isSeries ? step3.filter(({ parsed }) => (filterPack ? parsed.episode == null : true)) : step3;

  return {
    survivors: step4.map(({ idx, parsed }) => ({ idx, parsed })),
    titleCount: step2.length,
    secondCount: step3.length,
    packCount: step4.length,
  };
}

parentPort.on("message", (input) => {
  try {
    const value = matchReleases(input);
    parentPort.postMessage({ ok: true, value });
  } catch (err) {
    parentPort.postMessage({ ok: false, error: err && err.message ? err.message : String(err) });
  }
});
