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
  /** MediaCapabilities.decodingInfo() is available for native/file probing. */
  mediaCapabilitiesAvailable: boolean;
  /**
   * HEVC codec strings encode profile in their 2nd dotted field —
   * "hev1.1.6..." is profile_idc 1 (Main, 8-bit); "hev1.2.4..." is
   * profile_idc 2 (Main10, 10-bit). The plain `hevc` flag above only ever
   * probed the 8-bit Main string, so it says nothing about 10-bit support —
   * and virtually all real HDR/UHD content (this app's own test library
   * included) is Main10. Needed so the new decision engine (Phase 4) can
   * populate VideoCapability.bitDepths instead of leaving it unset.
   */
  hevcMain10: boolean;
  /** AV1 codec strings encode bit depth as their trailing 2-digit field
   *  ("av01.0.09M.08" = 8-bit, "...10" = 10-bit) — same reasoning as
   *  hevcMain10 above: the base `av1` flag only ever probed 8-bit. */
  av1Main10: boolean;
  /** Whether each codec's decoder reports support at 3840x2160, not just
   *  the 1080p config the base flags above probe — feeds
   *  VideoCapability.maxWidth/maxHeight so a genuinely resolution-limited
   *  decoder isn't treated as unlimited. */
  hevc4k: boolean;
  av1_4k: boolean;
  h264_4k: boolean;
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
    mediaCapabilitiesAvailable: false,
    hevcMain10: false,
    av1Main10: false,
    hevc4k: false,
    av1_4k: false,
    h264_4k: false,
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

  // Native/file audio capability: MediaCapabilities is the primary source
  // because it queries the browser + OS + device playback stack. WebCodecs
  // and canPlayType are only fallbacks when MediaCapabilities is unavailable:
  // a raw AudioDecoder being configurable does not prove that <video src>
  // can render the same codec/container.
  const mediaAudioResolved = new Set<keyof CodecCapabilities>();
  const mediaCaps = typeof navigator !== "undefined" ? navigator.mediaCapabilities : undefined;
  if (mediaCaps?.decodingInfo) {
    result.mediaCapabilitiesAvailable = true;
    const checks: Array<[keyof CodecCapabilities, string, number]> = [
      ["aac", 'audio/mp4; codecs="mp4a.40.2"', 2],
      ["ac3", 'audio/mp4; codecs="ac-3"', 6],
      ["eac3", 'audio/mp4; codecs="ec-3"', 6],
      ["opus", 'audio/webm; codecs="opus"', 2],
      ["flac", "audio/flac", 2],
      ["mp3", "audio/mpeg", 2],
    ];
    for (const [key, contentType, channels] of checks) {
      try {
        const info = await mediaCaps.decodingInfo({
          type: "file",
          audio: {
            contentType,
            channels: String(channels),
            bitrate: key === "ac3" || key === "eac3" ? 640_000 : 320_000,
            samplerate: 48_000,
          },
        });
        result[key] = info.supported === true;
        mediaAudioResolved.add(key);
      } catch {
        result[key] = false;
        mediaAudioResolved.add(key);
      }
    }
  }

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

    // Separate probes: bit depth (HEVC profile_idc 2 = Main10) and 4K
    // resolution, verified live to be independently queryable via
    // VideoDecoder.isConfigSupported — see webcodecs.ts's own class comment.
    const extraChecks: Array<[keyof CodecCapabilities, string, number, number]> = [
      ["hevcMain10", "hev1.2.4.L153.B0", 1920, 1080],
      ["av1Main10", "av01.0.09M.10", 1920, 1080],
      ["hevc4k", "hev1.1.6.L153.B0", 3840, 2160],
      ["av1_4k", "av01.0.09M.08", 3840, 2160],
      ["h264_4k", "avc1.640033", 3840, 2160],
    ];
    for (const [key, codec, codedWidth, codedHeight] of extraChecks) {
      try {
        const supported = await (window as any).VideoDecoder.isConfigSupported({ codec, codedWidth, codedHeight });
        result[key] = supported?.supported === true;
      } catch {
        result[key] = false;
      }
    }

    const audioChecks: Array<[keyof CodecCapabilities, string]> = [
      ["aac", "mp4a.40.2"],
      ["ac3", "ac-3"],
      ["eac3", "ec-3"],
      ["opus", "opus"],
      ["flac", "flac"],
      ["mp3", "mp3"],
    ];

    for (const [key, codec] of audioChecks) {
      if (mediaAudioResolved.has(key)) continue;
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
    if (!mediaAudioResolved.has("aac") && !result.aac) {
      result.aac = videoEl.canPlayType('audio/mp4; codecs="mp4a.40.2"') !== "";
    }
    if (!mediaAudioResolved.has("opus") && !result.opus) {
      result.opus = videoEl.canPlayType('audio/webm; codecs="opus"') !== "";
    }
    if (!mediaAudioResolved.has("ac3") && !result.ac3) {
      result.ac3 = videoEl.canPlayType('audio/mp4; codecs="ac-3"') !== "";
    }
    if (!mediaAudioResolved.has("eac3") && !result.eac3) {
      result.eac3 = videoEl.canPlayType('audio/mp4; codecs="ec-3"') !== "";
    }
    if (!mediaAudioResolved.has("flac") && !result.flac) {
      result.flac = videoEl.canPlayType('audio/flac') !== "" || videoEl.canPlayType('audio/mp4; codecs="flac"') !== "";
    }
    if (!mediaAudioResolved.has("mp3") && !result.mp3) {
      result.mp3 = videoEl.canPlayType('audio/mpeg') !== "";
    }
  }

  cachedCapabilities = result;
  return result;
}

/**
 * Whether hls.js can transmux this audio codec from MPEG-TS → fMP4 in the
 * HLS path. This is a fixed property of the hls.js version + MPEG-TS
 * packaging the transcode route requests (protocol=hls) — a structural fact
 * about the library, NOT a browser capability probe. hls.js 1.6.16 demuxes
 * AAC, MP3/MP2 and AC-3 from TS only:
 * - E-AC3 (TS stream 0x87) → explicit parsing error, track dropped → SILENT
 * - DTS/TrueHD/PCM/FLAC/Opus/Vorbis → no TS handler at all → track ignored
 * Whether the BROWSER can actually render a codec this says "yes" to used to
 * also gate on MediaSource.isTypeSupported() (caps.mseAc3 etc) — dropped:
 * confirmed live that probe reports false negatives for AC-3 that play fine
 * in practice. That question is now answered live (watchForSilentAudio),
 * not guessed here — mirrors the direct-play lesson from v1.12.73.
 */
export function isAudioMseTransmuxable(codec: string): boolean {
  const c = codec.toLowerCase();
  if (c.includes("aac") || c.includes("mp4a.40.2")) return true;
  if (c.includes("eac3") || c === "ec-3") return false;
  if (c.includes("ac3") || c === "ac-3" || c.includes("dolby")) return true;
  if (c === "mp3" || c === "mp4a.40.34" || c === "mp2") return true;
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

/**
 * Decision AVANT lecture (miroir du device profile Jellyfin) : faut-il
 * transcoder l'audio en AAC plutôt que le copier ?
 * Ordre strict : "eac3" contient "ac3" → vérifier E-AC3 d'abord.
 * - codecs que hls.js ne sait pas transmuxer du TS (E-AC3/DTS/TrueHD/PCM/
 *   FLAC/Opus/Vorbis) → TOUJOURS transcode (fait structurel de la lib)
 * - AC-3/EC-3 → transcode uniquement si le navigateur affirme ne pas
 *   pouvoir le décoder en MSE (probe fiable, PAS canPlayType)
 * - AAC/MP3 → jamais (toujours décodable)
 * Filet : la veille de silence (watchForSilentAudio) reste armée sur
 * toutes les legs copy pour les probes positives menteuses (cas déjà
 * documenté ci-dessus : AC-3 jouable alors que isTypeSupported dit non) —
 * cette fonction ne force donc le transcode que sur une réponse NÉGATIVE,
 * jamais l'inverse ; le pire cas est un transcode évitable, pas un silence.
 */
export function shouldForceAudioTranscode(codec: string, caps: CodecCapabilities): boolean {
  const c = codec.toLowerCase();
  if (!isAudioMseTransmuxable(c)) return true;
  // MSE is its own capability domain. Native/file support never authorizes
  // an MSE copy, and MSE support never authorizes direct <video src>.
  if (c.includes("ac3") || c === "ac-3" || c.includes("dolby")) return !caps.mseAc3;
  if (c === "mp3" || c === "mp4a.40.34" || c === "mp2") return !(caps.mseMp3 || caps.mp3);
  return false;
}

export function isAudioCodecSupported(codec: string, caps: CodecCapabilities): boolean {
  const c = codec.toLowerCase();
  // DIRECT/progressive capability only: never OR with mse* flags.
  if (c === "eac3" || c === "ec-3") return caps.eac3;
  if (c.includes("ac3") || c === "ac-3" || c.includes("dolby")) return caps.ac3;
  if (c.includes("opus")) return caps.opus;
  if (c === "flac") return caps.flac;
  if (c.includes("mp3") || c === "mp4a.40.34" || c === "mp2") return caps.mp3;
  if (c.includes("aac") || c.includes("mp4a")) return caps.aac;
  return false;
}
