import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { getUserById } from "@/lib/auth/store";
import { getPlaybackProgress, listActiveHeartbeatSessions } from "@/lib/playback/progressStore";
import { listSessions as listEngineSessions } from "@/lib/playback/engine/sessionManager";
import type { PlaybackSession as EnginePlaybackSession } from "@/lib/playback/engine/sessionManager";
import { getMovie, getSeries } from "@/lib/metadata/tmdb";
import type { MovvizSession } from "@/lib/playback/useMovvizActivity";

export const dynamic = "force-dynamic";

// Response shape ("MovvizSession") is owned by the hook that consumes it —
// src/lib/playback/useMovvizActivity.ts — same split as Plex's
// PlexSession/usePlexActivity.ts. See that file for the field-by-field
// rationale, including why `location` stays null here.

/**
 * The `device` field is a raw code, not display text — unlike Plex's
 * `device` (the actual player name Plex reports, real data with nothing to
 * translate), there's no friendly per-device name here (see task brief: no
 * device-name registry exists, clientType is the best available signal).
 * This route has no request locale to resolve against, so ActivityMonitor.tsx
 * maps this code to a translated label via the movvizActivity.device* i18n
 * keys — "unknown" covers the degraded case (heartbeat session with no
 * matching sessionManager entry, e.g. an older/ffmpeg-legacy playback path).
 */
function deviceCode(clientType: EnginePlaybackSession["clientType"] | null): string {
  return clientType ?? "unknown";
}

/** DIRECT_PLAY/REMUX/DIRECT_STREAM/TRANSCODE/UNSUPPORTED -> the same 3-way
 *  decision label the Plex panel already uses (see transcodePill in
 *  ActivityMonitor.tsx).
 *
 *  Bug fix (confirmed live: a session doing an audio-only transcode showed
 *  "Flux direct" in this panel while the player's own overlay correctly said
 *  "Audio transcodé"): REMUX is genuinely "container repackaged, no track
 *  re-encoded" (videoAction/audioAction both COPY, see decidePlayback.ts
 *  ~line 481) — that's Plex's real "copy"/"Flux direct" case. DIRECT_STREAM
 *  is NOT the same thing despite the name: decidePlayback.ts's DIRECT_STREAM
 *  branch (~line 454) is reached exactly when `needsAudioTranscode` is true
 *  and always sets `audioAction: "TRANSCODE"` — the audio track genuinely
 *  gets re-encoded, video is copied. That's real transcoding work, not a
 *  clean pass-through, so it now maps to "transcode" like TRANSCODE itself.
 *  UNSUPPORTED has no real playback happening but still holds a session
 *  record briefly during fallback cascades (§43) — closest is "transcode"
 *  (something is being worked on, not a clean pass-through) rather than
 *  inventing a 4th UI state. */
function toTranscodeDecision(mode: EnginePlaybackSession["mode"] | null): "transcode" | "copy" | "directplay" {
  switch (mode) {
    case "DIRECT_PLAY":
      return "directplay";
    case "REMUX":
      return "copy";
    case "DIRECT_STREAM":
    case "TRANSCODE":
    case "UNSUPPORTED":
      return "transcode";
    default:
      // No sessionManager match at all (heartbeat-only, degraded case) —
      // assume the least alarming state rather than flagging a transcode
      // that may not be happening.
      return "directplay";
  }
}

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const heartbeats = listActiveHeartbeatSessions();
  const engineSessions = listEngineSessions();

  const sessions: MovvizSession[] = await Promise.all(
    heartbeats.map(async (hb) => {
      const progress = getPlaybackProgress(hb.userId, hb.ratingKey, hb.mediaId);
      const user = getUserById(hb.userId);
      // Join by userId + the same movvizId-style identifier both stores are
      // populated with (movvizId ?? playbackId in VideoPlayer.tsx) — see the
      // task brief this route was built from for the full trace of that
      // matching contract across the two independent live stores.
      const hbMediaKey = hb.mediaId ?? hb.ratingKey;
      const engine = engineSessions.find((e) => e.userId === hb.userId && e.mediaId === hbMediaKey) ?? null;

      const durationMs = hb.durationMs || 0;
      const progressPct = durationMs > 0 ? Math.min(100, Math.round((hb.lastPositionMs / durationMs) * 100)) : 0;

      let thumb: string | null = null;
      if (progress?.tmdbId != null) {
        try {
          if (progress.mediaType === "episode") {
            const series = await getSeries(progress.tmdbId);
            thumb = series?.posterPath ? `/tmdb/w185${series.posterPath}` : null;
          } else {
            const movie = await getMovie(progress.tmdbId);
            thumb = movie?.posterPath ? `/tmdb/w185${movie.posterPath}` : null;
          }
        } catch {
          thumb = null;
        }
      }

      // Only an actually re-encoded track carries a real output codec on the
      // plan — direct play/remux don't record the source codec anywhere on
      // PlaybackSession/PlaybackPlan, so that pill is omitted rather than
      // faked (see task brief: "ship the honest subset"). videoAction and
      // audioAction are independent (see toTranscodeDecision's comment above
      // — DIRECT_STREAM re-encodes audio only, TRANSCODE re-encodes both),
      // so each pill is gated on its OWN action, not on the overall mode.
      const plan = engine?.plan ?? null;
      const videoCodec = plan?.videoAction === "TRANSCODE" ? plan.targetVideoCodec ?? plan.videoEncoderImpl ?? null : null;
      const audioCodec = plan?.audioAction === "TRANSCODE" ? plan.targetAudioCodec ?? null : null;

      return {
        origin: "movviz",
        title: progress?.title || "Inconnu",
        type: hb.mediaType,
        user: user?.username || "Inconnu",
        userThumb: null,
        state: hb.lastIsPlaying ? "playing" : "paused",
        progress: progressPct,
        duration: durationMs,
        bitrate: 0,
        bandwidth: 0,
        device: deviceCode(engine?.clientType ?? null),
        videoCodec,
        audioCodec,
        resolution: null,
        thumb,
        transcodeDecision: toTranscodeDecision(engine?.mode ?? null),
        location: null,
      } satisfies MovvizSession;
    })
  );

  return NextResponse.json({ sessions });
}
