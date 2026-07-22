"use client";

import { cn } from "@/lib/utils";
import type { LibraryFile } from "@/lib/library/types";
import { parseRelease } from "@/lib/naming/parser";
import { Logo4K, LogoHDR, LogoDolbyVision, LogoDolbyAtmos, LogoDTS, LogoTrueHD } from "./FormatLogos";

interface BadgeInfo {
  resolution: string | null;
  videoCodec: string | null;
  audioCodec: string | null;
  hdr: string | null;
  source: string | null;
}

function extractBadges(file: LibraryFile | null | undefined): BadgeInfo {
  if (!file) return { resolution: null, videoCodec: null, audioCodec: null, hdr: null, source: null };

  const resolution = file.resolution ?? null;
  const videoCodec = file.videoCodec ?? null;
  const audioCodec = file.audioCodec ?? null;
  const hdr = file.hdr ?? null;
  const source = file.source ?? null;

  // For items imported before these fields existed, fall back to parsing the
  // file's own basename — scene-style filenames almost always carry codec tags.
  if (!videoCodec || !audioCodec || !hdr || !source) {
    const basename = file.path.replace(/^.*[/\\]/, "").replace(/\.(mkv|mp4|avi|ts|m2ts|wmv|mov|webm|flv)$/i, "");
    const parsed = parseRelease(basename);
    return {
      resolution: resolution ?? parsed.resolution,
      videoCodec: videoCodec ?? parsed.videoCodec,
      audioCodec: audioCodec ?? parsed.audioCodec,
      hdr: hdr ?? parsed.hdr,
      source: source ?? parsed.source,
    };
  }

  return { resolution, videoCodec, audioCodec, hdr, source };
}

function TextPill({ text, cls }: { text: string; cls: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[21px] shrink-0 items-center rounded-md px-2 text-[11px] font-bold leading-none backdrop-blur-sm",
        cls,
      )}
    >
      {text}
    </span>
  );
}

export function MediaBadges({
  file,
  className,
  variant = "overlay",
}: {
  file: LibraryFile | null | undefined;
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
  const { resolution, videoCodec, audioCodec, hdr, source } = extractBadges(file);
  const genericCls = variant === "surface" ? "border border-white/8 bg-black/20 text-ink-soft" : "bg-white/15 text-white/90";
  const audioGenericCls = variant === "surface" ? "border border-white/8 bg-black/20 text-ink-soft" : "bg-white/10 text-white/80";

  const items: React.ReactNode[] = [];

  // Resolution
  if (resolution?.startsWith("2160")) {
    items.push(<Logo4K key="res" />);
  } else if (resolution?.startsWith("4320")) {
    items.push(<TextPill key="res" text="8K" cls="bg-amber/80 text-white" />);
  } else if (resolution) {
    const resCls = resolution.startsWith("1080")
      ? "bg-blue-500/80 text-white"
      : variant === "surface" ? genericCls : "bg-white/20 text-white/90";
    items.push(<TextPill key="res" text={resolution} cls={resCls} />);
  }

  // HDR
  if (hdr) {
    const hdrUpper = hdr.toUpperCase();
    if (["DOLBY VISION", "DV"].some((v) => hdrUpper.includes(v))) {
      items.push(<LogoDolbyVision key="hdr" />);
    } else if (hdrUpper.includes("HDR") || hdrUpper === "HLG") {
      items.push(<LogoHDR key="hdr" />);
    } else {
      items.push(<TextPill key="hdr" text={hdr.replace(/\s+/g, "")} cls="bg-yellow-500/80 text-black" />);
    }
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
