import assert from "node:assert/strict";
import { test } from "node:test";
import { decidePlayback } from "../src/lib/playback/engine/decidePlayback.ts";
import type { MediaDescriptor } from "../src/lib/playback/engine/mediaDescriptor.ts";
import type { ClientPlaybackProfile } from "../src/lib/playback/engine/clientProfile.ts";
import type { ServerPlaybackCapabilities } from "../src/lib/playback/engine/serverCapabilities.ts";

const FFMPEG_OK: ServerPlaybackCapabilities = {
  ffmpegAvailable: true,
  videoDecoders: [], videoEncoders: ["libx264"], audioDecoders: [], audioEncoders: ["aac"],
  hardwareAcceleration: {},
};
const FFMPEG_DOWN: ServerPlaybackCapabilities = { ...FFMPEG_OK, ffmpegAvailable: false };

function media(overrides: Partial<MediaDescriptor> = {}): MediaDescriptor {
  return {
    mediaId: "m1",
    source: { type: "local" },
    container: "matroska,webm",
    video: { index: 0, codec: "hevc", profile: "Main 10", level: "153", width: 3840, height: 2160, fps: 24, bitDepth: 10 },
    audioTracks: [{ index: 1, codec: "dts", channels: 6, default: true, forced: false }],
    subtitleTracks: [],
    ...overrides,
  };
}

function client(overrides: Partial<ClientPlaybackProfile> = {}): ClientPlaybackProfile {
  return {
    clientType: "desktop-web",
    deviceId: "d1",
    appVersion: "1.0",
    protocols: { progressive: true, hls: true, dash: true, mse: true },
    containers: ["mp4"],
    videoCapabilities: [{ codec: "hevc", hdr: ["sdr", "hdr10", "dolby-vision"] }],
    audioCapabilities: [{ codec: "aac", decode: true }],
    subtitleCapabilities: [{ codec: "subrip", nativeRender: true }],
    ...overrides,
  };
}

// ── plan §60 — the textbook example ──
test("§60: MKV/HEVC/DTS source, MP4/HEVC/AAC client → DIRECT_STREAM, video COPY, audio AAC, container MP4", () => {
  const plan = decidePlayback({ media: media(), client: client(), server: FFMPEG_OK });
  assert.equal(plan.mode, "DIRECT_STREAM");
  assert.equal(plan.videoAction, "COPY");
  assert.equal(plan.audioAction, "TRANSCODE");
  assert.equal(plan.targetAudioCodec, "aac");
  assert.equal(plan.containerAction, "REMUX");
  assert.equal(plan.targetContainer, "mp4");
});

// ── real bug found live: a 5.1 source transcoded with no downmix played back missing dialogue on a real 2.0 setup ──
test("a 6-channel source transcoded for a client capped at 2 channels sets targetAudioChannels — no silent channel drop", () => {
  const plan = decidePlayback({
    media: media({ audioTracks: [{ index: 1, codec: "dts", channels: 6, default: true, forced: false }] }),
    client: client({ audioCapabilities: [{ codec: "aac", decode: true, maxChannels: 2 }] }),
    server: FFMPEG_OK,
  });
  assert.equal(plan.audioAction, "TRANSCODE");
  assert.equal(plan.targetAudioCodec, "aac");
  assert.equal(plan.targetAudioChannels, 2);
});

test("a 2-channel source transcoded for a client capped at 2 channels never sets targetAudioChannels — nothing to downmix", () => {
  const plan = decidePlayback({
    media: media({ audioTracks: [{ index: 1, codec: "dts", channels: 2, default: true, forced: false }] }),
    client: client({ audioCapabilities: [{ codec: "aac", decode: true, maxChannels: 2 }] }),
    server: FFMPEG_OK,
  });
  assert.equal(plan.audioAction, "TRANSCODE"); // still transcodes: DTS itself isn't decodable
  assert.equal(plan.targetAudioChannels, undefined);
});

test("a client with no declared maxChannels at all never forces a downmix (channel count assumed fine)", () => {
  const plan = decidePlayback({
    media: media({ audioTracks: [{ index: 1, codec: "dts", channels: 6, default: true, forced: false }] }),
    client: client({ audioCapabilities: [{ codec: "aac", decode: true }] }), // no maxChannels
    server: FFMPEG_OK,
  });
  assert.equal(plan.audioAction, "TRANSCODE");
  assert.equal(plan.targetAudioChannels, undefined);
});

test("a 6-channel AAC source (codec already decodable) still gets flagged incompatible and downmixed when it exceeds the client's channel cap", () => {
  const plan = decidePlayback({
    media: media({ audioTracks: [{ index: 1, codec: "aac", channels: 6, default: true, forced: false }] }),
    client: client({ audioCapabilities: [{ codec: "aac", decode: true, maxChannels: 2 }] }),
    server: FFMPEG_OK,
  });
  assert.ok(plan.reasons.includes("AUDIO_CHANNELS_UNSUPPORTED"));
  assert.equal(plan.audioAction, "TRANSCODE");
  assert.equal(plan.targetAudioChannels, 2);
});

// ── plan §61 non-regression guarantees ──
test("§61: audio incompatible never forces a video transcode", () => {
  const plan = decidePlayback({
    media: media({ video: { index: 0, codec: "hevc", width: 1920, height: 1080 } }),
    client: client({ videoCapabilities: [{ codec: "hevc" }], audioCapabilities: [{ codec: "aac", decode: true }] }),
    server: FFMPEG_OK,
  });
  assert.notEqual(plan.mode, "TRANSCODE");
  assert.equal(plan.videoAction, "COPY");
  assert.equal(plan.audioAction, "TRANSCODE");
});

test("§61: container incompatible never forces a codec transcode (remux only)", () => {
  const plan = decidePlayback({
    media: media({ container: "matroska,webm", audioTracks: [{ index: 1, codec: "aac", channels: 2, default: true, forced: false }] }),
    client: client(),
    server: FFMPEG_OK,
  });
  assert.equal(plan.mode, "REMUX");
  assert.equal(plan.videoAction, "COPY");
  assert.equal(plan.audioAction, "COPY");
  assert.equal(plan.containerAction, "REMUX");
});

test("§61: a convertible text subtitle never forces a video transcode", () => {
  const plan = decidePlayback({
    media: media({
      container: "mov,mp4,m4a",
      audioTracks: [{ index: 1, codec: "aac", channels: 2, default: true, forced: false }],
      subtitleTracks: [{ index: 2, codec: "ass", type: "text", default: false, forced: false }],
    }),
    client: client({ subtitleCapabilities: [{ codec: "ass", convertible: true }] }),
    server: FFMPEG_OK,
    selectedSubtitle: 2,
  });
  assert.equal(plan.subtitleAction, "CONVERT");
  assert.equal(plan.videoAction, "COPY");
  assert.notEqual(plan.mode, "TRANSCODE");
});

test("§61: Plex is never chosen while ffmpeg is available, even when a transcode is required", () => {
  const plan = decidePlayback({
    media: media({ video: { index: 0, codec: "hevc", width: 3840, height: 2160 } }),
    client: client({ videoCapabilities: [{ codec: "h264" }] }), // HEVC unsupported → must transcode
    server: FFMPEG_OK,
  });
  assert.equal(plan.mode, "TRANSCODE");
  assert.notEqual(plan.mode, "PLEX_FALLBACK");
});

// ── TODO_POST_MOTEUR_LECTURE.md item 4 — server-power-aware encoder pick ──
test("item 4: no hardware encoder available → falls back to software with a fast preset (weak-server case)", () => {
  const plan = decidePlayback({
    media: media({ video: { index: 0, codec: "hevc", width: 3840, height: 2160 } }),
    client: client({ videoCapabilities: [{ codec: "h264" }] }),
    server: { ...FFMPEG_OK, videoEncoders: ["libx264"], hardwareAcceleration: {} },
  });
  assert.equal(plan.mode, "TRANSCODE");
  assert.equal(plan.targetVideoCodec, "h264");
  assert.equal(plan.videoEncoderImpl, "libx264");
  assert.equal(plan.encoderPreset, "veryfast");
});

test("item 4: a hardware encoder for the exact target codec is preferred over software, no preset needed", () => {
  const plan = decidePlayback({
    media: media({ video: { index: 0, codec: "hevc", width: 3840, height: 2160 } }),
    client: client({ videoCapabilities: [{ codec: "h264" }] }),
    server: { ...FFMPEG_OK, videoEncoders: ["libx264", "h264_nvenc"], hardwareAcceleration: { nvenc: true } },
  });
  assert.equal(plan.targetVideoCodec, "h264");
  assert.equal(plan.videoEncoderImpl, "h264_nvenc");
  assert.equal(plan.encoderPreset, undefined);
});

test("item 4: a hardware encoder for a DIFFERENT codec never gets picked for this one (per-codec check, not just the aggregate hardwareAcceleration flag)", () => {
  const plan = decidePlayback({
    media: media({ video: { index: 0, codec: "mpeg2video", width: 1920, height: 1080 } }),
    client: client({ videoCapabilities: [{ codec: "hevc" }] }), // only hevc offered → target is hevc
    // Server has an nvenc encoder, but only for h264 — not for the hevc target.
    server: { ...FFMPEG_OK, videoEncoders: ["libx264", "libx265", "h264_nvenc"], hardwareAcceleration: { nvenc: true } },
  });
  assert.equal(plan.targetVideoCodec, "hevc");
  assert.equal(plan.videoEncoderImpl, "libx265");
  assert.equal(plan.encoderPreset, "veryfast");
});

// ── real bug found live in production (2026-08-24): "ça retranscode toutes
// les 5 secondes" — a 4K source with no verified hardware encoder got
// targetVideoCodec=av1 purely from the client's decode preference, handing
// libsvtav1 a software encode it could not keep up with in real time
// (sampled live: ~2.0s of new playback per ~5.3s wall time). ──
test("no verified hardware encoder for ANY codec the client prefers → falls back to h264 target, not av1/hevc, to stay realtime-capable in software", () => {
  const plan = decidePlayback({
    media: media({ video: { index: 0, codec: "mpeg2video", width: 3840, height: 2160 } }),
    client: client({ videoCapabilities: [{ codec: "av1" }, { codec: "hevc" }, { codec: "h264" }] }),
    server: { ...FFMPEG_OK, videoEncoders: ["libx264", "libx265", "libsvtav1"], hardwareAcceleration: {} },
  });
  assert.equal(plan.targetVideoCodec, "h264");
  assert.equal(plan.videoEncoderImpl, "libx264");
  assert.equal(plan.encoderPreset, "veryfast");
});

test("a verified hardware encoder for av1 IS trusted and still preferred over h264 — hardware encoding doesn't have the software realtime problem", () => {
  const plan = decidePlayback({
    media: media({ video: { index: 0, codec: "mpeg2video", width: 3840, height: 2160 } }),
    client: client({ videoCapabilities: [{ codec: "av1" }, { codec: "hevc" }, { codec: "h264" }] }),
    server: { ...FFMPEG_OK, videoEncoders: ["libx264", "libx265", "libsvtav1", "av1_nvenc"], hardwareAcceleration: { nvenc: true } },
  });
  assert.equal(plan.targetVideoCodec, "av1");
  assert.equal(plan.videoEncoderImpl, "av1_nvenc");
  assert.equal(plan.encoderPreset, undefined);
});

test("§61: Plex is only chosen once ffmpeg itself is unavailable", () => {
  const plan = decidePlayback({
    media: media({ video: { index: 0, codec: "hevc", width: 3840, height: 2160 } }),
    client: client({ videoCapabilities: [{ codec: "h264" }] }),
    server: FFMPEG_DOWN,
  });
  assert.equal(plan.mode, "PLEX_FALLBACK");
  assert.ok(plan.reasons.includes("FFMPEG_UNAVAILABLE"));
  assert.ok(plan.reasons.includes("PLEX_FALLBACK_REQUESTED"));
});

// ── plan §74 success criteria — the four worked examples ──
test("§74 Cas 1: high-end Android TV, everything compatible → DIRECT_PLAY", () => {
  const plan = decidePlayback({
    media: media({
      container: "matroska,webm",
      video: { index: 0, codec: "hevc", profile: "Main 10", width: 3840, height: 2160, bitDepth: 10, hdr: { type: "hdr10" } },
      audioTracks: [{ index: 1, codec: "truehd", channels: 8, default: true, forced: false }],
      subtitleTracks: [{ index: 2, codec: "subrip", type: "text", default: false, forced: false }],
    }),
    client: client({
      clientType: "android-tv",
      containers: ["mkv", "mp4"],
      videoCapabilities: [{ codec: "hevc", bitDepths: [8, 10], hdr: ["sdr", "hdr10"] }],
      audioCapabilities: [{ codec: "truehd", passthrough: true }],
      subtitleCapabilities: [{ codec: "subrip", nativeRender: true }],
    }),
    server: FFMPEG_OK,
    selectedSubtitle: 2,
  });
  assert.equal(plan.mode, "DIRECT_PLAY");
  assert.equal(plan.videoAction, "COPY");
  assert.equal(plan.audioAction, "COPY");
  assert.equal(plan.containerAction, "COPY");
});

test("§74 Cas 2: desktop Edge — HEVC ok, TrueHD unsupported, MKV remuxed → DIRECT_STREAM", () => {
  const plan = decidePlayback({
    media: media({
      container: "matroska,webm",
      video: { index: 0, codec: "hevc", profile: "Main 10", width: 3840, height: 2160, bitDepth: 10, hdr: { type: "hdr10" } },
      audioTracks: [{ index: 1, codec: "truehd", channels: 8, default: true, forced: false }],
      subtitleTracks: [{ index: 2, codec: "subrip", type: "text", default: false, forced: false }],
    }),
    client: client({
      containers: ["mp4"],
      videoCapabilities: [{ codec: "hevc", bitDepths: [8, 10], hdr: ["sdr", "hdr10"] }],
      audioCapabilities: [{ codec: "aac", decode: true }], // no TrueHD
      subtitleCapabilities: [{ codec: "subrip", nativeRender: true }],
    }),
    server: FFMPEG_OK,
    selectedSubtitle: 2,
  });
  assert.equal(plan.mode, "DIRECT_STREAM");
  assert.equal(plan.videoAction, "COPY");
  assert.equal(plan.audioAction, "TRANSCODE");
  assert.equal(plan.targetAudioCodec, "aac");
  assert.equal(plan.containerAction, "REMUX");
  assert.equal(plan.subtitleAction, "DIRECT");
});

test("§74 Cas 3: old client — HEVC and DTS both unsupported → TRANSCODE (HEVC→H264, DTS→AAC)", () => {
  const plan = decidePlayback({
    media: media({
      container: "matroska,webm",
      video: { index: 0, codec: "hevc", width: 1920, height: 1080 },
      audioTracks: [{ index: 1, codec: "dts", channels: 6, default: true, forced: false }],
    }),
    client: client({
      videoCapabilities: [{ codec: "h264" }],
      audioCapabilities: [{ codec: "aac", decode: true }],
    }),
    server: FFMPEG_OK,
  });
  assert.equal(plan.mode, "TRANSCODE");
  assert.equal(plan.videoAction, "TRANSCODE");
  assert.equal(plan.targetVideoCodec, "h264");
  assert.equal(plan.audioAction, "TRANSCODE");
  assert.equal(plan.targetAudioCodec, "aac");
});

test("§74 Cas 4: total Movviz unavailability (no ffmpeg, video also needs transcoding) → PLEX_FALLBACK only then", () => {
  const plan = decidePlayback({
    media: media({ video: { index: 0, codec: "hevc", width: 1920, height: 1080 } }),
    client: client({ videoCapabilities: [{ codec: "h264" }] }),
    server: FFMPEG_DOWN,
  });
  assert.equal(plan.mode, "PLEX_FALLBACK");
});

// ── audio track selection ──
test("selectedAudio picks the requested track over the default one", () => {
  const plan = decidePlayback({
    media: media({
      audioTracks: [
        { index: 1, codec: "aac", channels: 2, default: true, forced: false },
        { index: 2, codec: "dts", channels: 6, default: false, forced: false },
      ],
    }),
    client: client({ audioCapabilities: [{ codec: "aac", decode: true }] }),
    server: FFMPEG_OK,
    selectedAudio: 2,
  });
  // Track 2 (DTS) was explicitly selected and isn't supported — must transcode, not silently fall back to track 1.
  assert.equal(plan.audioAction, "TRANSCODE");
});

// ── HDR / Dolby Vision ──
// Absolute rule (explicit instruction, 2026-08-24, after a real weak-hardware
// transcode fell permanently behind real time on HDR/DV content): an HDR/DV
// mismatch alone NEVER forces a video transcode any more — only a genuinely
// hard reason does. The video is still copied as-is; only audio/container
// change if THEY need it. Reason codes are still recorded for diagnostics.
test("Dolby Vision unsupported by client no longer forces a video transcode by itself — video stays COPY, DOLBY_VISION_UNSUPPORTED still recorded", () => {
  const plan = decidePlayback({
    media: media({ video: { index: 0, codec: "hevc", width: 1920, height: 1080, hdr: { type: "dolby-vision", dolbyVisionProfile: 7 } } }),
    client: client({ videoCapabilities: [{ codec: "hevc", hdr: ["sdr", "hdr10"] }] }), // no dolby-vision
    server: FFMPEG_OK,
  });
  // media()'s default audio (dts) and container (matroska,webm) both still
  // mismatch client()'s defaults (aac-only, mp4-only) — DIRECT_STREAM, not
  // DIRECT_PLAY, but video itself is never touched for the DV mismatch.
  assert.equal(plan.mode, "DIRECT_STREAM");
  assert.equal(plan.videoAction, "COPY");
  assert.ok(plan.reasons.includes("DOLBY_VISION_UNSUPPORTED"));
});

test("HDR10 supported by client → no transcode needed for HDR alone", () => {
  const plan = decidePlayback({
    media: media({
      container: "mov,mp4,m4a", // isolate HDR from the container check — matroska(default) vs this client's mp4-only containers would independently force a REMUX
      video: { index: 0, codec: "hevc", width: 1920, height: 1080, hdr: { type: "hdr10" } },
      audioTracks: [{ index: 1, codec: "aac", channels: 2, default: true, forced: false }],
    }),
    client: client({ videoCapabilities: [{ codec: "hevc", hdr: ["sdr", "hdr10"] }] }),
    server: FFMPEG_OK,
  });
  assert.equal(plan.mode, "DIRECT_PLAY");
});

// ── Phase 14: DV base-layer fallback + HDR→SDR tone mapping ──
test("§29: a backward-compatible Dolby Vision file (real base-layer id) direct-plays on an HDR10-only client, no transcode", () => {
  const plan = decidePlayback({
    media: media({
      container: "mov,mp4,m4a",
      video: { index: 0, codec: "hevc", width: 1920, height: 1080, hdr: { type: "dolby-vision", dolbyVisionProfile: 8, dolbyVisionBaseLayerCompatibility: "hdr10" } },
      audioTracks: [{ index: 1, codec: "aac", channels: 2, default: true, forced: false }],
    }),
    client: client({ videoCapabilities: [{ codec: "hevc", hdr: ["sdr", "hdr10"] }] }), // no dolby-vision declared
    server: FFMPEG_OK,
  });
  assert.equal(plan.mode, "DIRECT_PLAY");
  assert.ok(!plan.reasons.includes("DOLBY_VISION_UNSUPPORTED"));
});

test("§29: a non-backward-compatible Dolby Vision profile (no base-layer id) ALSO never forces a video transcode by itself now — same absolute rule applies regardless of backward-compatibility", () => {
  const plan = decidePlayback({
    media: media({ video: { index: 0, codec: "hevc", width: 1920, height: 1080, hdr: { type: "dolby-vision", dolbyVisionProfile: 5 } } }),
    client: client({ videoCapabilities: [{ codec: "hevc", hdr: ["sdr", "hdr10"] }] }),
    server: FFMPEG_OK,
  });
  assert.equal(plan.mode, "DIRECT_STREAM");
  assert.equal(plan.videoAction, "COPY");
  assert.ok(plan.reasons.includes("DOLBY_VISION_UNSUPPORTED"));
  // No video transcode is happening at all, so there's nothing to tonemap.
  assert.equal(plan.toneMap, undefined);
});

test("§29: HDR10 source with no matching client HDR capability at all → no longer forces a video transcode by itself, video still copied", () => {
  const plan = decidePlayback({
    media: media({ video: { index: 0, codec: "hevc", width: 1920, height: 1080, hdr: { type: "hdr10" } } }),
    client: client({ videoCapabilities: [{ codec: "hevc" }] }), // no hdr array at all
    server: FFMPEG_OK,
  });
  assert.equal(plan.mode, "DIRECT_STREAM");
  assert.equal(plan.videoAction, "COPY");
  assert.ok(plan.reasons.includes("HDR_UNSUPPORTED"));
  assert.equal(plan.toneMap, undefined);
});

test("§29: an HDR mismatch STILL sets toneMap and gets tonemapped when a video transcode is ALREADY forced for a real (hard) reason", () => {
  const plan = decidePlayback({
    media: media({ video: { index: 0, codec: "hevc", profile: "Main 10", width: 1920, height: 1080, hdr: { type: "hdr10" } } }),
    // Main 10 profile unsupported (hard reason, forces TRANSCODE regardless
    // of HDR) + no HDR capability declared (soft, sets toneMapNeeded) —
    // since a video transcode is happening anyway, the free color
    // correction is still applied.
    client: client({ videoCapabilities: [{ codec: "hevc", profiles: ["Main"] }] }),
    server: FFMPEG_OK,
  });
  assert.equal(plan.mode, "TRANSCODE");
  assert.ok(plan.reasons.includes("VIDEO_PROFILE_UNSUPPORTED"));
  assert.ok(plan.reasons.includes("HDR_UNSUPPORTED"));
  assert.equal(plan.toneMap, true);
});

test("§29: an SDR source never sets toneMap even when the video needs a transcode for an unrelated reason", () => {
  const plan = decidePlayback({
    media: media({ video: { index: 0, codec: "hevc", width: 3840, height: 2160 } }), // no hdr field at all — SDR
    client: client({ videoCapabilities: [{ codec: "h264" }] }), // hevc unsupported → forces transcode
    server: FFMPEG_OK,
  });
  assert.equal(plan.mode, "TRANSCODE");
  assert.equal(plan.toneMap, undefined);
});

// ── resolution cap on forced transcodes (real gap found by an audit agent — no downscale ever applied before this) ──
test("client resolution limit forces the transcode down to the client's own maxWidth", () => {
  const plan = decidePlayback({
    media: media({ video: { index: 0, codec: "hevc", width: 3840, height: 2160 } }),
    client: client({ videoCapabilities: [{ codec: "h264", maxWidth: 1920, maxHeight: 1080 }] }), // hevc unsupported at all → target h264, and h264 itself caps at 1080p
    server: FFMPEG_OK,
  });
  assert.equal(plan.mode, "TRANSCODE");
  assert.equal(plan.targetVideoWidth, 1920);
});

test("a software encoder (no hardware available) caps a 4K source at 1920 even with no client resolution limit — weak-server speed safety net", () => {
  const plan = decidePlayback({
    media: media({ video: { index: 0, codec: "hevc", width: 3840, height: 2160 } }),
    client: client({ videoCapabilities: [{ codec: "h264" }] }), // no maxWidth declared
    server: { ...FFMPEG_OK, videoEncoders: ["libx264"], hardwareAcceleration: {} }, // no hardware encoder
  });
  assert.equal(plan.videoEncoderImpl, "libx264");
  assert.equal(plan.targetVideoWidth, 1920);
});

// ── real bug found live in production (2026-08-24): "Dragons" (4K Dolby
// Vision) still fell hopelessly behind real time even after the h264
// software-target fix AND the 1920px cap — the zscale/tonemap HDR→SDR chain
// is a real, substantial extra cost on top of decode+scale+encode, isolated
// by elimination (same-resolution SDR 4K software transcode, no tonemap,
// stayed ahead of real time at the same 1920px cap — see "Soixante 9" in
// the same session). ──
// Video Profile "Main" (not "Main 10") is the hard reason forcing TRANSCODE
// here — HDR mismatch alone no longer would (absolute rule above). Keeps
// this test's real purpose (tonemap's resolution/preset impact once a
// transcode is already unavoidable) intact without relying on behavior that
// no longer exists, and avoids declaring a client maxWidth (which would
// short-circuit pickTargetVideoWidth before the tonemap-specific cap ever
// applies).
test("software encoding a source that ALSO needs HDR→SDR tonemap gets a tighter resolution cap than plain software transcode", () => {
  const plan = decidePlayback({
    media: media({
      video: { index: 0, codec: "hevc", profile: "Main 10", width: 3840, height: 2160, hdr: { type: "hdr10" } },
    }),
    client: client({ videoCapabilities: [{ codec: "hevc", profiles: ["Main"] }] }),
    server: { ...FFMPEG_OK, videoEncoders: ["libx264", "libx265"], hardwareAcceleration: {} },
  });
  assert.equal(plan.mode, "TRANSCODE");
  assert.equal(plan.toneMap, true);
  assert.equal(plan.videoEncoderImpl, "libx265");
  assert.equal(plan.targetVideoWidth, 720);
  assert.equal(plan.encoderPreset, "ultrafast");
});

test("a hardware encoder with tonemap still gets NO software-speed cap — a real GPU handles tonemap+encode at real time too", () => {
  const plan = decidePlayback({
    media: media({
      video: { index: 0, codec: "hevc", profile: "Main 10", width: 3840, height: 2160, hdr: { type: "hdr10" } },
    }),
    client: client({ videoCapabilities: [{ codec: "hevc", profiles: ["Main"] }] }),
    server: { ...FFMPEG_OK, videoEncoders: ["libx265", "hevc_nvenc"], hardwareAcceleration: { nvenc: true } },
  });
  assert.equal(plan.mode, "TRANSCODE");
  assert.equal(plan.toneMap, true);
  assert.equal(plan.videoEncoderImpl, "hevc_nvenc");
  assert.equal(plan.targetVideoWidth, undefined);
  assert.equal(plan.encoderPreset, undefined);
});

test("a hardware encoder never gets a software-speed resolution cap — real GPU/QSV/etc. keeps up with 4K at real time", () => {
  const plan = decidePlayback({
    media: media({ video: { index: 0, codec: "hevc", width: 3840, height: 2160 } }),
    client: client({ videoCapabilities: [{ codec: "h264" }] }),
    server: { ...FFMPEG_OK, videoEncoders: ["libx264", "h264_nvenc"], hardwareAcceleration: { nvenc: true } },
  });
  assert.equal(plan.videoEncoderImpl, "h264_nvenc");
  assert.equal(plan.targetVideoWidth, undefined);
});

test("a source already at or under 1920 wide never gets a resolution target — nothing to downscale", () => {
  const plan = decidePlayback({
    media: media({ video: { index: 0, codec: "hevc", width: 1280, height: 720 } }),
    client: client({ videoCapabilities: [{ codec: "h264" }] }),
    server: { ...FFMPEG_OK, videoEncoders: ["libx264"], hardwareAcceleration: {} },
  });
  assert.equal(plan.targetVideoWidth, undefined);
});

// ── subtitles ──
test("PGS (image) subtitle with no image-capable client → BURN, and only then a video transcode", () => {
  const plan = decidePlayback({
    media: media({
      container: "mov,mp4,m4a",
      audioTracks: [{ index: 1, codec: "aac", channels: 2, default: true, forced: false }],
      subtitleTracks: [{ index: 2, codec: "hdmv_pgs_subtitle", type: "image", default: false, forced: false }],
    }),
    client: client({ subtitleCapabilities: [{ codec: "hdmv_pgs_subtitle", embeddedSupported: false }] }),
    server: FFMPEG_OK,
    selectedSubtitle: 2,
  });
  assert.equal(plan.subtitleAction, "BURN");
  assert.equal(plan.mode, "TRANSCODE");
  assert.ok(plan.reasons.includes("SUBTITLE_BURN_REQUIRED"));
});

test("no subtitle selected → subtitleAction NONE, never influences the plan", () => {
  const plan = decidePlayback({
    media: media({ container: "mov,mp4,m4a", audioTracks: [{ index: 1, codec: "aac", channels: 2, default: true, forced: false }] }),
    client: client(),
    server: FFMPEG_OK,
    selectedSubtitle: null,
  });
  assert.equal(plan.subtitleAction, "NONE");
  assert.equal(plan.mode, "DIRECT_PLAY");
});

// ── reasons are always populated on anything less than a clean direct play ──
test("every non-direct-play plan carries at least one reason", () => {
  const plan = decidePlayback({
    media: media({ audioTracks: [{ index: 1, codec: "dts", channels: 6, default: true, forced: false }] }),
    client: client(),
    server: FFMPEG_OK,
  });
  assert.notEqual(plan.mode, "DIRECT_PLAY");
  assert.ok(plan.reasons.length > 0);
});
