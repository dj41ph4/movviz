"use client";

import { cn } from "@/lib/utils";
import type { LibraryFile } from "@/lib/library/types";
import { parseRelease } from "@/lib/naming/parser";
import { Logo4K, LogoHDR, LogoDolbyVision, LogoDolbyAtmos, LogoDTS, LogoTrueHD } from "./FormatLogos";

/** Only the streams' language fields are needed here — narrower than the full
 *  PlexMediaInfo so callers with a partial/simplified copy (API responses
 *  that don't round-trip every field) can still pass it through as-is. */
interface PlexLanguageSource {
  audioStreams: { language: string | null }[];
  subtitleStreams: { language: string | null }[];
}

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

/**
 * Plex saw the real decoded stream, so when available it's a stronger signal
 * than a filename tag (which can simply be wrong). Deliberately coarse — VFQ
 * vs VF vs TRUEFRENCH are scene-release distinctions Plex has no concept of —
 * this only tells us what languages are actually present on the file.
 */
function deriveLanguageFromPlex(info: PlexLanguageSource | null | undefined): string | null {
  if (!info || info.audioStreams.length === 0) return null;
  const audioLangs = new Set(info.audioStreams.map((s) => (s.language ?? "").toLowerCase()).filter(Boolean));
  const hasFrenchAudio = [...audioLangs].some((l) => l.startsWith("fr"));
  const hasOtherAudio = [...audioLangs].some((l) => !l.startsWith("fr"));
  if (hasFrenchAudio && hasOtherAudio) return "MULTI · VF";
  if (hasFrenchAudio) return "VF";
  if (hasOtherAudio) {
    const hasFrenchSub = info.subtitleStreams.some((s) => (s.language ?? "").toLowerCase().startsWith("fr"));
    return hasFrenchSub ? "VOSTFR" : "VO";
  }
  return null;
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
  const plexLanguage = deriveLanguageFromPlex(plexMediaInfo);

  return {
    resolution: file.resolution ?? parsed.resolution,
    videoCodec: file.videoCodec ?? parsed.videoCodec,
    audioCodec: file.audioCodec ?? parsed.audioCodec,
    hdr: file.hdr ?? parsed.hdr,
    source: file.source ?? parsed.source,
    // Plex corrects/enriches the filename's claim rather than replacing it
    // outright when Plex has nothing to say (no media info synced yet).
    language: plexLanguage ?? parsed.language,
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

  // Year — first, since it identifies the title itself rather than a
  // property of this particular file/release.
  if (year) {
    items.push(<TextPill key="year" text={String(year)} cls={genericCls} />);
  }

  // Resolution
  if (resolution?.startsWith("2160")) {
    items.push(<Logo4K key="res" />);
  } else if (resolution?.startsWith("4320")) {
    items.push(<TextPill key="res" text="8K" cls="bg-amber text-white" />);
  } else if (resolution) {
    const resCls = resolution.startsWith("1080") ? "bg-blue-500 text-white" : genericCls;
    items.push(<TextPill key="res" text={resolution} cls={resCls} />);
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
    if (hasDolbyVision) items.push(<LogoDolbyVision key="hdr-dv" />);
    if (hasHdrFamily) items.push(<LogoHDR key="hdr-family" />);
    if (!hasDolbyVision && !hasHdrFamily) {
      items.push(<TextPill key="hdr-other" text={hdr.replace(/\s+/g, "")} cls="bg-yellow-500 text-black" />);
    }
  } else {
    items.push(<TextPill key="hdr-sdr" text="SDR" cls={genericCls} />);
  }

  // Language
  if (language) {
    const isFrench = language === "VF" || language === "VFQ" || language.startsWith("MULTI");
    items.push(
      <TextPill
        key="language"
        text={language}
        cls={isFrench ? "border border-brand/40 bg-black/55 text-brand-glow" : genericCls}
      />,
    );
  }

  // Audio codec
  if (audioCodec) {
    const upper = audioCodec.toUpperCase();
    if (upper.includes("ATMOS") || upper.includes("DOLBY")) {
      items.push(<LogoDolbyAtmos key="audio" />);
    } else if (upper.includes("DTS")) {
      items.push(<LogoDTS key="audio" />);
    } else if (/TRUEHD/i.test(audioCodec)) {
      items.push(<LogoTrueHD key="audio" />);
    } else {
      items.push(
        <TextPill key="audio" text={audioCodec.replace(/\./g, "")} cls={audioGenericCls} />,
      );
    }
  }

  // Video codec
  if (videoCodec) {
    items.push(<TextPill key="video" text={videoCodec} cls={genericCls} />);
  }

  // Source
  if (source) {
    items.push(<TextPill key="source" text={source} cls={genericCls} />);
  }

  return items;
}

export function MediaBadges({
  file,
  plexMediaInfo,
  year,
  className,
  variant = "overlay",
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
}) {
  // No file means no data at all — showing "SDR" here would claim the
  // absence of an HDR tag on a release that doesn't exist, not a real signal.
  if (!file) return null;
  const info = extractBadges(file, plexMediaInfo);
  const items = buildMediaBadgeItems({ ...info, year }, variant);

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
