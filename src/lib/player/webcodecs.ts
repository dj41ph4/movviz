/**
 * WebCodecs + canPlayType detection — check if the browser can decode
 * HEVC/AV1/AC3 via VideoDecoder/AudioDecoder, and fall back to
 * video.canPlayType for basic codec detection.
 *
 * Chrome on Windows with HEVC Video Extensions installed, and Chrome on
 * Android, report `VideoDecoder.isConfigSupported({ codec: 'hev1' })` → true
 * even though `<video>.canPlayType('video/mp4; codecs="hev1"')` → ''.
 * This lets us decode HEVC natively without Plex transcoding.
 */

export interface CodecCapabilities {
  hevc: boolean;
  av1: boolean;
  h264: boolean;
  ac3: boolean;
  aac: boolean;
  opus: boolean;
  webcodecsAvailable: boolean;
}

let cachedCapabilities: CodecCapabilities | null = null;

export async function detectCodecs(): Promise<CodecCapabilities> {
  if (cachedCapabilities) return cachedCapabilities;

  const result: CodecCapabilities = {
    hevc: false,
    av1: false,
    h264: false,
    ac3: false,
    aac: false,
    opus: false,
    webcodecsAvailable: false,
  };

  const hasWebCodecs =
    typeof window !== "undefined" &&
    "VideoDecoder" in window &&
    "AudioDecoder" in window;
  result.webcodecsAvailable = hasWebCodecs;

  const videoEl = typeof document !== "undefined"
    ? document.createElement("video")
    : null;

  if (hasWebCodecs) {
    const videoChecks: Array<[keyof CodecCapabilities, string]> = [
      ["h264", "avc1.640028"],
      ["hevc", "hev1.1.6.L93.B0"],
      ["av1", "av01.0.05M.08"],
    ];

    for (const [key, codec] of videoChecks) {
      try {
        const supported = await (window as any).VideoDecoder.isConfigSupported({
          codec,
          codedWidth: 1920,
          codedHeight: 1080,
        });
        result[key] = supported?.supported === true;
      } catch {
        result[key] = false;
      }
    }

    const audioChecks: Array<[keyof CodecCapabilities, string]> = [
      ["aac", "mp4a.40.2"],
      ["ac3", "ac-3"],
      ["opus", "opus"],
    ];

    for (const [key, codec] of audioChecks) {
      try {
        const supported = await (window as any).AudioDecoder.isConfigSupported({
          codec,
          sampleRate: 48000,
          numberOfChannels: 6,
        });
        result[key] = supported?.supported === true;
      } catch {
        result[key] = false;
      }
    }
  }

  if (videoEl) {
    if (!result.hevc) {
      result.hevc =
        videoEl.canPlayType('video/mp4; codecs="hev1.1.6.L93.B0"') !== "" ||
        videoEl.canPlayType('video/mp4; codecs="hvc1.1.6.L93.B0"') !== "";
    }
    if (!result.av1) {
      result.av1 = videoEl.canPlayType('video/mp4; codecs="av01.0.05M.08"') !== "";
    }
    if (!result.h264) {
      result.h264 = videoEl.canPlayType('video/mp4; codecs="avc1.640028"') !== "";
    }
    if (!result.aac) {
      result.aac = videoEl.canPlayType('audio/mp4; codecs="mp4a.40.2"') !== "";
    }
    if (!result.opus) {
      result.opus = videoEl.canPlayType('audio/webm; codecs="opus"') !== "";
    }
    if (!result.ac3) {
      result.ac3 = videoEl.canPlayType('audio/mp4; codecs="ac-3"') !== "";
    }
  }

  cachedCapabilities = result;
  return result;
}

export function videoCanPlay(mimeType: string): boolean {
  if (typeof document === "undefined") return false;
  const v = document.createElement("video");
  return v.canPlayType(mimeType) !== "";
}

export type PlaybackStrategy = "direct" | "webcodecs" | "transcode";

export async function pickStrategy(
  videoCodec: string | null | undefined,
  audioCodec: string | null | undefined
): Promise<PlaybackStrategy> {
  const videoMime = videoCodec
    ? `video/mp4; codecs="${videoCodec}"`
    : "video/mp4";
  if (videoCanPlay(videoMime)) {
    const audioMime = audioCodec
      ? `audio/mp4; codecs="${audioCodec}"`
      : null;
    if (!audioMime || videoCanPlay(audioMime)) return "direct";
  }

  const caps = await detectCodecs();
  if (!caps.webcodecsAvailable) {
    return "transcode";
  }

  const videoOk = !videoCodec || isVideoCodecSupported(videoCodec, caps);
  const audioOk = !audioCodec || isAudioCodecSupported(audioCodec, caps);

  if (videoOk && audioOk) return "webcodecs";
  return "transcode";
}

function isVideoCodecSupported(codec: string, caps: CodecCapabilities): boolean {
  const c = codec.toLowerCase();
  if (c.includes("hevc") || c.includes("h265") || c.includes("hev1") || c.includes("hvc1"))
    return caps.hevc;
  if (c.includes("av1")) return caps.av1;
  if (c.includes("h264") || c.includes("avc")) return caps.h264;
  return false;
}

function isAudioCodecSupported(codec: string, caps: CodecCapabilities): boolean {
  const c = codec.toLowerCase();
  if (c.includes("ac3") || c.includes("ac-3") || c.includes("dolby")) return caps.ac3;
  if (c.includes("aac")) return caps.aac;
  if (c.includes("opus")) return caps.opus;
  if (c.includes("mp3") || c.includes("mp4a.40.34")) return true;
  return false;
}
