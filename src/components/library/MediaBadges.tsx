"use client";

import { cn } from "@/lib/utils";
import type { LibraryFile } from "@/lib/library/types";
import { parseRelease } from "@/lib/naming/parser";
import { detectFileLanguage } from "@/lib/library/detectLanguage";
import type { PlexLanguageSource } from "@/lib/library/detectLanguage";
import { Logo4K, LogoHDR, LogoDolbyVision, LogoDolbyAtmos, LogoDolbyDigital, LogoDolbyDigitalPlus, LogoDTS, LogoTrueHD } from "./FormatLogos";

export interface BadgeInfo {
  resolution: string | null;
  videoCodec: string | null;
  audioCodec: string | null;
  hdr: string | null;
  source: string | null;
  language?: string | null;
  /** Movie/series release year — not derived from the file at all (a title's year never changes across versions), so callers that have it (library cards) pass it in directly rather than it coming out of extractBadges(). */
  year?: number | null;
}

function extractBadges(file: LibraryFile | null | undefined, plexMediaInfo?: PlexLanguageSource | null): BadgeInfo {
  if (!file) return { resolution: null, videoCodec: null, audioCodec: null, hdr: null, source: null, language: null };

  // Always parse the basename — scene-style filenames almost always carry a
  // language tag, and it was previously only extracted here as a fallback
  // for items missing other fields, leaving the language badge inert for any
  // normally-grabbed file. Kept extensible: no term is hardcoded, parseRelease
  // already handles the full vocabulary (VF/VFQ/VOSTFR/MULTI/...).
  const basename = file.path.replace(/^.*[/\\]/, "").replace(/\.(mkv|mp4|avi|ts|m2ts|wmv|mov|webm|flv)$/i, "");
  const parsed = parseRelease(basename);

  return {
    resolution: file.resolution ?? parsed.resolution,
    videoCodec: file.videoCodec ?? parsed.videoCodec,
    audioCodec: file.audioCodec ?? parsed.audioCodec,
    hdr: file.hdr ?? parsed.hdr,
    source: file.source ?? parsed.source,
    // Persisted language (from Plex sync or detection task) takes priority,
    // then Plex stream-derived, then filename tags.
    language: file.language ?? detectFileLanguage(file, plexMediaInfo) ?? parsed.language,
  };
}

/**
 * Fixed dimensions shared by EVERY badge in the app — the pill row here, the
 * SVG logos in FormatLogos.tsx, and the poster corner chips (rating,
 * versions, status, watched) in LibraryMovieCard/LibrarySeriesCard. One
 * scale, so a resolution pill next to a Dolby logo next to a corner status
 * chip never look like three different design systems stitched together.
 */
export const BADGE_SHAPE = "inline-flex h-[21px] shrink-0 items-center gap-1 rounded-full px-2.5 text-[11px] font-bold leading-none backdrop-blur-sm";

export function TextPill({ text, cls }: { text: string; cls: string }) {
  return <span className={cn(BADGE_SHAPE, cls)}>{text}</span>;
}

/**
 * Pure badge builder shared by MediaBadges (library files) and the manual
 * search release row (raw indexer release titles) — same visual language,
 * one source of truth for the field → logo/pill mapping.
 */
export function buildMediaBadgeItems(
  { resolution, videoCodec, audioCodec, hdr, source, language, year }: BadgeInfo,
  variant: "overlay" | "surface",
  compact = false,
): React.ReactNode[] {
  // "overlay" badges sit directly on unpredictable poster artwork — a photo
  // can be bright or dark at any given corner, so their own backing must
  // stay legible either way. A translucent WHITE fill (the previous design)
  // reads fine on dark art but disappears on a light poster background —
  // a solid-enough dark scrim, by contrast, darkens whatever's behind it
  // regardless of the source image's own brightness, so white text on top
  // stays reliably readable. "surface" badges sit on the app's own
  // (already theme-aware) background instead, so they keep the softer
  // ink-toned treatment.
  const genericCls = variant === "surface" ? "border border-white/8 bg-black/20 text-ink-soft" : "border border-white/15 bg-black/55 text-white";
  const audioGenericCls = variant === "surface" ? "border border-white/8 bg-black/20 text-ink-soft" : "border border-white/10 bg-black/45 text-white/90";

  const items: React.ReactNode[] = [];

  // Every badge gets wrapped with a stable data-badge type tag. In `compact`
  // mode (below sm: only — sm: and up always renders exactly like `contents`,
  // i.e. pixel-identical to the non-compact desktop output): the technical
  // types (year/HDR/audio/video/source) are hidden outright, and the two
  // that actually matter for a quick glance at grid-thumbnail size
  // (resolution, language) shrink slightly instead of adding to the pile —
  // a poster in a 2-column mobile grid doesn't have room for 6 badges
  // wrapping across two rows on top of the artwork.
  const hiddenOnMobile = new Set(["year", "hdr", "audio", "video", "source"]);
  const tag = (type: string, key: string, node: React.ReactNode) => (
    <span
      key={key}
      data-badge={type}
      className={
        !compact
          ? "contents"
          : hiddenOnMobile.has(type)
            ? "hidden sm:contents"
            : "inline-block origin-left scale-90 sm:contents"
      }
    >
      {node}
    </span>
  );

  // Year — first, since it identifies the title itself rather than a
  // property of this particular file/release.
  if (year) {
    items.push(tag("year", "year", <TextPill text={String(year)} cls={genericCls} />));
  }

  // Resolution
  if (resolution?.startsWith("2160")) {
    items.push(tag("resolution", "res", <Logo4K />));
  } else if (resolution?.startsWith("4320")) {
    items.push(tag("resolution", "res", <TextPill text="8K" cls="bg-amber text-white" />));
  } else if (resolution) {
    const resCls = resolution.startsWith("1080") ? "bg-blue-500 text-white" : genericCls;
    items.push(tag("resolution", "res", <TextPill text={resolution} cls={resCls} />));
  }

  // HDR / Dolby Vision / SDR — a release can carry Dolby Vision AND an
  // HDR10/HDR10+/HLG tag at once, so both logos render when both are present
  // instead of only the first one matched. No HDR tag at all means SDR: scene
  // releases reliably tag HDR when it's there, so silence is a real signal,
  // not "unknown" — shown explicitly rather than left blank.
  if (hdr) {
    const hdrUpper = hdr.toUpperCase();
    const hasDolbyVision = ["DOLBY VISION", "DV"].some((v) => hdrUpper.includes(v));
    const hasHdrFamily = hdrUpper.includes("HDR") || hdrUpper.includes("HLG");
    if (hasDolbyVision) items.push(tag("hdr", "hdr-dv", <LogoDolbyVision />));
    if (hasHdrFamily) items.push(tag("hdr", "hdr-family", <LogoHDR />));
    if (!hasDolbyVision && !hasHdrFamily) {
      items.push(tag("hdr", "hdr-other", <TextPill text={hdr.replace(/\s+/g, "")} cls="bg-yellow-500 text-black" />));
    }
  }

  // Language
  if (language) {
    const isFrench = language === "VF" || language === "VFQ" || language.startsWith("MULTI");
    items.push(
      tag("language", "language", <TextPill
        text={language}
        cls={isFrench ? "border border-brand/40 bg-black/55 text-brand-glow" : genericCls}
      />),
    );
  }

  // Audio codec — logos for premium formats (Dolby, DTS, TrueHD), readable
  // labels for everything else. Maps both parser output (Atmos, EAC3, DD5.1…)
  // and Plex/ffprobe codec IDs (dca, truehd, pcm_s16le…) to a single label.
  if (audioCodec) {
    const clean = audioCodec.replace(/[. _-]/g, "").toLowerCase();
    const logoMap: Record<string, React.ReactNode> = {
      "atmos": <LogoDolbyAtmos />,
      "dolbyatmos": <LogoDolbyAtmos />,
      "eac3": <LogoDolbyDigitalPlus />,
      "ddp": <LogoDolbyDigitalPlus />,
      "ddp51": <LogoDolbyDigitalPlus />,
      "ac3": <LogoDolbyDigital />,
      "dd51": <LogoDolbyDigital />,
      "dolbydigital": <LogoDolbyDigital />,
      "truehd": <LogoTrueHD />,
      "dts": <LogoDTS />,
      "dtshd": <LogoDTS />,
      "dtsh": <LogoDTS />,
      "dtsx": <LogoDTS />,
      "dtshdma": <LogoDTS />,
      "dtshdx": <LogoDTS />,
      "dca": <LogoDTS />,
    };
    const textMap: Record<string, string> = {
      "flac": "FLAC",
      "pcm": "PCM",
      "pcm_s16le": "PCM",
      "pcm_s24le": "PCM",
      "pcm_f32le": "PCM",
      "lpcm": "PCM",
      "aac": "AAC",
      "aac20": "AAC",
      "mp3": "MP3",
      "mp2": "MP2",
      "opus": "Opus",
      "vorbis": "Vorbis",
      "wma": "WMA",
      "wmapro": "WMA Pro",
    };
    if (clean in logoMap) {
      items.push(tag("audio", "audio", logoMap[clean]));
    } else if (clean in textMap) {
      items.push(tag("audio", "audio", <TextPill text={textMap[clean]} cls={audioGenericCls} />));
    } else {
      items.push(tag("audio", "audio", <TextPill text={clean.toUpperCase()} cls={audioGenericCls} />));
    }
  }

  // Video codec
  if (videoCodec) {
    const vc = videoCodec.replace(/[. _-]/g, "").toLowerCase();
    const vcMap: Record<string, string> = {
      "x265": "HEVC", "h265": "HEVC", "hevc": "HEVC",
      "x264": "AVC", "h264": "AVC", "avc": "AVC", "avc10": "AVC",
      "av1": "AV1", "vp9": "VP9", "xvid": "XviD", "divx": "DivX",
    };
    const label = vcMap[vc] ?? videoCodec.toUpperCase();
    items.push(tag("video", "video", <TextPill text={label} cls={genericCls} />));
  }

  // Source
  if (source) {
    items.push(tag("source", "source", <TextPill text={source} cls={genericCls} />));
  }

  return items;
}

export function MediaBadges({
  file,
  plexMediaInfo,
  year,
  className,
  variant = "overlay",
  compactOnMobile = false,
}: {
  file: LibraryFile | null | undefined;
  /** Optional — when present, its audio/subtitle streams enrich/correct the filename-derived language badge. */
  plexMediaInfo?: PlexLanguageSource | null;
  /** Movie/series release year — shown as its own badge alongside the file-derived ones. */
  year?: number | null;
  className?: string;
  /**
   * "overlay" (default) is for badges sitting directly on a poster image —
   * translucent white-on-photo reads fine there regardless of site theme, so
   * it stays hardcoded. "surface" is for badges on the page's own background
   * (title page, episode rows) — those need theme-aware colors instead, or
   * they read as a near-invisible pale chip in light mode.
   */
  variant?: "overlay" | "surface";
  /**
   * Below the sm: breakpoint, shows only resolution + language (the two
   * signals actually worth a glance at grid-thumbnail size) and hides year/
   * HDR/audio/video/source — on a narrow poster in a 2-column grid, all 6+
   * badges wrapping onto two messy rows on top of the artwork was exactly
   * the "placed however, not adapted" mobile clutter this exists to fix.
   * Every badge still renders unchanged from sm: up. Opt-in (default false)
   * so only call sites that asked for the mobile cleanup are affected.
   */
  compactOnMobile?: boolean;
}) {
  // No file means no data at all — showing "SDR" here would claim the
  // absence of an HDR tag on a release that doesn't exist, not a real signal.
  if (!file) return null;
  const info = extractBadges(file, plexMediaInfo);
  const items = buildMediaBadgeItems({ ...info, year }, variant, compactOnMobile);

  if (items.length === 0) return null;

  return (
    <div className={cn("pointer-events-none flex flex-wrap items-center gap-1", className)}>
      {items}
    </div>
  );
}

/** Aggregate the "best" file info across multiple episodes for a series card. */
export function aggregateBadges(episodes: { file: LibraryFile | null }[]): LibraryFile | null {
  const withFiles = episodes.filter((e) => e.file);
  if (withFiles.length === 0) return null;

  // Pick the file with the highest resolution, then largest size as tiebreaker
  const priority = ["2160p", "4320p", "1080p", "720p", "480p"];
  const scored = withFiles.map((e) => ({
    file: e.file!,
    resIdx: priority.findIndex((r) => e.file!.resolution?.startsWith(r.slice(0, 4))),
  }));
  scored.sort((a, b) => {
    const ra = a.resIdx >= 0 ? a.resIdx : priority.length;
    const rb = b.resIdx >= 0 ? b.resIdx : priority.length;
    if (ra !== rb) return ra - rb;
    return b.file.size - a.file.size;
  });

  return scored[0].file;
}
