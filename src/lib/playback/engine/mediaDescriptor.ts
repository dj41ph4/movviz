/**
 * Phase 1 of the playback engine rewrite (see PLAN_REFONTE_MOTEUR_LECTURE_MOVVIZ.md).
 * Pure data contracts only — nothing here calls ffprobe, opens a file, or
 * talks to a player. `MediaDescriptor` is the technical truth about a media
 * file, produced once by the (future) Media Probe and cached, never
 * re-derived on every playback request.
 */

export interface AudioTrack {
  index: number;
  codec: string;
  language?: string;
  title?: string;
  channels?: number;
  bitrate?: number;
  sampleRate?: number;
  default?: boolean;
  forced?: boolean;
}

/** PGS/VobSub are image-based (require burn-in or client-side image rendering);
 *  SRT/WebVTT/ASS/SSA are text-based (can be converted, sent as WebVTT, or rendered natively). */
export type SubtitleTrackType = "text" | "image";

export interface SubtitleTrack {
  index: number;
  codec: string;
  language?: string;
  title?: string;
  default?: boolean;
  forced?: boolean;
  type: SubtitleTrackType;
}

export type HdrType = "sdr" | "hdr10" | "hlg" | "dolby-vision";

export interface VideoStreamDescriptor {
  index: number;
  codec: string;
  profile?: string;
  level?: string;
  width?: number;
  height?: number;
  fps?: number;
  bitDepth?: number;
  bitrate?: number;
  hdr?: {
    type: HdrType;
    /** Only meaningful when type === "dolby-vision". */
    dolbyVisionProfile?: number;
    /**
     * Only meaningful when type === "dolby-vision" — what a non-DV decoder
     * sees when it decodes the base layer and ignores the DV RPU metadata
     * (ffprobe's dv_bl_signal_compatibility_id, ISO/IEC 23001-8 mapping:
     * 1→hdr10, 2→sdr, 4→hlg). Undefined means either no base-layer
     * compatibility (single-layer non-backward-compatible profile, e.g. 5)
     * or the file predates this field. decidePlayback() uses this to allow
     * DIRECT_PLAY on an HDR10-capable client for a backward-compatible DV
     * file instead of forcing a transcode purely because the client didn't
     * declare "dolby-vision" support (plan §29).
     */
    dolbyVisionBaseLayerCompatibility?: "hdr10" | "sdr" | "hlg";
  };
}

/**
 * The technical content of one media file. Carries no playback decision —
 * `decidePlayback()` (Phase 4) is the only place that turns this + a client
 * profile into a `PlaybackPlan`.
 */
export interface MediaDescriptor {
  mediaId: string;

  source: {
    type: "local" | "remote";
  };

  container: string;
  size?: number;
  durationMs?: number;
  bitrate?: number;

  video: VideoStreamDescriptor;

  audioTracks: AudioTrack[];
  subtitleTracks: SubtitleTrack[];
}
