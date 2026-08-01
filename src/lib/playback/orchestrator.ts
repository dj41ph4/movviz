/**
 * PlaybackOrchestrator — decides between the custom MSE engine and the
 * existing engines (direct / webcodecs / Plex HLS transcode).
 *
 * Ordering (least costly first) is preserved: direct play and WebCodecs stay
 * authoritative (decided by the existing pickStrategy). This orchestrator
 * only upgrades the "transcode" leg: when the file is a compatible MP4 and
 * every codec is provably MSE-supported by the browser, the video is served
 * as fMP4 segments with a bitstream-identical copy — no re-encode ever.
 *
 * The MSE engine v1 covers MP4 sources only (H264/HEVC/AV1 video + AAC/AC3/
 * E-AC3/Opus/MP3 audio). Anything else falls through to the existing engine.
 */
import { probeMseVideo, probeMseAudio } from "./capabilities";
import type { PlaybackConfig, PlaybackDecision } from "./types";

export const MP4_CONTAINERS = new Set(["mp4", "m4v", "mov"]);

const MSE_VIDEO_CODECS = ["h264", "avc", "hevc", "h265", "av1", "vp9"];
const MSE_AUDIO_CODECS = ["aac", "mp4a", "ac3", "ac-3", "eac3", "ec-3", "opus", "mp3"];

function audioCodecString(codec: string): string {
  const c = codec.toLowerCase();
  if (c === "ac3" || c === "ac-3") return "ac-3";
  if (c === "eac3" || c === "ec-3") return "ec-3";
  if (c === "opus") return "opus";
  if (c.includes("mp4a.40.34") || c === "mp3") return "mp4a.40.34";
  if (c.includes("mp4a") || c.includes("aac")) return "mp4a.40.2";
  return c;
}

function rfcVideo(codec: string): string | null {
  const c = codec.toLowerCase();
  if (c.includes("h264") || c.includes("avc")) return "avc1.640028";
  if (c.includes("hevc") || c.includes("h265")) return "hev1.1.6.L93.B0";
  if (c.includes("av1")) return "av01.0.05M.08";
  if (c.includes("vp9")) return "vp09.00.10.08";
  return null;
}

export async function orchestrate(config: PlaybackConfig): Promise<PlaybackDecision> {
  const { media, capabilities, engine, subtitleActive } = config;

  if (engine === "native") {
    return { engine: "transcode", reason: "native engine forced — MSE disabled" };
  }

  const container = (media.container ?? "").toLowerCase();
  const canMse =
    capabilities.mseAvailable &&
    MP4_CONTAINERS.has(container) &&
    !subtitleActive &&
    (engine === "mse" || engine === "auto");

  if (canMse) {
    const vc = (media.videoCodec ?? "").toLowerCase();
    const ac = (media.audioCodec ?? "").toLowerCase();
    const videoCopyable = vc && MSE_VIDEO_CODECS.some((c) => vc.includes(c));
    const audioCopyable = ac && MSE_AUDIO_CODECS.some((c) => ac.includes(c));
    if (videoCopyable && audioCopyable) {
      const videoRfc = rfcVideo(vc);
      const audioRfc = audioCodecString(ac);
      if (videoRfc && probeMseVideo(videoRfc) && probeMseAudio(audioRfc)) {
        return {
          engine: "mse",
          reason: `MSE: MP4 ${vc}+${ac} bitstream copy — video untouched`,
          mse: {
            videoMime: `video/mp4; codecs="${videoRfc}"`,
            audioMime: `audio/mp4; codecs="${audioRfc}"`,
          },
        };
      }
    }
    return {
      engine: "transcode",
      reason: `MSE skipped: MP4 codecs not MSE-copyable (${media.videoCodec ?? "?"}+${media.audioCodec ?? "?"})`,
    };
  }

  return { engine: "transcode", reason: "MSE not applicable (engine/container/subtitles)" };
}
