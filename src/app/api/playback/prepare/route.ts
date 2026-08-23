import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getMovie } from "@/lib/library/store";
import { getPrimaryFile } from "@/lib/library/versions";
import { getOrProbeMediaDescriptor } from "@/lib/playback/engine/mediaProbeCache";
import { detectServerCapabilities } from "@/lib/playback/engine/serverCapabilities.detect";
import { decidePlayback } from "@/lib/playback/engine/decidePlayback";
import { createSession } from "@/lib/playback/engine/sessionManager";
import type { ClientPlaybackProfile } from "@/lib/playback/engine/clientProfile";

export const dynamic = "force-dynamic";

/**
 * Phase 8 of the playback engine rewrite (see PLAN_REFONTE_MOTEUR_LECTURE_MOVVIZ.md
 * §32-33): the client/server contract for the NEW engine. Nothing calls this
 * yet — the live player still goes through the existing
 * /api/playback/sessions + /api/playback-ffmpeg routes untouched. This is
 * the endpoint a future migrated player would call first.
 *
 * Answers, in code, the three questions raised before Phase 3 started:
 * a movie with no MediaDescriptor cached yet gets probed right here
 * on-demand (getOrProbeMediaDescriptor already does this transparently —
 * "never probe at every playback" only means "don't re-probe an unchanged
 * file", not "never probe on a cache miss"); the session this creates is
 * exactly what a future "Lecture/Transcodage" Settings button would report
 * on/manage; and this is the one and only place a MediaDescriptor and a
 * PlaybackPlan get produced for a real playback request, so there is no
 * second code path to keep in sync.
 */
export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const mediaId = typeof b.mediaId === "string" ? b.mediaId.trim() : "";
  const clientProfile = b.clientProfile as ClientPlaybackProfile | undefined;
  if (!mediaId || !clientProfile || typeof clientProfile !== "object") {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  if (
    !clientProfile.clientType ||
    !clientProfile.deviceId ||
    !Array.isArray(clientProfile.videoCapabilities) ||
    !Array.isArray(clientProfile.audioCapabilities) ||
    !Array.isArray(clientProfile.subtitleCapabilities) ||
    !Array.isArray(clientProfile.containers)
  ) {
    return NextResponse.json({ error: "invalid_client_profile" }, { status: 400 });
  }

  // Series/episode playback needs its own mediaId scheme once the player
  // actually migrates (Phase 9+) — deliberately movie-only for now so this
  // contract phase doesn't half-implement episode support nothing calls yet.
  const movie = getMovie(mediaId);
  if (!movie) return NextResponse.json({ error: "media_not_found" }, { status: 404 });
  const file = getPrimaryFile(movie);
  const filePath = file?.diskPath ?? file?.path;
  if (!filePath) return NextResponse.json({ error: "media_unavailable" }, { status: 404 });

  const media = await getOrProbeMediaDescriptor(mediaId, filePath);
  if (!media) return NextResponse.json({ error: "file_missing" }, { status: 404 });

  const server = await detectServerCapabilities();
  const audioTrack = Number.isInteger(b.audioTrack) ? (b.audioTrack as number) : undefined;
  const subtitleTrackRaw = b.subtitleTrack;
  const subtitleTrack = subtitleTrackRaw === null ? null : Number.isInteger(subtitleTrackRaw) ? (subtitleTrackRaw as number) : undefined;
  const quality = typeof b.quality === "string" ? (b.quality as "original" | "auto" | "4k" | "1440p" | "1080p" | "720p") : undefined;

  const plan = decidePlayback({ media, client: clientProfile, server, selectedAudio: audioTrack, selectedSubtitle: subtitleTrack, quality });

  const session = createSession({
    userId: user.id,
    deviceId: clientProfile.deviceId,
    clientType: clientProfile.clientType,
    mediaId,
    mode: plan.mode,
    selectedAudio: audioTrack ?? null,
    selectedSubtitle: subtitleTrack ?? null,
    videoAction: plan.videoAction,
    audioAction: plan.audioAction,
    subtitleAction: plan.subtitleAction,
    plan,
  });

  // DIRECT_PLAY needs no ffmpeg process at all — point straight at the
  // existing, already-working byte-range route (Range support, 206 partial
  // content) instead of routing through a session-backed stream endpoint
  // that would spawn a process for zero reason. Every other mode (REMUX/
  // DIRECT_STREAM/TRANSCODE) needs the real ffmpeg session, executed by
  // localExecutor.ts (Phases 9-13) via the session-stream route below.
  const streamUrl =
    plan.mode === "DIRECT_PLAY"
      ? `/api/stream/local/${encodeURIComponent(mediaId)}`
      : `/api/playback/session/${session.sessionId}/stream`;

  return NextResponse.json({
    sessionId: session.sessionId,
    media,
    plan,
    tracks: { audio: media.audioTracks, subtitle: media.subtitleTracks },
    // §33 — markers/resume come from the existing progress/marker stores in
    // the CURRENT system (progressStore.ts, decisionLog-adjacent marker
    // sync); wiring those in is migration work (Phase 9+), not part of this
    // contract phase, so they're left empty rather than half-duplicated here.
    markers: {},
    resume: {},
    stream: {
      url: streamUrl,
      protocol: (plan.protocol ?? "PROGRESSIVE").toLowerCase(),
    },
  });
}
