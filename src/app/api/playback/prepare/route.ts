import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { resolveLocalFilePath } from "@/lib/playback/sourceResolver";
import { getOrProbeMediaDescriptor, getOrProbeRemoteMediaDescriptor } from "@/lib/playback/engine/mediaProbeCache";
import { resolvePlexPartUrl } from "@/lib/playback/plexSource";
import { detectServerCapabilities } from "@/lib/playback/engine/serverCapabilities.detect";
import { decidePlayback } from "@/lib/playback/engine/decidePlayback";
import { createSession } from "@/lib/playback/engine/sessionManager";
import { benchmarkRealtimeFactor } from "@/lib/playback/engine/serverBenchmark";
import type { ClientPlaybackProfile } from "@/lib/playback/engine/clientProfile";

export const dynamic = "force-dynamic";

/**
 * The client/server contract for the decidePlayback()-driven engine — the
 * one and only place a MediaDescriptor and a PlaybackPlan get produced for a
 * real playback request. Called live from VideoPlayer.tsx's
 * tryStartUnifiedEngine() for both movies and (now) episodes, whenever the
 * playback engine setting is "auto"/"stable"/"beta" and the title is a real
 * local file or original Plex raw part. A file with no
 * MediaDescriptor cached yet gets probed right here on-demand
 * (getOrProbeMediaDescriptor already does this transparently — "never probe
 * at every playback" only means "don't re-probe an unchanged file", not
 * "never probe on a cache miss").
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
  const ratingKey = typeof b.ratingKey === "string" ? b.ratingKey.trim() : "";
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

  // Source resolution happens ONCE, before planning. Local bytes are always
  // preferred. If the file is not locally resolvable and a real Plex
  // ratingKey exists, Plex contributes only its original /library/parts URL.
  // No /transcode endpoint is used anywhere in this engine.
  const resolution = resolveLocalFilePath(mediaId);
  let media;
  let source;
  let directUrl: string;
  if (resolution.ok) {
    media = await getOrProbeMediaDescriptor(mediaId, resolution.path);
    if (!media) return NextResponse.json({ error: "file_missing" }, { status: 404 });
    source = { type: "local" as const, uri: resolution.path, localPath: resolution.path, sourceKey: "local" };
    const episodeMatch = /^(.+):s(\d+)e(\d+)$/.exec(mediaId);
    directUrl = episodeMatch
      ? `/api/stream/local/episode/${encodeURIComponent(episodeMatch[1])}/${episodeMatch[2]}/${episodeMatch[3]}`
      : `/api/stream/local/${encodeURIComponent(mediaId)}`;
  } else if (ratingKey) {
    const part = await resolvePlexPartUrl(ratingKey, user.id);
    if (!part) return NextResponse.json({ error: "plex_raw_source_unavailable" }, { status: 404 });
    media = await getOrProbeRemoteMediaDescriptor(mediaId, part.sourceUrl, part.headers);
    if (!media) return NextResponse.json({ error: "plex_raw_probe_failed" }, { status: 502 });
    source = {
      type: "plex_raw" as const,
      uri: part.sourceUrl,
      headers: part.headers,
      ratingKey,
      sourceKey: `plex:${ratingKey}`,
    };
    directUrl = `/api/stream/${encodeURIComponent(ratingKey)}`;
  } else {
    return NextResponse.json(
      { error: resolution.code === "not_found" ? "media_not_found" : "media_unavailable" },
      { status: 404 }
    );
  }

  const server = await detectServerCapabilities();
  const audioTrack = Number.isInteger(b.audioTrack) ? (b.audioTrack as number) : undefined;
  const subtitleTrackRaw = b.subtitleTrack;
  const subtitleTrack = subtitleTrackRaw === null ? null : Number.isInteger(subtitleTrackRaw) ? (subtitleTrackRaw as number) : undefined;
  const quality = typeof b.quality === "string" ? (b.quality as "original" | "auto" | "4k" | "1440p" | "1080p" | "720p") : undefined;

  const plan = decidePlayback({
    media, client: clientProfile, server, selectedAudio: audioTrack, selectedSubtitle: subtitleTrack, quality,
    performance: {
      toneMapRealtimeFactor: benchmarkRealtimeFactor("software_720p_tonemap"),
      software1080pRealtimeFactor: benchmarkRealtimeFactor("software_1080p"),
    },
  });

  const session = createSession({
    userId: user.id,
    deviceId: clientProfile.deviceId,
    clientType: clientProfile.clientType,
    mediaId,
    source,
    mode: plan.mode,
    selectedAudio: audioTrack ?? null,
    selectedSubtitle: subtitleTrack ?? null,
    videoAction: plan.videoAction,
    audioAction: plan.audioAction,
    subtitleAction: plan.subtitleAction,
    plan,
  });

  // DIRECT_PLAY uses the raw-byte route for the already-selected source.
  // REMUX / DIRECT_STREAM / TRANSCODE all use the same Movviz executor.
  const streamUrl = plan.mode === "DIRECT_PLAY"
    ? directUrl
    : `/api/playback/session/${session.sessionId}/stream`;

  return NextResponse.json({
    sessionId: session.sessionId,
    media,
    plan,
    tracks: { audio: media.audioTracks, subtitle: media.subtitleTracks },
    source: { type: source.type },
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
