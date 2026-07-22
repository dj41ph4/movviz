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
const HDR_RE = /\b(HDR10\+?|Dolby\s?Vision|DV|HLG|HDR)\b/i;
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
const SEASON_ONLY_RE = /\bS(\d{1,2})\b/i;
const YEAR_RE = /\b(19|20)\d{2}\b/;
const VIDEO_EXT_RE = /\.(mkv|mp4|avi|ts|m2ts|wmv|mov|webm|flv)$/i;

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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
  const hdr = s.match(HDR_RE)?.[0] ?? null;

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
      if (seasonOnly) season = parseInt(seasonOnly[1], 10);
    }
  }

  const year = s.match(YEAR_RE)?.[0] ?? null;

  const titleEnd = firstMatchIndex(s, [
    SEASON_EPISODE_RE,
    ALT_SEASON_EPISODE_RE,
    SEASON_ONLY_RE,
    year ? new RegExp(escapeRegex(year)) : null,
    resolution ? new RegExp(escapeRegex(resolution), "i") : null,
  ]);

  const title = s
    .slice(0, titleEnd)
    .replace(/[._]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    title: title || rawName,
    year,
    season,
    episode,
    episodeEnd,
    episodeTitle: null,
    resolution,
    source,
    videoCodec,
    audioCodec,
    hdr,
    group,
  };
}
