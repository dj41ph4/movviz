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

export function videoCanPlay(mimeType: string): boolean {
  if (typeof document === "undefined") return false;
  const v = document.createElement("video");
  return v.canPlayType(mimeType) !== "";
}

/**
 * MediaSource.isTypeSupported() is the reliable probe for the "browser lies"
 * codecs: Chrome/Edge's canPlayType() returns "" for AC-3/E-AC-3 in MP4 even
 * though the platform decodes them fine — the SAME decoder that MSE reports
 * truthfully through isTypeSupported (confirmed live: the MSE path plays
 * AC-3/EAC-3 while canPlayType claims nothing can). A direct <video src> MP4
 * and MSE share the same MP4 demuxer + platform decoder, so
 * isTypeSupported()==true means the file will play direct — and if some
 * platform still fails, the <video> error handler in VideoPlayer falls back
 * to HLS automatically.
 */
export function mseAudioCapable(mime: string): boolean {
  if (typeof MediaSource === "undefined") return false;
  try {
    return MediaSource.isTypeSupported(mime);
  } catch {
    return false;
  }
}

export type PlaybackStrategy = "direct" | "webcodecs" | "transcode";

/**
 * Plex returns codec names like "h264", "hevc", "aac" — these are NOT valid
 * RFC 6381 codec strings. Every browser returns "" for `canPlayType("video/mp4;
 * codecs=\"h264\"")`. Normalize to proper RFC 6381 before the check so direct
 * play actually works for H.264+AAC MP4s (the most common library format).
 */
function toRfc6381(plexCodec: string | null | undefined, type: "video" | "audio"): string | null {
  if (!plexCodec) return null;
  const c = plexCodec.toLowerCase();
  if (type === "video") {
    if (c === "h264" || c === "h.264" || c.includes("avc")) return "avc1.640028";
    if (c === "hevc" || c === "h265" || c === "h.265") return "hev1.1.6.L93.B0";
    if (c.includes("av1")) return "av01.0.05M.08";
    if (c === "vp9") return "vp09.00.10.08";
    return "avc1.640028"; // fallback: most browsers support H.264
  }
  if (c === "aac" || c.includes("mp4a.40.2")) return "mp4a.40.2";
  if (c === "ac3" || c === "ac-3") return "ac-3";
  // E-AC3 has its own RFC 6381 string — "ac-3" does NOT match "ec-3"
  if (c === "eac3" || c === "ec-3") return "ec-3";
  if (c === "opus") return "opus";
  if (c === "mp3" || c === "mp4a.40.34") return "mp4a.40.34";
  if (c === "flac") return "flac";
  if (c === "vorbis") return "vorbis";
  if (c === "alac") return "alac";
  // DTS/TrueHD/PCM: no browser can play these — return null instead of
  // pretending they are AAC (would cause a silent direct-play failure).
  return null;
}

export async function pickStrategy(
  videoCodec: string | null | undefined,
  audioCodec: string | null | undefined
): Promise<PlaybackStrategy> {
  const videoRfc = toRfc6381(videoCodec, "video");
  const audioRfc = toRfc6381(audioCodec, "audio");

  // Known-safe container + codec combos → direct play without canPlayType check.
  // The browser fires `error` on the <video> element if it can't play,
  // and the fallback (VideoPlayer.tsx:188) kicks in automatically.
  const isSafeDirect = videoRfc === "avc1.640028" || videoRfc === "hev1.1.6.L93.B0";

  if (isSafeDirect && videoCanPlay(`video/mp4; codecs="${videoRfc}"`)) {
    // Unknown audio codec (dts/truehd/pcm) → audioRfc is null → must NOT
    // direct-play: the browser would fail on the audio track.
    if (!audioCodec) return "direct";
    if (audioRfc && videoCanPlay(`audio/mp4; codecs="${audioRfc}"`)) return "direct";
    // canPlayType lies for AC-3/E-AC-3 (always "" on Chrome/Edge even though
    // the MP4 plays fine) — probe the same decoder through
    // MediaSource.isTypeSupported() before refusing direct play. Without
    // this, every AC-3/EAC-3 MP4 was pushed down to the HLS/MSE leg
    // (badge "Direct stream", but actually remuxed) instead of a real
    // el.src direct play.
    if ((audioRfc === "ac-3" || audioRfc === "ec-3") && mseAudioCapable(`audio/mp4; codecs="${audioRfc}"`)) {
      return "direct";
    }
  }

  const caps = await detectCodecs();
  if (!caps.webcodecsAvailable) {
    return "transcode";
  }

  const videoOk = !videoCodec || isVideoCodecSupported(videoCodec, caps);
  // WebCodecsPlayer only decodes AAC-LC ("mp4a.40.2") / Opus. AC3/EAC3/FLAC/
  // MP3/HE-AAC must go through the HLS/MSE path (ta=0 copy) or Plex transcode
  // — never WebCodecs (no AudioDecoder → silent video with no fallback).
  const c = (audioCodec ?? "").toLowerCase();
  const webcodecsAudioOk =
    !audioCodec || c.includes("opus") || c === "aac" || c === "mp4a.40.2";
  const audioOk = webcodecsAudioOk && (!audioCodec || isAudioCodecSupported(audioCodec, caps));

  if (videoOk && audioOk) return "webcodecs";
  return "transcode";
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
