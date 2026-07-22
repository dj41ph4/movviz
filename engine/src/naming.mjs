import fs from "node:fs";
import path from "node:path";
import { CONFIG_DIR } from "./config.mjs";

/**
 * Movviz naming engine (engine-side mirror of src/lib/naming on the web app).
 * Parses a release name into structured metadata and renders user-defined
 * templates into sanitized folder/file names when a download completes.
 */

const NAMING_FILE = path.join(CONFIG_DIR, "naming.json");

export const DEFAULT_TEMPLATES = {
  enabled: true,
  movieFolder: "{title} ({year})",
  movieFile: "{title} ({year}) {quality} {videoCodec} {group}",
  seriesFolder: "{title}",
  seasonFolder: "Season {season:00}",
  episodeFile: "{title} - S{season:00}E{episode:00} {quality} {videoCodec} {group}",
  useDotsInsteadOfSpaces: false,
};

export function loadNamingTemplates() {
  try {
    const raw = JSON.parse(fs.readFileSync(NAMING_FILE, "utf8"));
    return { ...DEFAULT_TEMPLATES, ...raw };
  } catch {
    return DEFAULT_TEMPLATES;
  }
}

export const VIDEO_EXT_RE = /\.(mkv|mp4|avi|ts|m2ts|wmv|mov|webm|flv)$/i;

const RESOLUTION_RE = /\b(4320p|2160p|1080p|720p|480p)\b/i;
const SOURCE_RE = /\b(BluRay|Blu-Ray|BDRemux|REMUX|BDRip|BRRip|WEB-?DL|WEBRip|HDTV|PDTV|SDTV|DVDRip|DVD|CAM|TS)\b/i;
const VIDEO_CODEC_RE = /\b(x265|x264|H ?265|H ?264|HEVC|AVC10|AVC|XviD|DivX)\b/i;
const AUDIO_CODEC_RE = /\b(Atmos|DDP?5[. ]?1|DD5[. ]?1|DTS-?HD|DTS-X|DTS|TrueHD|FLAC|AAC2[. ]?0|AAC|AC3|EAC3|OPUS)\b/i;
const HDR_RE = /\b(HDR10\+?|Dolby\s?Vision|DV|HLG|HDR)\b/i;
// Combined multi-episode file, tried before the plain single-episode
// pattern: S04E01E02, S04E01-E02, and S04E01-02 all match, capturing both
// episode numbers. The suffix requires an explicit "-" or "E" separator (not
// just bare digits) — without that, greedy backtracking on the first \d{1,3}
// would misparse an ordinary two-digit episode like "S04E03" as episode 0
// ranging to 3. A normal "S04E01.1080p..." has no such separator right after
// the number, so it correctly falls through to SEASON_EPISODE_RE below.
const SEASON_EPISODE_RANGE_RE = /\bS(\d{1,2})E(\d{1,3})(?:-E?|E)(\d{1,3})\b/i;
const SEASON_EPISODE_RE = /\bS(\d{1,2})E(\d{1,3})\b/i;
const ALT_SEASON_EPISODE_RE = /\b(\d{1,2})x(\d{1,3})\b/;
const SEASON_ONLY_RE = /\bS(\d{1,2})\b/i;
const YEAR_RE = /\b(19|20)\d{2}\b/;

function firstMatchIndex(source, patterns) {
  let min = source.length;
  for (const re of patterns) {
    if (!re) continue;
    const m = source.match(re);
    if (m && m.index != null && m.index < min) min = m.index;
  }
  return min;
}

/** Parse a scene-style release name into structured metadata. */
export function parseRelease(rawName) {
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
  const hdr = s.match(HDR_RE)?.[0] ?? null;

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
      if (seasonOnly) season = parseInt(seasonOnly[1], 10);
    }
  }

  const year = s.match(YEAR_RE)?.[0] ?? null;

  const titleEnd = firstMatchIndex(s, [
    SEASON_EPISODE_RE,
    ALT_SEASON_EPISODE_RE,
    SEASON_ONLY_RE,
    year ? new RegExp(year) : null,
    resolution ? new RegExp(resolution, "i") : null,
  ]);

  const title = s.slice(0, titleEnd).replace(/[._]/g, " ").replace(/\s+/g, " ").trim();

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

export function buildContext(info) {
  const quality = [info.source, info.resolution].filter(Boolean).join(" ");
  return { ...info, quality };
}

const TOKEN_RESOLVERS = {
  title: (c) => c.title,
  year: (c) => c.year,
  season: (c) => c.season,
  episode: (c) => c.episode,
  episodeTitle: (c) => c.episodeTitle,
  quality: (c) => c.quality,
  resolution: (c) => c.resolution,
  source: (c) => c.source,
  videoCodec: (c) => c.videoCodec,
  audioCodec: (c) => c.audioCodec,
  hdr: (c) => c.hdr,
  group: (c) => c.group,
};

const TOKEN_RE = /\{([a-zA-Z]+)(?::(0+))?\}/g;
// A bracket/paren pair with nothing but whitespace inside — left behind when
// the token it wrapped (e.g. "({year})") resolved to "".
const EMPTY_GROUP_RE = /[([]\s*[)\]]/g;

export function renderTemplate(template, ctx) {
  const rendered = template.replace(TOKEN_RE, (_match, key, pad) => {
    const resolver = TOKEN_RESOLVERS[key];
    if (!resolver) return "";
    const value = resolver(ctx);
    if (value === null || value === undefined || value === "") return "";
    if (pad) return String(value).padStart(pad.length, "0");
    return String(value);
  });
  return rendered.replace(EMPTY_GROUP_RE, "").replace(EMPTY_GROUP_RE, "");
}

const WINDOWS_ILLEGAL = /[<>:"/\\|?*\x00-\x1f]/g;
const POSIX_ILLEGAL = /[/\x00]/g;

export function sanitizeSegment(segment, useDots = false) {
  let s = segment.replace(process.platform === "win32" ? WINDOWS_ILLEGAL : POSIX_ILLEGAL, "");
  if (useDots) s = s.replace(/[()[\]{}]/g, "");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/[. ]+$/, "");
  if (useDots) s = s.replace(/ /g, ".");
  return s || "untitled";
}

export function renderSegment(template, ctx, useDots = false) {
  return sanitizeSegment(renderTemplate(template, ctx), useDots);
}
