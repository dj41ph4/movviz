import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getSession, setTranscoderPid, touchSession } from "@/lib/playback/engine/sessionManager";
import { getOrProbeMediaDescriptor, getOrProbeRemoteMediaDescriptor } from "@/lib/playback/engine/mediaProbeCache";
import {
  DuplicateTranscoderSessionError,
  RemoteSubtitleBurnUnsupportedError,
  detectSubtitleCharenc,
  markStreamAborted,
  startTranscoderSession,
  stopAllForMedia,
  stopTranscoderSession,
} from "@/lib/playback/engine/transcoderExecutor";
import { MAX_CONCURRENT_TRANSCODES, totalActiveTranscodeSessions } from "@/lib/playback/engine/sharedTranscodeLimit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ sessionId: string }> };

/**
 * The actual streaming endpoint a `/api/playback/prepare` response points a
 * REMUX/DIRECT_STREAM/TRANSCODE plan at (DIRECT_PLAY never reaches here —
 * prepare points it straight at the existing byte-range route instead, see
 * prepare/route.ts). Movies and episodes both flow through here identically
 * (see resolveLocalFilePath). Mirrors
 * /api/playback-ffmpeg/[ratingKey]/route.ts's exact shape (abort handling,
 * error codes) — the CURRENT production route for Plex-sourced streams —
 * but executes a local file through localExecutor.ts instead.
 */
export async function GET(req: NextRequest, context: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { sessionId } = await context.params;

  const session = getSession(sessionId);
  if (!session || session.userId !== user.id) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (session.mode === "DIRECT_PLAY") return NextResponse.json({ error: "wrong_route_for_direct_play" }, { status: 400 });

  const input = session.source.type === "local"
    ? { uri: session.source.uri, localPath: session.source.localPath, sourceKey: session.source.sourceKey }
    : { uri: session.source.uri, headers: session.source.headers, sourceKey: session.source.sourceKey };
  const media = session.source.type === "local"
    ? await getOrProbeMediaDescriptor(session.mediaId, session.source.localPath)
    : await getOrProbeRemoteMediaDescriptor(session.mediaId, session.source.uri, session.source.headers);
  if (!media) return NextResponse.json({ error: "source_unavailable" }, { status: 404 });

  const sp = req.nextUrl.searchParams;
  const seekToRaw = Number(sp.get("seekTo"));
  const seekToSec = Number.isFinite(seekToRaw) && seekToRaw > 0 ? seekToRaw : 0;

  // Shared ceiling with the Plex remux engine — see sharedTranscodeLimit.ts.
  if (totalActiveTranscodeSessions() >= MAX_CONCURRENT_TRANSCODES) {
    console.error(`[transcoder] 429 capacité atteinte pour ${sessionId}`);
    return NextResponse.json({ error: "too_many_sessions" }, { status: 429 });
  }

  // Non-UTF-8 SRT (Windows-1252/ISO-8859-1, common on older French releases)
  // otherwise crashes BURN outright and silently produces an empty sidecar
  // for EXTRACT/CONVERT — see detectSubtitleCharenc's own comment. Only
  // worth the extra real ffmpeg check when a subtitle is actually selected
  // and will be touched (BURN/EXTRACT/CONVERT — DIRECT and NONE never read
  // the stream's text at all).
  let subtitleCharenc: string | null = null;
  if (
    session.selectedSubtitle !== null &&
    (session.plan.subtitleAction === "BURN" || session.plan.subtitleAction === "EXTRACT" || session.plan.subtitleAction === "CONVERT")
  ) {
    subtitleCharenc = await detectSubtitleCharenc(input, session.selectedSubtitle);
  }

  let result: ReturnType<typeof startTranscoderSession>;
  try {
    result = startTranscoderSession(session.mediaId, user.id, input, media, session.plan, {
      audioIndex: session.selectedAudio ?? undefined,
      subtitleIndex: session.selectedSubtitle,
      seekToSec,
      subtitleCharenc,
    });
  } catch (e) {
    if (e instanceof RemoteSubtitleBurnUnsupportedError) {
      return NextResponse.json({ error: "remote_subtitle_burn_unsupported" }, { status: 422 });
    }
    if (e instanceof DuplicateTranscoderSessionError) {
      console.error(`[transcoder] 409 session déjà active: ${e.key}`);
      return NextResponse.json({ error: "session_already_active" }, { status: 409 });
    }
    console.error(`[transcoder] erreur démarrage ${sessionId}`, e);
    return NextResponse.json({ error: "start_failed" }, { status: 502 });
  }
  if (!result) return NextResponse.json({ error: "too_many_sessions" }, { status: 429 });

  const { proc, stream, key } = result;
  touchSession(sessionId, seekToSec * 1000);
  if (proc.pid) setTranscoderPid(sessionId, proc.pid);

  let stopped = false;
  const onAbort = () => {
    if (stopped) return;
    stopped = true;
    console.log(`[transcoder] abort client — stop ${key}`);
    markStreamAborted(key);
    stopTranscoderSession(key);
  };
  req.signal.addEventListener("abort", onAbort);
  proc.once("exit", () => req.signal.removeEventListener("abort", onAbort));

  return new Response(stream, {
    headers: { "content-type": "video/mp4", "cache-control": "no-store", "accept-ranges": "bytes" },
  });
}

export async function DELETE(req: NextRequest, context: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { sessionId } = await context.params;
  const session = getSession(sessionId);
  if (!session || session.userId !== user.id) return new NextResponse(null, { status: 204 });
  stopAllForMedia(session.mediaId, user.id);
  return new NextResponse(null, { status: 204 });
}
