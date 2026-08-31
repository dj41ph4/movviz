from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    return text.replace(old, new, 1)


# ---------------------------------------------------------------------------
# Browser codec detection
# ---------------------------------------------------------------------------
p = Path("src/lib/player/webcodecs.ts")
s = p.read_text(encoding="utf-8")

s = replace_once(
    s,
    "  webcodecsAvailable: boolean;\n",
    "  webcodecsAvailable: boolean;\n  /** MediaCapabilities.decodingInfo() is available for native/file probing. */\n  mediaCapabilitiesAvailable: boolean;\n",
    "capability interface",
)
s = replace_once(
    s,
    "    webcodecsAvailable: false,\n",
    "    webcodecsAvailable: false,\n    mediaCapabilitiesAvailable: false,\n",
    "capability defaults",
)

anchor = '''  const videoEl = typeof document !== "undefined"
    ? document.createElement("video")
    : null;

'''
insert = '''  const videoEl = typeof document !== "undefined"
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

'''
s = replace_once(s, anchor, insert, "MediaCapabilities insertion")

old_audio_checks = '''    const audioChecks: Array<[keyof CodecCapabilities, string]> = [
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
'''
new_audio_checks = '''    const audioChecks: Array<[keyof CodecCapabilities, string]> = [
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
'''
s = replace_once(s, old_audio_checks, new_audio_checks, "WebCodecs audio fallback")

for key in ("aac", "opus", "ac3", "eac3", "flac", "mp3"):
    old = f"    if (!result.{key}) {{"
    new = f'    if (!mediaAudioResolved.has("{key}") && !result.{key}) {{'
    s = replace_once(s, old, new, f"canPlayType {key}")

# Do not synthesize MSE support from native support.
s = re.sub(
    r'\n    if \(!result\.mseAc3\) \{\n      // Last resort:[\s\S]*?\n      result\.mseAc3 = result\.ac3;\n    \}\n',
    '\n',
    s,
    count=1,
)

start = s.index("export function shouldForceAudioTranscode")
mid = s.index("export function isAudioCodecSupported", start)
new_force = '''export function shouldForceAudioTranscode(codec: string, caps: CodecCapabilities): boolean {
  const c = codec.toLowerCase();
  if (!isAudioMseTransmuxable(c)) return true;
  // MSE is its own capability domain. Native/file support never authorizes
  // an MSE copy, and MSE support never authorizes direct <video src>.
  if (c.includes("ac3") || c === "ac-3" || c.includes("dolby")) return !caps.mseAc3;
  if (c === "mp3" || c === "mp4a.40.34" || c === "mp2") return !(caps.mseMp3 || caps.mp3);
  return false;
}

'''
s = s[:start] + new_force + s[mid:]

start = s.index("export function isAudioCodecSupported")
new_native = '''export function isAudioCodecSupported(codec: string, caps: CodecCapabilities): boolean {
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
'''
s = s[:start] + new_native
p.write_text(s, encoding="utf-8")


# ---------------------------------------------------------------------------
# Desktop player: remove live silence-energy decisions.
# ---------------------------------------------------------------------------
p = Path("src/components/player/VideoPlayer.tsx")
s = p.read_text(encoding="utf-8")
s = s.replace('import { watchForSilentAudio } from "@/lib/player/silentAudioDetector";\n', "")

s = re.sub(
    r'\n  const stopSilentWatchRef = useRef<\(\(\) => void\) \| null>\(null\);\n(?:  //.*\n)*  const awaitingAudioConfirmationRef = useRef\(false\);\n',
    '\n',
    s,
    count=1,
)

# Strip any watch call, including the multi-line direct-play call with options.
lines = s.splitlines(True)
out: list[str] = []
i = 0
while i < len(lines):
    line = lines[i]
    if "stopSilentWatchRef.current = watchForSilentAudio(" in line:
        depth = line.count("(") - line.count(")")
        i += 1
        while i < len(lines) and depth > 0:
            depth += lines[i].count("(") - lines[i].count(")")
            i += 1
        continue
    if "stopSilentWatchRef.current?.()" in line or "stopSilentWatchRef.current = null" in line:
        i += 1
        continue
    if "awaitingAudioConfirmationRef.current =" in line:
        i += 1
        continue
    out.append(line)
    i += 1
s = "".join(out)

s = re.sub(r'\n\s*if \(attemptingHlsAudioCopy && !isCopyNetworkRetry\) \{\s*\}\n', '\n', s)
s = s.replace("      if (!awaitingAudioConfirmationRef.current) setOptimizing(false);", "      setOptimizing(false);")

old_strategy = '''        strategy = betaRef.current.playbackEngine === "ffmpeg" || audioSwitched || (info.videoCodec && !isVideoCodecSupported(info.videoCodec, caps))
          ? "transcode"
          : "direct";
'''
new_strategy = '''        const nativeAudioUnsupported = !!effectiveAudioCodec && !isAudioCodecSupported(effectiveAudioCodec, caps);
        if (nativeAudioUnsupported) transcodeAudioRef.current = true;
        strategy = betaRef.current.playbackEngine === "ffmpeg" || audioSwitched || nativeAudioUnsupported || (info.videoCodec && !isVideoCodecSupported(info.videoCodec, caps))
          ? "transcode"
          : "direct";
'''
s = replace_once(s, old_strategy, new_strategy, "native audio direct gate")

# Comments only: remove stale wording that claims silence-energy is part of
# the runtime contract. No behavior is derived from these replacements.
s = s.replace("error/silent-audio\n", "error\n")
s = s.replace("watchForSilentAudio", "codec capability preflight")
s = s.replace("awaitingAudioConfirmationRef", "codecCapabilityPreflight")

if 'silentAudioDetector' in s or "watchForSilentAudio(" in s:
    raise SystemExit("silence detector still referenced by VideoPlayer")
p.write_text(s, encoding="utf-8")

# Delete the old runtime module after all references are gone.
detector = Path("src/lib/player/silentAudioDetector.ts")
if detector.exists():
    detector.unlink()


# ---------------------------------------------------------------------------
# Regression tests
# ---------------------------------------------------------------------------
Path("scripts/webcodecs-policy.test.ts").write_text('''import test from "node:test";
import assert from "node:assert/strict";
import {
  isAudioCodecSupported,
  shouldForceAudioTranscode,
  type CodecCapabilities,
} from "../src/lib/player/webcodecs.ts";

function caps(overrides: Partial<CodecCapabilities> = {}): CodecCapabilities {
  return {
    hevc: true, av1: true, h264: true,
    ac3: false, eac3: false, aac: true, opus: true, flac: true, mp3: true,
    mseAc3: false, mseEac3: false, mseMp3: true,
    webcodecsAvailable: true, mediaCapabilitiesAvailable: true,
    hevcMain10: true, av1Main10: true, hevc4k: true, av1_4k: true, h264_4k: true,
    ...overrides,
  };
}

test("MSE AC-3 support never masquerades as native direct support", () => {
  const c = caps({ ac3: false, mseAc3: true });
  assert.equal(isAudioCodecSupported("ac3", c), false);
  assert.equal(shouldForceAudioTranscode("ac3", c), false);
});

test("native AC-3 never authorizes unsupported MSE copy", () => {
  const c = caps({ ac3: true, mseAc3: false });
  assert.equal(isAudioCodecSupported("ac-3", c), true);
  assert.equal(shouldForceAudioTranscode("ac-3", c), true);
});

test("E-AC3 DTS TrueHD stay audio-transcode candidates", () => {
  const c = caps({ eac3: true, mseEac3: true });
  assert.equal(shouldForceAudioTranscode("eac3", c), true);
  assert.equal(shouldForceAudioTranscode("dts", c), true);
  assert.equal(shouldForceAudioTranscode("truehd", c), true);
});

test("AAC remains native and copyable", () => {
  const c = caps();
  assert.equal(isAudioCodecSupported("aac", c), true);
  assert.equal(shouldForceAudioTranscode("aac", c), false);
});
''', encoding="utf-8")

for path in Path("src").rglob("*.ts*"):
    text = path.read_text(encoding="utf-8", errors="ignore")
    if 'from "@/lib/player/silentAudioDetector"' in text or "watchForSilentAudio(" in text:
        raise SystemExit(f"remaining silence detector dependency: {path}")

print("codec capability v2 patch applied")
