/**
 * Phase 1 contract (see PLAN_REFONTE_MOTEUR_LECTURE_MOVVIZ.md §21-22).
 * `PlaybackPlan` is the sole output of `decidePlayback()` (Phase 4) — a pure
 * function's decision, not an executor's log. `PlaybackExecutor` (Phase 31)
 * reads a plan and carries it out; it never decides strategy itself.
 */

export type PlaybackMode =
  | "DIRECT_PLAY"
  | "REMUX"
  | "DIRECT_STREAM"
  | "TRANSCODE"
  | "PLEX_FALLBACK"
  | "UNSUPPORTED";

export type ContainerAction = "COPY" | "REMUX";
export type TrackAction = "COPY" | "TRANSCODE";
export type SubtitleAction = "NONE" | "DIRECT" | "EXTRACT" | "CONVERT" | "BURN";
export type StreamProtocol = "PROGRESSIVE" | "HLS" | "DASH";

/**
 * Every reason the engine can cite for a decision — see plan §22. Kept as a
 * closed union (not a free string) so a typo can't silently produce an
 * unexplainable plan, and so the debug overlay (§52-53) and logs (§54) can
 * exhaustively switch over every possible reason.
 */
export type PlaybackReasonCode =
  | "CONTAINER_UNSUPPORTED"
  | "VIDEO_CODEC_UNSUPPORTED"
  | "VIDEO_PROFILE_UNSUPPORTED"
  | "VIDEO_LEVEL_UNSUPPORTED"
  | "VIDEO_BIT_DEPTH_UNSUPPORTED"
  | "VIDEO_RESOLUTION_UNSUPPORTED"
  | "VIDEO_FPS_UNSUPPORTED"
  | "HDR_UNSUPPORTED"
  | "DOLBY_VISION_UNSUPPORTED"
  | "AUDIO_CODEC_UNSUPPORTED"
  | "AUDIO_CHANNELS_UNSUPPORTED"
  | "SUBTITLE_CODEC_UNSUPPORTED"
  | "SUBTITLE_BURN_REQUIRED"
  | "NETWORK_BITRATE_LIMIT"
  | "FORCED_QUALITY"
  | "FFMPEG_UNAVAILABLE"
  | "FFMPEG_FAILURE"
  | "MOVVIZ_STREAM_FAILURE"
  | "MOVVIZ_TRANSCODE_FAILURE"
  | "ALL_MOVVIZ_STRATEGIES_FAILED"
  | "PLEX_FALLBACK_REQUESTED";

export interface PlaybackPlan {
  mode: PlaybackMode;

  containerAction: ContainerAction;
  targetContainer?: string;

  videoAction: TrackAction;
  targetVideoCodec?: string;
  /** Exact ffmpeg -c:v implementation name for the transcode (e.g. "libx264",
   *  "hevc_nvenc") — only set when videoAction is TRANSCODE. Decided against
   *  the server's actual compiled encoder list (Phase 6), preferring
   *  hardware when the server genuinely has it for this exact codec. */
  videoEncoderImpl?: string;
  /** x264/x265/svtav1-style speed preset — only set alongside a SOFTWARE
   *  videoEncoderImpl. A weak server (no hardware encoder) needs a fast
   *  preset so encoding doesn't fall behind real-time playback; hardware
   *  encoders don't take this kind of preset, so it stays unset for those. */
  encoderPreset?: string;
  /**
   * §29 — set when the source is HDR (any type) and the client declared no
   * matching HDR capability at all (not even a Dolby-Vision-to-HDR10
   * base-layer fallback) — the video must be converted to SDR as part of
   * the transcode, not just re-encoded in the same dynamic range. Always
   * false/absent unless videoAction is TRANSCODE; tone mapping is itself
   * one of the reasons a transcode was needed, never a separate step.
   */
  toneMap?: boolean;

  audioAction: TrackAction;
  targetAudioCodec?: string;
  /** Only set when the source has MORE channels than the client's declared
   *  cap for targetAudioCodec — an explicit downmix instruction (ffmpeg -ac),
   *  never just "copy the source's channel count through unexamined". See
   *  pickTranscodeAudioCodec()'s own comment for the real bug this exists
   *  to prevent (a 5.1 source encoded as 5.1 AAC and played on a genuine
   *  2.0 output silently lost its center-channel dialogue). */
  targetAudioChannels?: number;

  subtitleAction: SubtitleAction;

  protocol?: StreamProtocol;

  /** Always populated, even for DIRECT_PLAY ("everything compatible") — a
   *  plan with no reasons is a plan nobody can debug. */
  reasons: PlaybackReasonCode[];
}
