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

function hasHardwareEncoderForCodec(codec: string, server: ServerPlaybackCapabilities): boolean {
  return HARDWARE_SUFFIXES.some((suffix) => server.videoEncoders.includes(`${codec}${suffix}`));
}

/**
 * The video codec to transcode INTO, for a forced transcode target.
 *
 * Reproduced live on the production Synology (2026-08-24, real user report
 * "ça retranscode toutes les 5 secondes"): with no verified hardware encoder
 * (see serverCapabilities.detect.ts), picking av1 purely from the client's
 * decode preference handed libsvtav1 a real 4K→1080p encode it could not
 * keep up with — the stream's own `waiting` events, sampled live, landed
 * every ~5.3s and only advanced playback by ~2.0s each time (one GOP) — a
 * sustained ~0.38x realtime factor, not a one-off hiccup. AV1 is dramatically
 * more expensive to ENCODE in software than H.264 for the same resolution
 * (unlike decode, where the gap is much smaller) — the client's decode
 * preference says nothing about how expensive the server's own encode side
 * will be. Hardware encoding doesn't have this problem (any codec is cheap
 * once a real GPU/QSV/etc. does the work — confirmed live: av1_nvenc on a
 * real GPU stayed comfortably ahead of realtime), so the codec choice only
 * needs to change for the software-fallback case — matches Plex Media
 * Server's own long-standing default of H.264 for software transcodes, for
 * this exact reason.
 */
function pickTranscodeVideoCodec(client: ClientPlaybackProfile, server: ServerPlaybackCapabilities): string {
  const preferenceOrder = ["av1", "hevc", "h264"];
  const clientSupports = (codec: string) => client.videoCapabilities.some((c) => normalizeCodecName(c.codec) === codec);
  // Pass 1: a codec the client can decode AND the server can encode in
  // hardware — free to prefer the client's own top choice here.
  for (const codec of preferenceOrder) {
    if (clientSupports(codec) && hasHardwareEncoderForCodec(codec, server)) return codec;
  }
  // No working hardware encoder for anything the client prefers — software
  // encoding it is, and h264 is the only one fast enough in software to
  // reliably stay ahead of real-time playback (libx264 veryfast vs. libx265
  // or libsvtav1 veryfast at the same resolution). h264 decode is supported
  // by every real client (see clientProfile.detect.ts) so this is only a
  // theoretical fallback-of-the-fallback.
  if (clientSupports("h264")) return "h264";
  for (const codec of preferenceOrder) {
    if (clientSupports(codec)) return codec;
  }
  return client.videoCapabilities[0]?.codec ?? "h264";
}

// x264/x265/svtav1 presets trade compression efficiency for encode speed —
// "the less we ask the encoder to compress, the less CPU it burns finding
// how" (the same principle already behind SOFTWARE_ENCODER_PRESET, just
// pushed further for the one case that needed it). Reserved for software +
// tonemap together (see SOFTWARE_TONEMAP_MAX_WIDTH above) rather than
// applied everywhere — "veryfast" already comfortably kept up in the same
// live session for plain SDR software transcodes (no reason to trade away
// quality nobody needs), it was specifically the tonemap combination that
// fell behind. A bigger file for a case that was otherwise unplayable is a
// trade worth making.
const SOFTWARE_TONEMAP_PRESET = "ultrafast";

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
function pickVideoEncoderImpl(codec: string, server: ServerPlaybackCapabilities, needsToneMap: boolean): { impl: string; preset?: string; isHardware: boolean } {
  const hwCandidate = HARDWARE_SUFFIXES.map((suffix) => `${codec}${suffix}`).find((name) => server.videoEncoders.includes(name));
  if (hwCandidate) return { impl: hwCandidate, isHardware: true };
  const impl = SOFTWARE_ENCODER[codec] ?? `lib${codec}`;
  return { impl, preset: needsToneMap ? SOFTWARE_TONEMAP_PRESET : SOFTWARE_ENCODER_PRESET, isHardware: false };
}

// A software encoder with no hardware backend has to actually keep up with
// real-time playback on whatever CPU the server has — a 4K source encoded
// in software on a weak NAS is a real, previously-flagged risk
// (TODO_POST_MOTEUR_LECTURE.md item 4), not a hypothetical one. 1920 is the
// same practical ceiling the OLD quality-preset system already uses for its
// own "fhd" profile (remuxSession.ts FFMPEG_QUALITY_PRESETS) — a proven,
// not invented, number for "safe on modest hardware."
const SOFTWARE_TRANSCODE_MAX_WIDTH = 1920;

// Reproduced live on the real production Synology (2026-08-24, "Dragons" —
// a 4K Dolby Vision profile 8 source): even AFTER both the h264 software
// target fix and the 1920px cap above, playback still fell hopelessly
// behind real time (stuck buffering, 0 forward progress over 15+ seconds
// with zero other load on the box). The zscale/tonemap HDR→SDR chain
// (decidePlayback's own toneMap flag) does a full linear-light float32
// round-trip on every frame — a real, substantial extra cost on top of
// decode+scale+encode, confirmed by elimination: a same-resolution SDR 4K
// software transcode with no tonemap (see the "Soixante 9" case, same
// session) stayed comfortably ahead of real time at the same 1920px cap.
//
// 1280 alone (plus the ultrafast preset below) still wasn't enough — measured
// live on the same real Synology, same file, with NO other load on the box
// (confirmed via a clean re-test after the exact confound above was ruled
// out): a sustained ~0.29-0.31x realtime factor over two consecutive 22s
// windows, not a cold-start blip. Decode cost is fixed regardless of this
// target (the scale filter runs AFTER decode, so a smaller output never
// makes the decoder read fewer source pixels) — only the scale+tonemap+encode
// portion shrinks with resolution. The "Soixante 9" A/B (no tonemap, same
// decode-class 4K source, 1920px, ~1x factor) implies decode+scale+encode
// alone comfortably fit the budget, so tonemap itself is the dominant extra
// cost — and tonemap cost scales with pixel count. Closing a ~3.3x gap
// (0.3x → 1x) by shrinking only the tonemap-scaling portion needs roughly a
// sqrt(3.3)≈1.8x cut in width; 1280/1.8≈720, which also happens to be the
// standard "safe" software-HDR floor other transcoders (Plex/Jellyfin) fall
// back to for exactly this reason — not an arbitrary number, but still a
// reasoned estimate to re-verify live, not a lab-measured value.
const SOFTWARE_TONEMAP_MAX_WIDTH = 720;

/**
 * Only ever downscales — never upscales, and never touches a hardware
 * encode (a real GPU/QSV/etc. encoder handles 4K at real-time speed; the
 * risk this exists for is specifically the software fallback path).
 * Client-declared resolution incompatibility (§23 step 9,
 * VIDEO_RESOLUTION_UNSUPPORTED) always wins over the generic software-speed
 * cap when both would apply, since it's the more specific, better-known
 * constraint.
 */
function pickTargetVideoWidth(sourceWidth: number | undefined, clientMaxWidth: number | undefined, isHardwareEncoder: boolean, needsToneMap: boolean): number | undefined {
  if (!sourceWidth) return undefined;
  if (clientMaxWidth && sourceWidth > clientMaxWidth) return clientMaxWidth;
  if (isHardwareEncoder) return undefined;
  const cap = needsToneMap ? SOFTWARE_TONEMAP_MAX_WIDTH : SOFTWARE_TRANSCODE_MAX_WIDTH;
  if (sourceWidth > cap) return cap;
  return undefined;
}

/**
 * Picks the transcode target codec AND how many channels to actually mix
 * down to. A browser has no API to learn how many real speakers/channels
 * the user's output device has — assuming "the source's own channel count
 * is fine" is wrong more often than not (confirmed live: a 5.1 source
 * transcoded to 5.1 AAC with no downmix played back over a real 2.0 setup
 * with dialogue missing — the center channel, where dialogue usually
 * lives, was silently dropped instead of folded into L/R). channels stays
 * undefined only when the client's own declared cap already covers the
 * source's channel count, in which case ffmpeg is left to copy it through
 * as-is (no reason to downmix audio the client can genuinely play).
 */
function pickTranscodeAudioCodec(client: ClientPlaybackProfile, sourceChannels: number | undefined): { codec: string; channels?: number } {
  // aac is the one codec every real client in this app already declares
  // decode:true for (see clientProfile.detect.ts) — the safe universal target.
  const aacCap = client.audioCapabilities.find((c) => normalizeCodecName(c.codec) === "aac" && c.decode);
  const codec = aacCap ? "aac" : (client.audioCapabilities[0]?.codec ?? "aac");
  const cap = client.audioCapabilities.find((c) => normalizeCodecName(c.codec) === codec);
  const maxChannels = cap?.maxChannels;
  const channels = maxChannels && sourceChannels && sourceChannels > maxChannels ? maxChannels : undefined;
  return { codec, channels };
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
  const audioTranscodeTarget = needsAudioTranscode ? pickTranscodeAudioCodec(client, audioTrack?.channels) : null;

  if (needsVideoTranscode) {
    if (!server.ffmpegAvailable) {
      return {
        mode: "PLEX_FALLBACK",
        containerAction: "REMUX",
        targetContainer: "mp4",
        videoAction: "TRANSCODE",
        audioAction: needsAudioTranscode ? "TRANSCODE" : "COPY",
        targetAudioCodec: audioTranscodeTarget?.codec,
        targetAudioChannels: audioTranscodeTarget?.channels,
        subtitleAction,
        reasons: [...reasons, "FFMPEG_UNAVAILABLE", "PLEX_FALLBACK_REQUESTED"],
      };
    }
    const targetVideoCodec = pickTranscodeVideoCodec(client, server);
    const encoder = pickVideoEncoderImpl(targetVideoCodec, server, videoCheck.toneMapNeeded === true);
    const targetCap = client.videoCapabilities.find((c) => normalizeCodecName(c.codec) === targetVideoCodec);
    const clientMaxWidth = targetCap?.maxWidth ?? client.maxWidth;
    return {
      mode: "TRANSCODE",
      containerAction: "REMUX",
      targetContainer: "mp4",
      videoAction: "TRANSCODE",
      targetVideoCodec,
      videoEncoderImpl: encoder.impl,
      encoderPreset: encoder.preset,
      targetVideoWidth: pickTargetVideoWidth(media.video.width, clientMaxWidth, encoder.isHardware, videoCheck.toneMapNeeded === true),
      toneMap: videoCheck.toneMapNeeded || undefined,
      audioAction: needsAudioTranscode ? "TRANSCODE" : "COPY",
      targetAudioCodec: audioTranscodeTarget?.codec,
      targetAudioChannels: audioTranscodeTarget?.channels,
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
      targetAudioCodec: audioTranscodeTarget?.codec,
      targetAudioChannels: audioTranscodeTarget?.channels,
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
