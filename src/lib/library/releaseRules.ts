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
  /**
   * Terms that cancel a blocked-word match: if the same title contains one
   * of these, the block doesn't apply. E.g. blocked "VOSTFR" + allowed
   * "FRENCH" lets "MULTi.VOSTFR+FRENCH" through (a proper multi audio track),
   * while a bare "VOSTFR" release is still rejected.
   */
  allowedWords: string[];
  /** MB caps — null/0 means no limit. Kept separate since a season pack is naturally much larger than one episode. */
  maxMovieSizeMb: number | null;
  maxEpisodeSizeMb: number | null;
  maxSeasonSizeMb: number | null;
  /** A complete-series pack ("intégrale") spans every season — naturally several times larger than a single season pack, so it needs its own (much higher, or unset) cap rather than silently reusing maxSeasonSizeMb. */
  maxSeriesSizeMb: number | null;
  /** Score bonus per codec, layered on top of resolution/source/custom-format scoring. */
  codecScores: { x264: number; x265: number; av1: number };
  /**
   * "Rechercher et remplacer"'s language-upgrade target — a normalized
   * language tag (see naming/parser.ts's normalizeLanguage: "VF", "VFQ",
   * "VOSTFR", "VOST", "VO") or null to disable this specific upgrade path
   * entirely. Deliberately a plain user preference, not a hardcoded
   * direction: a Quebec household wants the reverse of a France one, and
   * neither is "the" correct default — only which one Movviz assumes out of
   * the box (VF, matching the project's French-first default audience).
   * Symmetric by construction: any owned file whose language differs from
   * this target is eligible, regardless of which two tags are involved.
   */
  preferredLanguageUpgrade: string | null;
  /** Target video codec for search-and-replace — "x264" | "x265" | "AV1" | null (off). */
  preferredVideoCodec: string | null;
  /** Target audio codec for search-and-replace — "DTS" | "TrueHD" | "Atmos" | "AAC" | "AC3" | "EAC3" | "FLAC" | "OPUS" | null (off). */
  preferredAudioCodec: string | null;
  /** Target resolution for search-and-replace — "720p" | "1080p" | "2160p" | "4320p" | null (off). */
  preferredResolution: string | null;
  /** When enabled, autoUpgradeAll() runs periodically (every 6h) to automatically grab upgrade candidates. */
  autoUpgradeEnabled: boolean;
  /**
   * Distinct from autoUpgradeEnabled above: that one gates the background
   * job that actually RE-GRABS files. This one gates the dashboard's
   * "upgradesAvailable" row and its read-only scan
   * (/api/library/upgrade-candidates), which can take several minutes on a
   * large library even in cache-only mode — some users never open that row
   * and don't want the scan running at all. Off has no effect on the
   * background auto-upgrade job or the manual "Rechercher et remplacer"
   * panel, both unrelated to this flag.
   */
  dashboardUpgradeScanEnabled: boolean;
  /**
   * Auto-grab's size/quality selection policy among candidates that already
   * pass minScore + size-limit + blocked-word filtering — deliberately kept
   * separate from `codecScores` above (which nudges the general relevance
   * score) rather than folded into it: this only decides which of several
   * already-acceptable releases actually gets grabbed, using file size
   * normalized by codec efficiency (a 10GB x265 encode is roughly the same
   * real quality as a 20GB x264 one — see CODEC_SIZE_EFFICIENCY below), not
   * raw bytes. "balanced" reproduces the exact pre-existing sort behavior
   * (score descending, or smallest-size-first for complete-series packs) —
   * the default, so nothing changes for anyone who doesn't touch this.
   */
  sizePreference: "smaller" | "balanced" | "quality";
}

const DEFAULT_RULES: ReleaseRules = {
  blockedWords: [],
  allowedWords: [],
  maxMovieSizeMb: null,
  maxEpisodeSizeMb: null,
  maxSeasonSizeMb: null,
  maxSeriesSizeMb: null,
  // x265/AV1 deliver the same quality in a smaller file, so they outscore x264 by default.
  codecScores: { x264: 0, x265: 8, av1: 14 },
  preferredLanguageUpgrade: "VF",
  preferredVideoCodec: null,
  preferredAudioCodec: null,
  preferredResolution: null,
  autoUpgradeEnabled: false,
  dashboardUpgradeScanEnabled: true,
  sizePreference: "balanced",
};

/**
 * Approximate bitrate needed to reach the SAME perceptual quality, relative
 * to x264 = 1.0 — e.g. an x265 file at 0.55x the size of an x264 file is
 * roughly equivalent quality (real-world scene encodes vary — these are
 * midpoints of published codec-comparison studies, not a precise constant).
 * Used only to rank already-qualifying candidates by real size/quality, not
 * as a hard rule — see `sizePreference` above.
 */
const CODEC_SIZE_EFFICIENCY: Record<"x264" | "x265" | "av1", number> = {
  x264: 1,
  x265: 0.55,
  av1: 0.4,
};

/** Normalizes a release's size to its "x264-equivalent" size for the same
 *  quality, so two releases of different codecs can be compared fairly —
 *  a smaller normalized value genuinely means less real quality/size, not
 *  just fewer raw bytes. */
export function perceptualSizeBytes(sizeBytes: number, codec: string | null): number {
  const normalized = normalizeCodec(codec);
  const efficiency = normalized ? CODEC_SIZE_EFFICIENCY[normalized] : 1;
  return sizeBytes / efficiency;
}

/**
 * Primary sort for auto-grab candidates that already passed minScore/size-
 * limit/blocked-word filtering. "balanced" is the pre-existing behavior
 * (pure relevance score, unchanged) — "smaller"/"quality" re-rank by real
 * size (codec-normalized), smallest or largest first respectively. Movies,
 * episodes and season packs all share this; complete-series packs use their
 * own comparator (see autoGrabSeries.ts) since their "balanced" default was
 * already size-based, not score-based, before this setting existed.
 */
export function compareBySizePreference(
  preference: ReleaseRules["sizePreference"],
  a: { size: number; score: number; videoCodec?: string | null },
  b: { size: number; score: number; videoCodec?: string | null }
): number {
  if (preference === "balanced") return b.score - a.score;
  const aSize = perceptualSizeBytes(a.size, a.videoCodec ?? null);
  const bSize = perceptualSizeBytes(b.size, b.videoCodec ?? null);
  return preference === "smaller" ? aSize - bSize : bSize - aSize;
}

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

/**
 * Plain substring match (case-insensitive) — "must not contain" release
 * terms. A blocked match is cancelled when the title also contains one of
 * `rules.allowedWords` (e.g. "VOSTFR+FRENCH" with FRENCH whitelisted).
 */
export function matchesBlockedWord(title: string, rules: ReleaseRules = read()): string | null {
  const t = title.toLowerCase();
  for (const word of rules.blockedWords) {
    const w = word.trim().toLowerCase();
    if (!w || !t.includes(w)) continue;
    const cancelled = rules.allowedWords.some((a) => {
      const aw = a.trim().toLowerCase();
      return aw && t.includes(aw);
    });
    if (!cancelled) return word;
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
  // "series" used to fall through to maxSeasonSizeMb (no branch matched it) —
  // an intégrale is naturally several times bigger than a single season, so
  // any season cap silently rejected every real complete-series pack from
  // the automatic intégrale search while manual search (which doesn't apply
  // this filter) still showed the exact same release.
  const limitMb =
    kind === "movie" ? rules.maxMovieSizeMb
      : kind === "episode" ? rules.maxEpisodeSizeMb
      : kind === "season" ? rules.maxSeasonSizeMb
      : rules.maxSeriesSizeMb;
  if (!limitMb || !sizeBytes) return true;
  return sizeBytes <= limitMb * 1024 * 1024;
}
