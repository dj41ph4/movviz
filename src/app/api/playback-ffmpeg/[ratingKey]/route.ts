import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { resolvePlexPartUrl } from "@/lib/playback/plexSource";
import {
  FFMPEG_QUALITY_PRESETS,
  isFfmpegAvailable,
  isFfmpegQuality,
  markStreamAborted,
  startRemux,
  stopAllForRatingKey,
  stopRemux,
  touchSession as touchRemuxSession,
  type FfmpegQuality,
} from "@/lib/playback/ffmpeg/remuxSession";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ ratingKey: string }> };

function resolveAudioIndex(
  audioStreams: Array<{ index: number; id: number | null; codec: string | null; selected: boolean }>,
  audioStreamID: string | null
): number {
  if (audioStreamID) {
    const match = audioStreams.find((s) => String(s.id) === audioStreamID);
    if (match) return match.index;
  }
  const selected = audioStreams.find((s) => s.selected);
  if (selected) return selected.index;
  return 0;
}

export async function GET(req: NextRequest, context: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { ratingKey } = await context.params;

  const available = await isFfmpegAvailable();
  if (!available) {
    console.error(`[remux] ffmpeg absent — repli transcode pour ${ratingKey}`);
    return NextResponse.json({ error: "ffmpeg_unavailable" }, { status: 502 });
  }

  const ref = await resolvePlexPartUrl(ratingKey, user.id);
  if (!ref) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const sp = req.nextUrl.searchParams;
  const audioStreamID = sp.get("audioStreamID");
  const seekToRaw = Number(sp.get("seekTo"));
  const seekToSec = Number.isFinite(seekToRaw) && seekToRaw > 0 ? seekToRaw : 0;
  const audioIndex = resolveAudioIndex(ref.audioStreams, audioStreamID);
  const qualityRaw = sp.get("quality");
  const quality: FfmpegQuality = qualityRaw && isFfmpegQuality(qualityRaw) ? qualityRaw : "original";
  if (!(quality in FFMPEG_QUALITY_PRESETS)) {
    return NextResponse.json({ error: "invalid_quality" }, { status: 400 });
  }

  // The shared ceiling (sharedTranscodeLimit.ts) is enforced by startRemux
  // itself, AFTER it has replaced this viewer's own previous request for the
  // same stream — checking it here first counted that abandoned request and
  // refused its replacement with 429.
  let result: { proc: import("node:child_process").ChildProcess; stream: ReadableStream<Uint8Array>; key: string } | null;
  try {
    result = startRemux(ratingKey, user.id, ref, { audioIndex, seekToSec, quality });
  } catch (e) {
    console.error(`[remux] erreur démarrage ${ratingKey}`, e);
    return NextResponse.json({ error: "remux_start_failed" }, { status: 502 });
  }

  if (!result) {
    return NextResponse.json({ error: "too_many_remux_sessions" }, { status: 429 });
  }

  const { proc, stream, key } = result;

  // Same 5-minute TTL issue as the unified executor: this route returns one
  // long-lived HTTP response, so the registry otherwise sees no subsequent
  // access after startRemux() and kills a healthy stream around minute 5-6.
  // Keep the remux registry alive while this client connection is alive;
  // abort/ffmpeg exit stop the heartbeat and leave stale-session cleanup intact.
  touchRemuxSession(key);
  const activityTimer = setInterval(() => touchRemuxSession(key), 60_000);
  if (typeof activityTimer.unref === "function") activityTimer.unref();

  let stopped = false;
  const onAbort = () => {
    if (stopped) return;
    stopped = true;
    clearInterval(activityTimer);
    console.log(`[remux] abort client — stop ${key}`);
    markStreamAborted(key, stream);
    stopRemux(key, proc);
  };
  req.signal.addEventListener("abort", onAbort);

  proc.once("exit", () => {
    clearInterval(activityTimer);
    req.signal.removeEventListener("abort", onAbort);
  });

  return new Response(stream, {
    headers: {
      "content-type": "video/mp4",
      "cache-control": "no-store",
      "accept-ranges": "bytes",
    },
  });
}

export async function DELETE(req: NextRequest, context: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { ratingKey } = await context.params;

  // DELETE arrête TOUTES les sessions ratingKey:userId, quels que soient
  // audioIndex/seekSec — un lecteur qui ferme peut avoir seeké/changé de
  // piste entre-temps et ne plus connaître la clé exacte de sa dernière
  // session ; ratisser large ici est le comportement voulu (cf. plan S2).
  stopAllForRatingKey(ratingKey, user.id);
  return new NextResponse(null, { status: 204 });
}
