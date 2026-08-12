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
  eac3: boolean;
  aac: boolean;
  opus: boolean;
  flac: boolean;
  mp3: boolean;
  /** MSE-level support — the real gate for the HLS/remux path (hls.js uses MSE) */
  mseAc3: boolean;
  mseEac3: boolean;
  mseMp3: boolean;
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
    eac3: false,
    aac: false,
    opus: false,
    flac: false,
    mp3: false,
    mseAc3: false,
    mseEac3: false,
    mseMp3: false,
    webcodecsAvailable: false,
  };

  // MediaSource.isTypeSupported is the authoritative check for what hls.js
  // can actually feed to MSE. canPlayType() lies for AC-3/E-AC-3 on Chrome
  // (returns "" even when MSE + Dolby extension can decode it).
  const ms =
    typeof window !== "undefined" &&
    ("MediaSource" in window ? (window as any).MediaSource : null);
  if (ms?.isTypeSupported) {
    result.mseAc3 = ms.isTypeSupported('audio/mp4; codecs="ac-3"');
    result.mseEac3 = ms.isTypeSupported('audio/mp4; codecs="ec-3"');
    result.mseMp3 = ms.isTypeSupported('audio/mp4; codecs="mp4a.40.34"');
  }

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
      ["flac", "flac"],
      ["mp3", "mp3"],
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
    if (!result.eac3) {
      result.eac3 = videoEl.canPlayType('audio/mp4; codecs="ec-3"') !== "";
    }
    if (!result.flac) {
      result.flac = videoEl.canPlayType('audio/flac') !== "" || videoEl.canPlayType('audio/mp4; codecs="flac"') !== "";
    }
    if (!result.mp3) {
      result.mp3 = videoEl.canPlayType('audio/mpeg') !== "";
    }
    if (!result.mseAc3) {
      // Last resort: plain element playback of AC-3 (rare but exists)
      result.mseAc3 = result.ac3;
    }
  }

  cachedCapabilities = result;
  return result;
}

/**
 * Whether hls.js can transmux this audio codec from MPEG-TS → fMP4 in the
 * HLS path. hls.js 1.6.16 demuxes AAC, MP3/MP2 and AC-3 from TS only:
 * - E-AC3 (TS stream 0x87) → explicit parsing error, track dropped → SILENT
 * - DTS/TrueHD/PCM/FLAC/Opus/Vorbis → no TS handler at all → track ignored
 * This is the ONLY gate for ta=0 (audio copy) in the HLS path. Browsers may
 * decode more (direct play), but copy means "transmux through hls.js".
 */
export function isAudioMseTransmuxable(codec: string, caps: CodecCapabilities): boolean {
  const c = codec.toLowerCase();
  if (c.includes("aac") || c.includes("mp4a.40.2")) return caps.aac;
  if (c.includes("eac3") || c === "ec-3") return false;
  if (c.includes("ac3") || c === "ac-3" || c.includes("dolby")) return caps.mseAc3;
  if (c === "mp3" || c === "mp4a.40.34" || c === "mp2") return caps.mseMp3;
  return false;
}

/**
 * AC-3/E-AC-3 are decoded outside the render engine (system/Dolby decoder,
 * not exposed as PCM the renderer can read) — a Web Audio tap on the
 * `<video>` element structurally cannot observe this audio at all, so the
 * silent-audio safety net (see silentAudioDetector.ts) is guaranteed to
 * misfire on these two codecs specifically, not just occasionally. Direct
 * play already confirmed working live on every Dolby file tested — the
 * safety net's real purpose (catching a genuinely broken default track) is
 * a threat the browser's own AC-3/E-AC-3 support probe already screens for
 * upstream, so skipping the net here removes a guaranteed false positive,
 * not a real protection.
 */
export function isDolbyPassthroughCodec(codec: string | null | undefined): boolean {
  if (!codec) return false;
  const c = codec.toLowerCase();
  return c.includes("eac3") || c === "ec-3" || c.includes("ac3") || c === "ac-3" || c.includes("dolby");
}

export function isVideoCodecSupported(codec: string, caps: CodecCapabilities): boolean {
  const c = codec.toLowerCase();
  if (c.includes("hevc") || c.includes("h265") || c.includes("hev1") || c.includes("hvc1"))
    return caps.hevc;
  if (c.includes("av1")) return caps.av1;
  if (c.includes("h264") || c.includes("avc")) return caps.h264;
  return false;
}

export function isAudioCodecSupported(codec: string, caps: CodecCapabilities): boolean {
  const c = codec.toLowerCase();
  // Order matters: "eac3" contains "ac3" — check E-AC3 first
  if (c === "eac3" || c === "ec-3") return caps.eac3 || caps.mseEac3;
  if (c.includes("ac3") || c === "ac-3" || c.includes("dolby")) return caps.ac3 || caps.mseAc3;
  if (c.includes("opus")) return caps.opus;
  if (c === "flac") return caps.flac;
  if (c.includes("mp3") || c === "mp4a.40.34" || c === "mp2") return caps.mp3 || caps.mseMp3;
  if (c.includes("aac") || c.includes("mp4a")) return caps.aac;
  // dts/dtsma/dtshd/dtsx, truehd/mlpa, pcm/lpcm, wma, vorbis → not decodable by any browser
  return false;
}
