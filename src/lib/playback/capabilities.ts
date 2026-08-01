/**
 * CapabilityDetector — real browser capability probing.
 * The browser decides compatibility: MediaSource.isTypeSupported for the MSE
 * path, canPlayType for the native element path. Never assume "known codec =
 * compatible codec".
 */
import { detectCodecs } from "@/lib/player/webcodecs";
import type { BrowserCapabilities } from "./types";

const VIDEO_CODEC_PROBES: Array<[string, string]> = [
  ['avc1.640028', 'video/mp4; codecs="avc1.640028"'],
  ['hev1.1.6.L93.B0', 'video/mp4; codecs="hev1.1.6.L93.B0"'],
  ['av01.0.05M.08', 'video/mp4; codecs="av01.0.05M.08"'],
  ['vp09.00.10.08', 'video/mp4; codecs="vp09.00.10.08"'],
];

const AUDIO_ELEMENT_PROBES: Array<[string, string]> = [
  ["aac", 'audio/mp4; codecs="mp4a.40.2"'],
  ["ac3", 'audio/mp4; codecs="ac-3"'],
  ["eac3", 'audio/mp4; codecs="ec-3"'],
  ["opus", 'audio/mp4; codecs="opus"'],
  ["flac", "audio/flac"],
  ["mp3", "audio/mpeg"],
];

let cached: BrowserCapabilities | null = null;

export async function detectCapabilities(): Promise<BrowserCapabilities> {
  if (cached) return cached;

  const caps = await detectCodecs();

  const ms =
    typeof window !== "undefined" && "MediaSource" in window
      ? (window as any).MediaSource
      : null;
  const msIsSupported = (mime: string) => !!ms?.isTypeSupported && ms.isTypeSupported(mime);

  const mseVideoCodecs: string[] = [];
  for (const [codec, mime] of VIDEO_CODEC_PROBES) {
    if (msIsSupported(mime)) mseVideoCodecs.push(codec);
  }

  const elementAudioCodecs: string[] = [];
  const v = typeof document !== "undefined" ? document.createElement("video") : null;
  if (v) {
    for (const [codec, mime] of AUDIO_ELEMENT_PROBES) {
      if (v.canPlayType(mime) !== "") elementAudioCodecs.push(codec);
    }
  }

  cached = {
    mseAvailable: msIsSupported('video/mp4; codecs="avc1.640028"') && !!window?.MediaSource,
    mseAc3: msIsSupported('audio/mp4; codecs="ac-3"') || caps.mseAc3,
    mseEac3: msIsSupported('audio/mp4; codecs="ec-3"') || caps.mseEac3,
    mseMp3: msIsSupported('audio/mp4; codecs="mp4a.40.34"') || caps.mseMp3,
    mseVideoCodecs,
    elementAudioCodecs,
  };
  return cached;
}

/** Probe a precise codec string (e.g. avc1.42E01E from the actual file). */
export function probeMseVideo(codec: string): boolean {
  const ms =
    typeof window !== "undefined" && "MediaSource" in window
      ? (window as any).MediaSource
      : null;
  return !!ms?.isTypeSupported && ms.isTypeSupported(`video/mp4; codecs="${codec}"`);
}

export function probeMseAudio(codec: string): boolean {
  const ms =
    typeof window !== "undefined" && "MediaSource" in window
      ? (window as any).MediaSource
      : null;
  return !!ms?.isTypeSupported && ms.isTypeSupported(`audio/mp4; codecs="${codec}"`);
}
