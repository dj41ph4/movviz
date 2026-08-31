from pathlib import Path
import re


def replace_once(text: str, old: str, new: str, label: str) -> str:
    if old not in text:
        raise SystemExit(f"missing anchor: {label}")
    return text.replace(old, new, 1)

# ---------------------------------------------------------------------------
# 1) Browser codec detection: MediaCapabilities is the primary/native truth.
#    WebCodecs/canPlayType are fallbacks only when MediaCapabilities is absent.
#    MSE stays a separate capability domain and is never treated as proof that
#    a progressive <video> source can decode the same audio codec.
# ---------------------------------------------------------------------------
p = Path("src/lib/player/webcodecs.ts")
s = p.read_text(encoding="utf-8")

s = replace_once(
    s,
    "  webcodecsAvailable: boolean;\n",
    "  webcodecsAvailable: boolean;\n  /** MediaCapabilities.decodingInfo() is available for native/file probing. */\n  mediaCapabilitiesAvailable: boolean;\n",
    "CodecCapabilities.mediaCapabilitiesAvailable",
)

s = replace_once(
    s,
    "    webcodecsAvailable: false,\n",
    "    webcodecsAvailable: false,\n    mediaCapabilitiesAvailable: false,\n",
    "result.mediaCapabilitiesAvailable",
)

anchor = """  const videoEl = typeof document !== \"undefined\"\n    ? document.createElement(\"video\")\n    : null;\n\n"""
insert = """  const videoEl = typeof document !== \"undefined\"\n    ? document.createElement(\"video\")\n    : null;\n\n  // Native/file audio capability: prefer MediaCapabilities because it asks\n  // the browser about the actual browser + OS + device decoding stack and is\n  // explicitly designed to supersede canPlayType()/isTypeSupported() for\n  // capability decisions. A negative answer here is authoritative for direct\n  // progressive playback; WebCodecs is only a fallback when this API is not\n  // present, because a raw AudioDecoder being configurable does NOT prove the\n  // HTMLMediaElement pipeline can render the same codec/container.\n  const mediaAudioResolved = new Set<keyof CodecCapabilities>();\n  const mediaCaps = typeof navigator !== \"undefined\" ? navigator.mediaCapabilities : undefined;\n  if (mediaCaps?.decodingInfo) {\n    result.mediaCapabilitiesAvailable = true;\n    const checks: Array<[keyof CodecCapabilities, string, number]> = [\n      [\"aac\", 'audio/mp4; codecs=\"mp4a.40.2\"', 2],\n      [\"ac3\", 'audio/mp4; codecs=\"ac-3\"', 6],\n      [\"eac3\", 'audio/mp4; codecs=\"ec-3\"', 6],\n      [\"opus\", 'audio/webm; codecs=\"opus\"', 2],\n      [\"flac\", 'audio/flac', 2],\n      [\"mp3\", 'audio/mpeg', 2],\n    ];\n    for (const [key, contentType, channels] of checks) {\n      try {\n        const info = await mediaCaps.decodingInfo({\n          type: \"file\",\n          audio: {\n            contentType,\n            channels: String(channels),\n            bitrate: key === \"ac3\" || key === \"eac3\" ? 640_000 : 320_000,\n            samplerate: 48_000,\n          },\n        });\n        result[key] = info.supported === true;\n        mediaAudioResolved.add(key);\n      } catch {\n        // Invalid/unknown codec declarations are an explicit native \"no\".\n        result[key] = false;\n        mediaAudioResolved.add(key);\n      }\n    }\n  }\n\n"""
s = replace_once(s, anchor, insert, "MediaCapabilities insertion")

s = replace_once(
    s,
    """    const audioChecks: Array<[keyof CodecCapabilities, string]> = [\n      [\"aac\", \"mp4a.40.2\"],\n      [\"ac3\", \"ac-3\"],\n      [\"opus\", \"opus\"],\n      [\"flac\", \"flac\"],\n      [\"mp3\", \"mp3\"],\n    ];\n\n    for (const [key, codec] of audioChecks) {\n      try {\n        const supported = await (window as any).AudioDecoder.isConfigSupported({\n          codec,\n          sampleRate: 48000,\n          numberOfChannels: 6,\n        });\n        result[key] = supported?.supported === true;\n      } catch {\n        result[key] = false;\n      }\n    }\n""",
    """    const audioChecks: Array<[keyof CodecCapabilities, string]> = [\n      [\"aac\", \"mp4a.40.2\"],\n      [\"ac3\", \"ac-3\"],\n      [\"eac3\", \"ec-3\"],\n      [\"opus\", \"opus\"],\n      [\"flac\", \"flac\"],\n      [\"mp3\", \"mp3\"],\n    ];\n\n    for (const [key, codec] of audioChecks) {\n      if (mediaAudioResolved.has(key)) continue;\n      try {\n        const supported = await (window as any).AudioDecoder.isConfigSupported({\n          codec,\n          sampleRate: 48000,\n          numberOfChannels: 6,\n        });\n        result[key] = supported?.supported === true;\n      } catch {\n        result[key] = false;\n      }\n    }\n""",
    "WebCodecs audio fallback",
)

# canPlayType must not override a definitive MediaCapabilities answer.
for key, old in [
    ("aac", "    if (!result.aac) {"),
    ("opus", "    if (!result.opus) {"),
    ("ac3", "    if (!result.ac3) {"),
    ("eac3", "    if (!result.eac3) {"),
    ("flac", "    if (!result.flac) {"),
    ("mp3", "    if (!result.mp3) {"),
]:
    new = f'    if (!mediaAudioResolved.has("{key}") && !result.{key}) {{'
    s = replace_once(s, old, new, f"canPlayType {key} fallback")

# Never alias native AC-3 support into MSE support. They are different paths.
s = re.sub(
    r"\n    if \(!result\.mseAc3\) \{\n      // Last resort:[\s\S]*?\n      result\.mseAc3 = result\.ac3;\n    \}\n",
    "\n",
    s,
    count=1,
)

# Rewrite the two public policy functions so direct/native and MSE are strict.
s = re.sub(
    r"export function shouldForceAudioTranscode\(codec: string, caps: CodecCapabilities\): boolean \{[\s\S]*?\n\}\n\nexport function isAudioCodecSupported",
    """export function shouldForceAudioTranscode(codec: string, caps: CodecCapabilities): boolean {\n  const c = codec.toLowerCase();\n  // First gate is structural: if hls.js cannot carry the codec through the\n  // MPEG-TS/fMP4 path at all, AAC transcode is mandatory.\n  if (!isAudioMseTransmuxable(c)) return true;\n  // AC-3 copy is allowed on the MSE path only when MediaSource itself says\n  // it can create that SourceBuffer. Native/file support is intentionally\n  // ignored here: a codec can work in <video src> and still be impossible in\n  // MSE, or the reverse.\n  if (c.includes(\"ac3\") || c === \"ac-3\" || c.includes(\"dolby\")) return !caps.mseAc3;\n  if (c === \"mp3\" || c === \"mp4a.40.34\" || c === \"mp2\") return !(caps.mseMp3 || caps.mp3);\n  return false;\n}\n\nexport function isAudioCodecSupported",
    s,
    count=1,
)

s = re.sub(
    r"export function isAudioCodecSupported\(codec: string, caps: CodecCapabilities\): boolean \{[\s\S]*?\n\}\s*$",
    """export function isAudioCodecSupported(codec: string, caps: CodecCapabilities): boolean {\n  const c = codec.toLowerCase();\n  // DIRECT/progressive capability only. MSE flags are deliberately excluded:\n  // MediaSource support is not proof that HTMLMediaElement can decode the same\n  // codec when the file is assigned directly to <video src>.\n  if (c === \"eac3\" || c === \"ec-3\") return caps.eac3;\n  if (c.includes(\"ac3\") || c === \"ac-3\" || c.includes(\"dolby\")) return caps.ac3;\n  if (c.includes(\"opus\")) return caps.opus;\n  if (c === \"flac\") return caps.flac;\n  if (c.includes(\"mp3\") || c === \"mp4a.40.34\" || c === \"mp2\") return caps.mp3;\n  if (c.includes(\"aac\") || c.includes(\"mp4a\")) return caps.aac;\n  // DTS/TrueHD/PCM/WMA/Vorbis and unknown codecs are not trusted for native\n  // desktop-web direct play. The planner will keep video COPY and convert\n  // only audio when video itself is compatible.\n  return false;\n}\n""",
    s,
    count=1,
)

p.write_text(s, encoding="utf-8")

# ---------------------------------------------------------------------------
# 2) Desktop player: remove live silence-energy escalation. Compatibility is
#    decided before playback. Seek/resume can therefore never be interpreted
#    as "silent codec" and cannot accidentally switch engine mid-session.
# ---------------------------------------------------------------------------
p = Path("src/components/player/VideoPlayer.tsx")
s = p.read_text(encoding="utf-8")
s = s.replace('import { watchForSilentAudio } from "@/lib/player/silentAudioDetector";\n', "")

# Remove detector refs + their explanatory block.
s = re.sub(
    r"\n  const stopSilentWatchRef = useRef<\(\(\) => void\) \| null>\(null\);\n(?:  //.*\n)*  const awaitingAudioConfirmationRef = useRef\(false\);\n",
    "\n",
    s,
    count=1,
)

# Remove all actual watch installations, whether one-line or multi-line.
lines = s.splitlines(True)
out = []
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

# Remove now-empty detector-only guard blocks.
s = re.sub(r"\n\s*if \(attemptingHlsAudioCopy && !isCopyNetworkRetry\) \{\s*\}\n", "\n", s)

# The opaque optimization cover now follows the real playing/canplay signal;
# there is no pending detector verdict to wait for.
s = s.replace(
    "      if (!awaitingAudioConfirmationRef.current) setOptimizing(false);",
    "      setOptimizing(false);",
)

# Deterministic pre-decision: native audio incompatibility is a reason to skip
# direct play, but never a reason to mark the video for transcode.
old_strategy = """        strategy = betaRef.current.playbackEngine === \"ffmpeg\" || audioSwitched || (info.videoCodec && !isVideoCodecSupported(info.videoCodec, caps))\n          ? \"transcode\"\n          : \"direct\";\n"""
new_strategy = """        const nativeAudioUnsupported = !!effectiveAudioCodec && !isAudioCodecSupported(effectiveAudioCodec, caps);\n        if (nativeAudioUnsupported) transcodeAudioRef.current = true;\n        strategy = betaRef.current.playbackEngine === \"ffmpeg\" || audioSwitched || nativeAudioUnsupported || (info.videoCodec && !isVideoCodecSupported(info.videoCodec, caps))\n          ? \"transcode\"\n          : \"direct\";\n"""
s = replace_once(s, old_strategy, new_strategy, "deterministic direct audio gate")

# Clean the most misleading stale prose; behavior is now preflight-based.
s = s.replace(
    "// Direct play is now the unconditional first attempt — the manual",
    "// Direct play is preferred only when the selected native audio/video codecs are confirmed compatible — the manual",
)
s = s.replace("error/silent-audio\n", "error\n")
s = s.replace("+ watchForSilentAudio, exactly as it\n", "+ deterministic client capability checks, while genuine media errors remain the final safety net.\n")
s = s.replace("ffmpegActiveRef.current = true;\n", "ffmpegActiveRef.current = true;\n")
s = s.replace("// ffmpeg-remuxed HLS/progressive). Gated on awaitingAudioConfirmationRef\n", "// ffmpeg-remuxed HLS/progressive).\n")
s = s.replace("// so it can't prematurely lift the \"optimizing\" cover for a throwaway\n", "")
s = s.replace("// direct-play attempt whose own audio verdict (silent → escalate) is\n", "")
s = s.replace("// still pending — see startDirect()/escalateSilentToFfmpeg() above.\n", "")

# No runtime call/import may survive.
if "watchForSilentAudio(" in s or 'silentAudioDetector' in s:
    raise SystemExit("silent audio detector still referenced in VideoPlayer")

p.write_text(s, encoding="utf-8")

# Remove the detector module entirely once no runtime code references it.
detector = Path("src/lib/player/silentAudioDetector.ts")
if detector.exists():
    detector.unlink()

# ---------------------------------------------------------------------------
# 3) Regression tests for the key path separation.
# ---------------------------------------------------------------------------
test = Path("scripts/webcodecs-policy.test.ts")
test.write_text(r'''import test from "node:test";
import assert from "node:assert/strict";
import {
  isAudioCodecSupported,
  shouldForceAudioTranscode,
  type CodecCapabilities,
} from "../src/lib/player/webcodecs.ts";

function caps(overrides: Partial<CodecCapabilities> = {}): CodecCapabilities {
  return {
    hevc: true,
    av1: true,
    h264: true,
    ac3: false,
    eac3: false,
    aac: true,
    opus: true,
    flac: true,
    mp3: true,
    mseAc3: false,
    mseEac3: false,
    mseMp3: true,
    webcodecsAvailable: true,
    mediaCapabilitiesAvailable: true,
    hevcMain10: true,
    av1Main10: true,
    hevc4k: true,
    av1_4k: true,
    h264_4k: true,
    ...overrides,
  };
}

test("MSE AC-3 support never masquerades as native direct-play support", () => {
  const c = caps({ ac3: false, mseAc3: true });
  assert.equal(isAudioCodecSupported("ac3", c), false);
  assert.equal(shouldForceAudioTranscode("ac3", c), false);
});

test("native AC-3 support does not authorize an unsupported MSE copy", () => {
  const c = caps({ ac3: true, mseAc3: false });
  assert.equal(isAudioCodecSupported("ac-3", c), true);
  assert.equal(shouldForceAudioTranscode("ac-3", c), true);
});

test("E-AC3/DTS/TrueHD remain audio-transcode-only candidates on the HLS/MSE path", () => {
  const c = caps({ eac3: true, mseEac3: true });
  assert.equal(shouldForceAudioTranscode("eac3", c), true);
  assert.equal(shouldForceAudioTranscode("dts", c), true);
  assert.equal(shouldForceAudioTranscode("truehd", c), true);
});

test("universal AAC remains native and copyable", () => {
  const c = caps();
  assert.equal(isAudioCodecSupported("aac", c), true);
  assert.equal(shouldForceAudioTranscode("aac", c), false);
});
''', encoding="utf-8")

# Repository-wide guard: the old detector must no longer be imported/called.
for path in Path("src").rglob("*.ts*"):
    if path == Path("src/lib/player/silentAudioDetector.ts"):
        continue
    text = path.read_text(encoding="utf-8", errors="ignore")
    if "watchForSilentAudio(" in text or 'from "@/lib/player/silentAudioDetector"' in text:
        raise SystemExit(f"remaining silence detector dependency: {path}")

print("codec capability v2 patch applied")
