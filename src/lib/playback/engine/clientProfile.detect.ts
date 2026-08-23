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
 * Known gap, deliberate: HDR support (VideoCapability.hdr) is left
 * undefined below rather than guessed — webcodecs.ts doesn't probe it
 * independently of SDR decode today. Fill this in once a real HDR probe
 * exists rather than assuming "codec decodes ⇒ HDR decodes".
 */

import { detectCodecs } from "@/lib/player/webcodecs";
import { detectCapabilities } from "../capabilities";
import type { AudioCapability, ClientPlaybackProfile, SubtitleCapability, VideoCapability } from "./clientProfile";

export async function detectDesktopClientProfile(deviceId: string, appVersion: string): Promise<ClientPlaybackProfile> {
  const [codecs, browserCaps] = await Promise.all([detectCodecs(), detectCapabilities()]);

  const videoCapabilities: VideoCapability[] = [];
  if (codecs.h264) videoCapabilities.push({ codec: "h264" });
  if (codecs.hevc) videoCapabilities.push({ codec: "hevc" });
  if (codecs.av1) videoCapabilities.push({ codec: "av1" });

  const audioCapabilities: AudioCapability[] = [];
  if (codecs.aac) audioCapabilities.push({ codec: "aac", decode: true });
  if (codecs.ac3 || codecs.mseAc3) audioCapabilities.push({ codec: "ac3", decode: true });
  if (codecs.eac3 || codecs.mseEac3) audioCapabilities.push({ codec: "eac3", decode: true });
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
