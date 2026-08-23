/**
 * Playback engine abstraction — Movviz MSE playback architecture.
 *
 * Engine resolution order (least costly first):
 *   DIRECT → WEBCodecs → MSE (transmux, video bitstream preserved)
 *   → audio-only adaptation (future) → video transcode (last resort)
 */

export type PlaybackEngineKind = "direct" | "webcodecs" | "mse" | "ffmpeg" | "transcode";

/**
 * "engine-v2" — the NEW decision-engine-driven leg (Phases 9-13,
 * PLAN_REFONTE_MOTEUR_LECTURE_MOVVIZ.md). Deliberately MANUAL-ONLY, never
 * reachable via "auto": orchestrate() (src/lib/playback/orchestrator.ts)
 * never returns it, VideoPlayer's tryStartLocalEngine only engages when
 * this exact value is picked, and only for local (non-Plex) files. The
 * existing four values and their behavior are completely unchanged.
 */
export type EngineConfig = "auto" | "native" | "mse" | "ffmpeg" | "hls" | "engine-v2";

export interface MediaTrackInfo {
  id: string;
  codec: string;
  language?: string;
  channels?: number;
  selected?: boolean;
}

export interface MediaInfo {
  /** Plex rating key */
  ratingKey: string;
  container: string | null;
  videoCodec: string | null;
  audioCodec: string | null;
  width?: number;
  height?: number;
  durationSec?: number;
  audioStreams?: MediaTrackInfo[];
  subtitleStreams?: MediaTrackInfo[];
}

export interface BrowserCapabilities {
  mseAvailable: boolean;
  mseAc3: boolean;
  mseEac3: boolean;
  mseMp3: boolean;
  mseVideoCodecs: string[];
  /** true when the browser element can play the codec set natively */
  elementAudioCodecs: string[];
}

export interface PlaybackDecision {
  engine: PlaybackEngineKind;
  /** Human-readable reason, surfaced in the debug overlay */
  reason: string;
  /** Set when no engine could be chosen — the caller must surface the error */
  error?: string;
  /** Required by the MSE engine (media-source mime types) */
  mse?: { videoMime: string; audioMime: string };
}

export interface PlaybackConfig {
  media: MediaInfo;
  capabilities: BrowserCapabilities;
  /** settings.playbackEngine — "auto" by default */
  engine: EngineConfig;
  /** subtitle burn forces video transcode → MSE must not be chosen */
  subtitleActive: boolean;
  /** true when direct play of the container+codecs is already proven */
  directPossible: boolean;
  /** true when WebCodecs can decode video+audio */
  webcodecsPossible: boolean;
  /** true when the server confirmed an ffmpeg binary is available (from /info) */
  ffmpegAvailable?: boolean;
}

export interface PlaybackEngine {
  readonly kind: PlaybackEngineKind;
  initialize(): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seek(time: number): Promise<void>;
  setPlaybackRate(rate: number): void;
  switchAudio(trackId: string): Promise<void>;
  destroy(): Promise<void>;
}

export interface PlaybackMetrics {
  mode: PlaybackEngineKind;
  container: string;
  videoCodec: string;
  audioCodec: string;
  bufferSec: number;
  networkMbps: number;
  rebufferCount: number;
  segmentMs: number;
  startupMs: number;
  errors: number;
  fallbacks: number;
}

export interface PlaybackEvents {
  onBuffering?: (buffering: boolean) => void;
  onMetrics?: (m: PlaybackMetrics) => void;
  onFatal?: (reason: string) => void;
}
