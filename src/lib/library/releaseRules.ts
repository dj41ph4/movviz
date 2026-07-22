import fs from "node:fs";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";
import path from "node:path";

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
const FILE = path.join(CONFIG_DIR, "releaseRules.json");

export interface ReleaseRules {
  /** Any release whose title contains one of these (case-insensitive) is rejected outright. */
  blockedWords: string[];
  /** MB caps — null/0 means no limit. Kept separate since a season pack is naturally much larger than one episode. */
  maxMovieSizeMb: number | null;
  maxEpisodeSizeMb: number | null;
  maxSeasonSizeMb: number | null;
  /** Score bonus per codec, layered on top of resolution/source/custom-format scoring. */
  codecScores: { x264: number; x265: number; av1: number };
}

const DEFAULT_RULES: ReleaseRules = {
  blockedWords: [],
  maxMovieSizeMb: null,
  maxEpisodeSizeMb: null,
  maxSeasonSizeMb: null,
  // x265/AV1 deliver the same quality in a smaller file, so they outscore x264 by default.
  codecScores: { x264: 0, x265: 8, av1: 14 },
};

function read(): ReleaseRules {
  return { ...DEFAULT_RULES, ...readJsonCached<Partial<ReleaseRules>>(FILE, {}) };
}

function write(rules: ReleaseRules) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  writeJsonCached(FILE, rules);
}

export function loadReleaseRules(): ReleaseRules {
  return read();
}

export function saveReleaseRules(patch: Partial<ReleaseRules>): ReleaseRules {
  const next = { ...read(), ...patch };
  write(next);
  return next;
}

/** Plain substring match (case-insensitive) — "must not contain" release terms. */
export function matchesBlockedWord(title: string, rules: ReleaseRules = read()): string | null {
  const t = title.toLowerCase();
  for (const word of rules.blockedWords) {
    const w = word.trim().toLowerCase();
    if (w && t.includes(w)) return word;
  }
  return null;
}

export function normalizeCodec(rawCodec: string | null): "x264" | "x265" | "av1" | null {
  if (!rawCodec) return null;
  const c = rawCodec.toLowerCase().replace(/[\s.-]/g, "");
  if (c === "av1") return "av1";
  if (c === "x265" || c === "h265" || c === "hevc") return "x265";
  if (c === "x264" || c === "h264" || c === "avc" || c === "avc10") return "x264";
  return null;
}

export function withinSizeLimit(
  sizeBytes: number,
  kind: "movie" | "episode" | "season" | "series",
  rules: ReleaseRules = read()
): boolean {
  const limitMb =
    kind === "movie" ? rules.maxMovieSizeMb : kind === "episode" ? rules.maxEpisodeSizeMb : rules.maxSeasonSizeMb;
  if (!limitMb || !sizeBytes) return true;
  return sizeBytes <= limitMb * 1024 * 1024;
}
