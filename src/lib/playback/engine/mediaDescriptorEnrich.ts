/**
 * TODO_POST_MOTEUR_LECTURE.md item 3 — enrich, never replace outright. The
 * existing quality badges everywhere in the app (MediaBadges.tsx, via
 * LibraryFile.resolution/videoCodec/audioCodec/hdr) are sourced from Plex
 * sync or filename parsing at grab time — both can be wrong. ffprobe reads
 * the real file, so once a MediaDescriptor exists for a movie its fields
 * are strictly more trustworthy — but only for movies that HAVE been
 * probed. A movie with no MediaDescriptor yet keeps its existing fields
 * completely untouched (no blanking, no regression) — this only ever
 * upgrades data, never removes it.
 *
 * Every string produced here is canonicalized to the exact same labels
 * MediaBadges.tsx's own codec maps output for display ("HEVC"/"AVC"/"AV1"…,
 * "TrueHD"/"DTS"/"AAC"…) rather than ffprobe's raw lowercase codec_name.
 * Both forms render identically in MediaBadges (it lowercases before
 * matching either way) — but src/lib/library/addVersionSearch.ts compares
 * `videoCodec`/`audioCodec` with a case-sensitive `===` to detect an
 * already-owned duplicate quality, so writing ffprobe's raw casing back
 * would silently break that check the next time a same-quality candidate
 * (parsed from a release filename, which uses this same canonical casing
 * convention) is evaluated against an ffprobe-enriched movie.
 */

import type { LibraryFile } from "@/lib/library/types";
import type { MediaDescriptor } from "./mediaDescriptor";

function resolutionLabel(width?: number, height?: number): string | null {
  // Bucketing by WIDTH, not height — live-verified this matters: a real
  // 3840x1604 UHD BluRay remux (RoboCop 2014, cropped for 2.39:1 cinematic
  // aspect ratio) has a height well under 2160, which a height-based bucket
  // wrongly classified as 1080p. Width survives aspect-ratio cropping in a
  // way height never does (a 4K disc is always ~3840 wide regardless of
  // black-bar cropping), matching how "4K"/"1080p"/"720p" are actually
  // defined by disc/broadcast standards in the first place. Falls back to
  // height only when width is genuinely missing.
  const w = width ?? 0;
  if (w > 0) {
    if (w >= 7600) return "4320p";
    if (w >= 3600) return "2160p";
    if (w >= 1800) return "1080p";
    if (w >= 1200) return "720p";
    return "480p";
  }
  const h = height ?? 0;
  if (h <= 0) return null;
  if (h >= 4000) return "4320p";
  if (h >= 1800) return "2160p";
  if (h >= 1000) return "1080p";
  if (h >= 650) return "720p";
  return "480p";
}

function hdrLabel(hdr: MediaDescriptor["video"]["hdr"]): string | null {
  if (!hdr) return null; // SDR — MediaBadges already treats "no hdr tag" as SDR, nothing to set
  if (hdr.type === "dolby-vision") return "Dolby Vision";
  if (hdr.type === "hdr10") return "HDR10";
  if (hdr.type === "hlg") return "HLG";
  return null;
}

// Mirrors MediaBadges.tsx's own vcMap exactly (same keys, same canonical
// output) — the single source of truth for "what a video codec is called"
// in this app.
const VIDEO_CODEC_LABEL: Record<string, string> = {
  hevc: "HEVC", h265: "HEVC", x265: "HEVC",
  h264: "AVC", avc: "AVC", avc1: "AVC", x264: "AVC",
  av1: "AV1", vp9: "VP9", xvid: "XviD", divx: "DivX",
};

function videoCodecLabel(codec: string): string | null {
  if (!codec) return null;
  const key = codec.replace(/[. _-]/g, "").toLowerCase();
  return VIDEO_CODEC_LABEL[key] ?? codec.toUpperCase();
}

// Mirrors MediaBadges.tsx's own audio logoMap/textMap keys — ffprobe's
// codec_name values (truehd/eac3/ac3/dts/aac/flac/mp3/opus/vorbis/pcm_*)
// mapped to the same canonical label scene releases (and addVersionSearch's
// duplicate check) already use.
const AUDIO_CODEC_LABEL: Record<string, string> = {
  truehd: "TrueHD",
  eac3: "EAC3",
  ac3: "AC3",
  dts: "DTS",
  aac: "AAC",
  flac: "FLAC",
  mp3: "MP3",
  mp2: "MP2",
  opus: "Opus",
  vorbis: "Vorbis",
  pcm_s16le: "PCM", pcm_s24le: "PCM", pcm_f32le: "PCM",
};

function audioCodecLabel(codec: string): string | null {
  if (!codec) return null;
  const key = codec.replace(/[. _-]/g, "").toLowerCase();
  return AUDIO_CODEC_LABEL[key] ?? codec.toUpperCase();
}

/**
 * The audio track actually worth showing as "this file's audio codec" — the
 * default track if one is flagged, otherwise the first track ffprobe
 * reported (its own natural stream order, same convention Plex/scene
 * releases use for "the main audio track").
 */
function primaryAudioCodec(descriptor: MediaDescriptor): string | null {
  const track = descriptor.audioTracks.find((t) => t.default) ?? descriptor.audioTracks[0];
  return track ? audioCodecLabel(track.codec) : null;
}

export type EnrichedFileFields = Pick<LibraryFile, "resolution" | "videoCodec" | "audioCodec" | "hdr">;

export function fileFieldsFromDescriptor(descriptor: MediaDescriptor): EnrichedFileFields {
  return {
    resolution: resolutionLabel(descriptor.video.width, descriptor.video.height),
    videoCodec: videoCodecLabel(descriptor.video.codec),
    audioCodec: primaryAudioCodec(descriptor),
    hdr: hdrLabel(descriptor.video.hdr),
  };
}
