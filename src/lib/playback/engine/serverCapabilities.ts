/**
 * Phase 1 contract (see PLAN_REFONTE_MOTEUR_LECTURE_MOVVIZ.md §18-19).
 * What the server itself can do — probed once at startup from `ffmpeg
 * -version` / `-encoders` / `-decoders` / `-hwaccels` (Phase 6), never
 * assumed. The Decision Engine (Phase 4) needs this to know whether a
 * transcode path is even available before planning one.
 */

export interface ServerPlaybackCapabilities {
  ffmpegAvailable: boolean;

  videoDecoders: string[];
  videoEncoders: string[];
  audioDecoders: string[];
  audioEncoders: string[];

  hardwareAcceleration: {
    nvenc?: boolean;
    nvdec?: boolean;
    qsv?: boolean;
    vaapi?: boolean;
    amf?: boolean;
    videotoolbox?: boolean;
  };
}
