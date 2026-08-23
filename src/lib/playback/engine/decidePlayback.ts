/**
 * Phase 4 of the playback engine rewrite (see PLAN_REFONTE_MOTEUR_LECTURE_MOVVIZ.md
 * §20-29). A pure function: no ffmpeg, no file I/O, no Plex call, no network
 * request, no player manipulation — it takes data and returns a decision.
 * Not wired into the live player yet (that's Phase 9+); nothing calls this
 * except its own tests (decidePlayback.test.ts) today.
 *
 * The three absolute rules this file exists to enforce (plan §1.2-1.4),
 * repeated here because they're easy to accidentally violate by "just
 * transcoding everything when something's wrong":
 *   - An audio incompatibility never forces a video transcode.
 *   - A container incompatibility never forces a codec transcode (remux only).
 *   - Subtitle burn-in is the last resort, after direct/extract/convert.
 */

import type { AudioTrack, MediaDescriptor, SubtitleTrack, VideoStreamDescriptor } from "./mediaDescriptor";
import type { AudioCapability, ClientPlaybackProfile, VideoCapability } from "./clientProfile";
import type { ServerPlaybackCapabilities } from "./serverCapabilities";
import type { PlaybackPlan, PlaybackReasonCode, SubtitleAction } from "./playbackPlan";

export interface DecidePlaybackInput {
  media: MediaDescriptor;
  client: ClientPlaybackProfile;
  server: ServerPlaybackCapabilities;
  /** AudioTrack.index — falls back to the descriptor's own default/first track when omitted. */
  selectedAudio?: number;
  /** SubtitleTrack.index, or null/undefined for "no subtitles". */
  selectedSubtitle?: number | null;
  quality?: "original" | "auto" | "4k" | "1440p" | "1080p" | "720p";
  network?: { maxBitrateKbps?: number };
}

function normalizeCodecName(codec: string): string {
  return codec.replace(/[. _-]/g, "").toLowerCase();
}

// ffprobe's own format_name is a comma-separated list of container aliases
// ("matroska,webm", "mov,mp4,m4a,3gp,3g2,mj2") — bucket into the one family
// name a ClientPlaybackProfile.containers entry is expected to use.
function containerFamily(rawContainer: string): string {
  const c = rawContainer.toLowerCase();
  if (c.includes("matroska") || c.includes("webm")) return "mkv";
  if (c.includes("mp4") || c.includes("mov") || c.includes("m4a") || c.includes("3gp")) return "mp4";
  if (c.includes("avi")) return "avi";
  if (c.includes("mpegts") || c.includes("m2ts")) return "ts";
  return c;
}

function isContainerCompatible(rawContainer: string, client: ClientPlaybackProfile): boolean {
  const family = containerFamily(rawContainer);
  return client.containers.some((c) => containerFamily(c) === family);
}

interface CompatibilityResult {
  compatible: boolean;
  reasons: PlaybackReasonCode[];
  /** Set when the HDR mismatch has no cheaper fix than converting to SDR
   *  (§29) — see the HDR block below for exactly when this applies. */
  toneMapNeeded?: boolean;
}

/** Ordered per plan §23 steps 4-10: codec → profile → level → bit depth → HDR/DV → resolution → FPS. */
function checkVideoCompatibility(video: VideoStreamDescriptor, client: ClientPlaybackProfile): CompatibilityResult {
  const reasons: PlaybackReasonCode[] = [];
  const cap = client.videoCapabilities.find((c) => normalizeCodecName(c.codec) === normalizeCodecName(video.codec));
  if (!cap) return { compatible: false, reasons: ["VIDEO_CODEC_UNSUPPORTED"] };

  if (cap.profiles && video.profile && !cap.profiles.includes(video.profile)) {
    reasons.push("VIDEO_PROFILE_UNSUPPORTED");
  }
  if (cap.levels && video.level && !cap.levels.includes(video.level)) {
    reasons.push("VIDEO_LEVEL_UNSUPPORTED");
  }
  if (cap.bitDepths && video.bitDepth && !cap.bitDepths.includes(video.bitDepth)) {
    reasons.push("VIDEO_BIT_DEPTH_UNSUPPORTED");
  }
  let toneMapNeeded = false;
  if (video.hdr) {
    const supportedHdr = cap.hdr ?? [];
    const directMatch = supportedHdr.includes(video.hdr.type);
    // §29 — a backward-compatible Dolby Vision file (profile 7/8 with a real
    // base-layer compatibility id) is perfectly playable on a client that
    // only declares HDR10/SDR/HLG support: a non-DV decoder just renders
    // the base layer using its own baked-in colorimetry and ignores the DV
    // RPU metadata entirely. Confirmed against real ffprobe output (RoboCop
    // 2014, dv_profile=8, dv_bl_signal_compatibility_id=1→hdr10) — forcing
    // a transcode here would waste CPU re-encoding a file that already
    // plays correctly. A non-backward-compatible profile (5, no base-layer
    // id) has no such fallback and keeps the normal incompatible path.
    const dvFallback = video.hdr.type === "dolby-vision" && video.hdr.dolbyVisionBaseLayerCompatibility && supportedHdr.includes(video.hdr.dolbyVisionBaseLayerCompatibility);
    if (!directMatch && !dvFallback) {
      reasons.push(video.hdr.type === "dolby-vision" ? "DOLBY_VISION_UNSUPPORTED" : "HDR_UNSUPPORTED");
      // No exact match and no DV base-layer fallback landed on something the
      // client declared — the only remaining universal target is SDR.
      // Converting between two different HDR encodings (client=hlg,
      // source=hdr10) without passing through SDR is out of scope here.
      toneMapNeeded = true;
    }
  }
  const maxWidth = cap.maxWidth ?? client.maxWidth;
  const maxHeight = cap.maxHeight ?? client.maxHeight;
  if ((maxWidth && video.width && video.width > maxWidth) || (maxHeight && video.height && video.height > maxHeight)) {
    reasons.push("VIDEO_RESOLUTION_UNSUPPORTED");
  }
  if (cap.maxFps && video.fps && video.fps > cap.maxFps) {
    reasons.push("VIDEO_FPS_UNSUPPORTED");
  }
  return { compatible: reasons.length === 0, reasons, toneMapNeeded };
}

/** Steps 11-12: audio codec → channel count. */
function checkAudioCompatibility(track: AudioTrack, client: ClientPlaybackProfile): CompatibilityResult {
  const cap = client.audioCapabilities.find((c) => normalizeCodecName(c.codec) === normalizeCodecName(track.codec));
  if (!cap || !(cap.decode || cap.passthrough)) return { compatible: false, reasons: ["AUDIO_CODEC_UNSUPPORTED"] };

  const reasons: PlaybackReasonCode[] = [];
  if (cap.maxChannels && track.channels && track.channels > cap.maxChannels) {
    reasons.push("AUDIO_CHANNELS_UNSUPPORTED");
  }
  return { compatible: reasons.length === 0, reasons };
}

/** Plan §28 pipeline: DIRECT → EXTRACT → CONVERT → BURN, in that order — burn only when nothing else can render it. */
function decideSubtitleAction(track: SubtitleTrack | null, client: ClientPlaybackProfile): SubtitleAction {
  if (!track) return "NONE";
  const cap = client.subtitleCapabilities.find((c) => normalizeCodecName(c.codec) === normalizeCodecName(track.codec));

  if (track.type === "image") {
    // PGS/VobSub — a client that can render image subs itself is rare but
    // real (some TV platforms); everyone else needs a burn.
    return cap?.embeddedSupported ? "DIRECT" : "BURN";
  }
  if (cap?.nativeRender) return "DIRECT";
  if (cap?.externalSupported) return "EXTRACT";
  if (cap?.convertible) return "CONVERT";
  return "BURN";
}

function selectAudioTrack(media: MediaDescriptor, selectedIndex?: number): AudioTrack | null {
  if (selectedIndex !== undefined) {
    const explicit = media.audioTracks.find((t) => t.index === selectedIndex);
    if (explicit) return explicit;
  }
  return media.audioTracks.find((t) => t.default) ?? media.audioTracks[0] ?? null;
}

function selectSubtitleTrack(media: MediaDescriptor, selectedIndex: number | null | undefined): SubtitleTrack | null {
  if (selectedIndex === null || selectedIndex === undefined) return null;
  return media.subtitleTracks.find((t) => t.index === selectedIndex) ?? null;
}

/** The client's own best-supported video codec, for a forced transcode target — falls back to h264 as the universal baseline every decoder handles. */
function pickTranscodeVideoCodec(client: ClientPlaybackProfile): string {
  const preferenceOrder = ["av1", "hevc", "h264"];
  for (const codec of preferenceOrder) {
    if (client.videoCapabilities.some((c) => normalizeCodecName(c.codec) === codec)) return codec;
  }
  return client.videoCapabilities[0]?.codec ?? "h264";
}

// One software fallback encoder per codec family, all confirmed present on
// a real ffmpeg build during Phase 6 testing — libsvtav1 specifically over
// libaom-av1 because it's the realtime-capable one (libaom-av1 is far too
// slow for this exact "don't fall behind playback" problem).
const SOFTWARE_ENCODER: Record<string, string> = { h264: "libx264", hevc: "libx265", av1: "libsvtav1" };
// TODO_POST_MOTEUR_LECTURE.md item 4 — matches Plex Media Server's own
// default x264 preset for the same reason: fast enough to stay ahead of
// real-time playback on a weak server (e.g. an underpowered Synology with no
// hardware encoder) without collapsing quality as hard as ultrafast/superfast.
const SOFTWARE_ENCODER_PRESET = "veryfast";
const HARDWARE_SUFFIXES = ["_nvenc", "_qsv", "_vaapi", "_amf"];

/**
 * TODO_POST_MOTEUR_LECTURE.md item 4 — picks the actual ffmpeg -c:v
 * implementation for a forced video transcode, preferring hardware over
 * software whenever the server's own compiled encoder list (Phase 6, real
 * `ffmpeg -encoders` output — never guessed from the hardwareAcceleration
 * booleans alone, since e.g. h264_nvenc existing says nothing about
 * hevc_nvenc existing) actually has one for this exact codec. Falls back to
 * a fast software preset only when no hardware encoder is available at all —
 * the "weak Synology" case this item exists to cover.
 */
function pickVideoEncoderImpl(codec: string, server: ServerPlaybackCapabilities): { impl: string; preset?: string } {
  const hwCandidate = HARDWARE_SUFFIXES.map((suffix) => `${codec}${suffix}`).find((name) => server.videoEncoders.includes(name));
  if (hwCandidate) return { impl: hwCandidate };
  const impl = SOFTWARE_ENCODER[codec] ?? `lib${codec}`;
  return { impl, preset: SOFTWARE_ENCODER_PRESET };
}

function pickTranscodeAudioCodec(client: ClientPlaybackProfile): string {
  // aac is the one codec every real client in this app already declares
  // decode:true for (see clientProfile.detect.ts) — the safe universal target.
  const hasAac = client.audioCapabilities.some((c) => normalizeCodecName(c.codec) === "aac" && c.decode);
  return hasAac ? "aac" : (client.audioCapabilities[0]?.codec ?? "aac");
}

export function decidePlayback(input: DecidePlaybackInput): PlaybackPlan {
  const { media, client, server } = input;
  const reasons: PlaybackReasonCode[] = [];

  const audioTrack = selectAudioTrack(media, input.selectedAudio);
  const subtitleTrack = selectSubtitleTrack(media, input.selectedSubtitle);

  const videoCheck = checkVideoCompatibility(media.video, client);
  const audioCheck = audioTrack ? checkAudioCompatibility(audioTrack, client) : { compatible: true, reasons: [] as PlaybackReasonCode[] };
  const containerOk = isContainerCompatible(media.container, client);
  const subtitleAction = decideSubtitleAction(subtitleTrack, client);

  reasons.push(...videoCheck.reasons, ...audioCheck.reasons);
  if (!containerOk) reasons.push("CONTAINER_UNSUPPORTED");
  if (subtitleAction === "BURN") reasons.push("SUBTITLE_BURN_REQUIRED");

  // Rule §1.4: burn-in is itself a video transcode — folded in here, not
  // treated as a separate later step, so it goes through the exact same
  // ffmpeg-availability gate as any other forced video transcode below.
  const needsVideoTranscode = !videoCheck.compatible || subtitleAction === "BURN";
  const needsAudioTranscode = !audioCheck.compatible;
  // Rule §1.3: a container-only mismatch is a remux, never promoted to a
  // codec transcode — only reached when video didn't already need one.
  const needsRemuxOnly = !containerOk && !needsVideoTranscode;

  if (needsVideoTranscode) {
    if (!server.ffmpegAvailable) {
      return {
        mode: "PLEX_FALLBACK",
        containerAction: "REMUX",
        targetContainer: "mp4",
        videoAction: "TRANSCODE",
        audioAction: needsAudioTranscode ? "TRANSCODE" : "COPY",
        targetAudioCodec: needsAudioTranscode ? pickTranscodeAudioCodec(client) : undefined,
        subtitleAction,
        reasons: [...reasons, "FFMPEG_UNAVAILABLE", "PLEX_FALLBACK_REQUESTED"],
      };
    }
    const targetVideoCodec = pickTranscodeVideoCodec(client);
    const encoder = pickVideoEncoderImpl(targetVideoCodec, server);
    return {
      mode: "TRANSCODE",
      containerAction: "REMUX",
      targetContainer: "mp4",
      videoAction: "TRANSCODE",
      targetVideoCodec,
      videoEncoderImpl: encoder.impl,
      encoderPreset: encoder.preset,
      toneMap: videoCheck.toneMapNeeded || undefined,
      audioAction: needsAudioTranscode ? "TRANSCODE" : "COPY",
      targetAudioCodec: needsAudioTranscode ? pickTranscodeAudioCodec(client) : undefined,
      subtitleAction,
      protocol: client.protocols.hls ? "HLS" : "PROGRESSIVE",
      reasons,
    };
  }

  if (needsAudioTranscode) {
    if (!server.ffmpegAvailable) {
      return {
        mode: "PLEX_FALLBACK",
        containerAction: needsRemuxOnly ? "REMUX" : "COPY",
        targetContainer: needsRemuxOnly ? "mp4" : undefined,
        videoAction: "COPY",
        audioAction: "TRANSCODE",
        subtitleAction,
        reasons: [...reasons, "FFMPEG_UNAVAILABLE", "PLEX_FALLBACK_REQUESTED"],
      };
    }
    return {
      mode: "DIRECT_STREAM",
      containerAction: needsRemuxOnly ? "REMUX" : "COPY",
      targetContainer: needsRemuxOnly ? "mp4" : undefined,
      videoAction: "COPY",
      audioAction: "TRANSCODE",
      targetAudioCodec: pickTranscodeAudioCodec(client),
      subtitleAction,
      protocol: "PROGRESSIVE",
      reasons,
    };
  }

  if (needsRemuxOnly) {
    return {
      mode: "REMUX",
      containerAction: "REMUX",
      targetContainer: "mp4",
      videoAction: "COPY",
      audioAction: "COPY",
      subtitleAction,
      protocol: "PROGRESSIVE",
      reasons,
    };
  }

  return {
    mode: "DIRECT_PLAY",
    containerAction: "COPY",
    videoAction: "COPY",
    audioAction: "COPY",
    subtitleAction,
    protocol: "PROGRESSIVE",
    reasons,
  };
}
