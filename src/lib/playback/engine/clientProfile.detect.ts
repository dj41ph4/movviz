"use client";

/**
 * Phase 3 of the playback engine rewrite (see PLAN_REFONTE_MOTEUR_LECTURE_MOVVIZ.md
 * §14 "Détection Desktop"). Maps the browser's *already-real* codec probing
 * (WebCodecs + canPlayType, see src/lib/player/webcodecs.ts — this predates
 * the engine rewrite and is reused as-is, not duplicated) into the new
 * `ClientPlaybackProfile` shape. Nothing calls this yet — it exists so the
 * (future) `/api/playback/prepare` client can report real capabilities
 * instead of guessing from the User-Agent (plan §14: "Éviter les règles
 * statiques basées uniquement sur le User-Agent").
 *
 * HDR support (VideoCapability.hdr) is probed via `matchMedia`, not
 * guessed from codec decode alone — see `detectHdrSupport()` below.
 */

import { detectCodecs } from "@/lib/player/webcodecs";
import { detectCapabilities } from "../capabilities";
import type { AudioCapability, ClientPlaybackProfile, SubtitleCapability, VideoCapability } from "./clientProfile";
import type { HdrType } from "./mediaDescriptor";

/**
 * Real HDR video capability, verified live in a real browser (2026-08-24):
 * `matchMedia("(dynamic-range: high)")` reports the DISPLAY's general HDR
 * capability — true even when the browser isn't actually rendering HDR
 * video right now — while `matchMedia("(video-dynamic-range: high)")` was
 * false at the exact same time on that same real HDR-capable monitor. The
 * `video-` variant is deliberately used here despite being more
 * conservative (fewer clients get "hdr10" declared) because a false "yes"
 * is the expensive mistake: since v1.19.13, an HDR/DV mismatch never forces
 * a transcode any more regardless of this value, so the only thing this
 * capability now controls is whether `toneMapNeeded` is honored — wrongly
 * skipping a needed tonemap (source HDR values shown raw as if SDR) is a
 * real visible bug, wrongly tonemapping a client that could have shown
 * real HDR is just a missed opportunity, not a defect.
 */
function detectHdrSupport(): HdrType[] {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return ["sdr"];
  const hasHdrVideo = window.matchMedia("(video-dynamic-range: high)").matches;
  return hasHdrVideo ? ["sdr", "hdr10", "hlg"] : ["sdr"];
}

export async function detectDesktopClientProfile(deviceId: string, appVersion: string): Promise<ClientPlaybackProfile> {
  const [codecs, browserCaps] = await Promise.all([detectCodecs(), detectCapabilities()]);

  // maxWidth/maxHeight left unset (unbounded) once the codec is confirmed
  // to decode at 3840x2160 — checkVideoCompatibility() (decidePlayback.ts)
  // treats an unset cap as "no resolution limit to enforce", which is
  // correct here (there's no reason to invent an artificial ceiling above
  // the one real resolution actually probed). When the 4K probe comes back
  // false, the known-good 1080p ceiling from the base flag above is the
  // honest limit — NOT "leave it unset", which previously meant every video
  // capability silently skipped the VIDEO_RESOLUTION_UNSUPPORTED check
  // entirely regardless of the source's real resolution.
  const res4k = (supports4k: boolean) => (supports4k ? {} : { maxWidth: 1920, maxHeight: 1080 });

  const hdr = detectHdrSupport();
  const videoCapabilities: VideoCapability[] = [];
  if (codecs.h264) videoCapabilities.push({ codec: "h264", bitDepths: [8], ...res4k(codecs.h264_4k) });
  // bitDepths: [8] always (the base `hevc` flag only ever probed 8-bit Main)
  // — 10 added only when hevcMain10 independently confirms it, since most
  // real HDR/UHD content (this app's own test library included) is Main10
  // and a browser that can't decode it needs VIDEO_BIT_DEPTH_UNSUPPORTED to
  // actually fire instead of being silently skipped. hdr only declared on
  // hevc/av1 — real-world HDR-graded H.264 content is exotic enough not to
  // be worth the extra surface here.
  if (codecs.hevc) videoCapabilities.push({ codec: "hevc", bitDepths: codecs.hevcMain10 ? [8, 10] : [8], hdr, ...res4k(codecs.hevc4k) });
  if (codecs.av1) videoCapabilities.push({ codec: "av1", bitDepths: codecs.av1Main10 ? [8, 10] : [8], hdr, ...res4k(codecs.av1_4k) });

  const audioCapabilities: AudioCapability[] = [];
  // maxChannels: 2 on AAC specifically — a browser has no API to learn how
  // many real speakers/channels the user's actual output device has.
  // Confirmed live: leaving this unset let a 5.1 source get transcoded to
  // 5.1 AAC with no downmix, and played over a real 2.0 setup with the
  // center channel (where dialogue usually lives) dropped instead of
  // folded into L/R. Stereo is the safe default assumption for a general
  // desktop web client; a platform with a real channel-count API (Android
  // TV/mobile, once their detectors exist) can declare a higher cap.
  if (codecs.aac) audioCapabilities.push({ codec: "aac", decode: true, maxChannels: 2 });
  // Deliberately codecs.ac3/eac3 ONLY here, never OR'd with mseAc3/mseEac3.
  // This engine's client delivers the stream via native <video> src
  // (progressive fMP4 pipe, no MediaSource) — see FfmpegRemuxEngine.ts's own
  // header comment. mseAc3/mseEac3 answer "can hls.js/MSE play this",
  // a completely different consumption path; treating it as proof native
  // playback works reproduces the exact bug remuxSession.ts's
  // COPY_SAFE_AUDIO whitelist was written to avoid (see its own comment:
  // "ici le flux est lu par le décodeur NATIF... copier l'AC-3 produirait
  // un flux muet"). The OLD ffmpeg-remux leg has a live silent-audio
  // watcher as a safety net for a wrong "yes" here; this engine has no such
  // live monitoring, so the declared capability itself has to be the
  // trustworthy signal instead of leaning on a probe answering a different
  // question.
  if (codecs.ac3) audioCapabilities.push({ codec: "ac3", decode: true });
  if (codecs.eac3) audioCapabilities.push({ codec: "eac3", decode: true });
  if (codecs.opus) audioCapabilities.push({ codec: "opus", decode: true });
  if (codecs.flac) audioCapabilities.push({ codec: "flac", decode: true });
  if (codecs.mp3 || codecs.mseMp3) audioCapabilities.push({ codec: "mp3", decode: true });

  // Structural facts about this app's bundled subtitle handling, not a
  // browser probe — matches how the existing player actually treats each
  // format today (see TitleContent.tsx / VideoPlayer.tsx subtitle handling).
  const subtitleCapabilities: SubtitleCapability[] = [
    // ffprobe's own codec_name for SRT is "subrip", never "srt" — confirmed
    // live against real files during Phase 2 testing. Keying this list on
    // ffprobe's vocabulary matters: decidePlayback (Phase 4) matches a
    // MediaDescriptor subtitle track's codec against this list verbatim, so
    // a wrong key here silently falls through to BURN for every SRT track.
    { codec: "subrip", externalSupported: true, convertible: true },
    { codec: "webvtt", nativeRender: true },
    { codec: "ass", convertible: true },
    { codec: "ssa", convertible: true },
    { codec: "hdmv_pgs_subtitle", convertible: false },
    { codec: "dvd_subtitle", convertible: false },
  ];

  return {
    clientType: "desktop-web",
    deviceId,
    appVersion,
    protocols: {
      progressive: true,
      // hls.js / dash.js are bundled dependencies (package.json) — always
      // available regardless of native browser support, unlike mse below
      // which is a genuine per-browser API check.
      hls: true,
      dash: true,
      mse: browserCaps.mseAvailable,
    },
    containers: ["mp4"],
    videoCapabilities,
    audioCapabilities,
    subtitleCapabilities,
  };
}
