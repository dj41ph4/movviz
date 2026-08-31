import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { stat, readFile } from "node:fs/promises";
import { requireUser } from "@/lib/auth/guard";
import { getSession } from "@/lib/playback/engine/sessionManager";
import { getOrProbeMediaDescriptor, getOrProbeRemoteMediaDescriptor } from "@/lib/playback/engine/mediaProbeCache";
import { resolveFfmpegBinary } from "@/lib/playback/engine/mediaRuntime";
import { findLiveSubtitleVtt } from "@/lib/playback/engine/transcoderExecutor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ sessionId: string }> };

/**
 * Unified-source counterpart of /api/playback-ffmpeg/[ratingKey]/subtitle —
 * same fast-path-tail-the-live-sidecar-else-dedicated-extraction shape, see
 * that file's own extensive comments for the full rationale. `subtitleIndex`
 * here is always the ABSOLUTE ffprobe stream index (MediaDescriptor's own
 * vocabulary), never the type-relative one — matches transcoderExecutor.ts's
 * -map convention throughout.
 */
export async function GET(req: NextRequest, context: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { sessionId } = await context.params;

  const session = getSession(sessionId);
  if (!session || session.userId !== user.id) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const media = session.source.type === "local"
    ? await getOrProbeMediaDescriptor(session.mediaId, session.source.localPath)
    : await getOrProbeRemoteMediaDescriptor(session.mediaId, session.source.uri, session.source.headers);
  if (!media) return NextResponse.json({ error: "source_unavailable" }, { status: 404 });

  const sp = req.nextUrl.searchParams;
  const requestedIndex = Number(sp.get("subtitleIndex"));
  const subtitleIndex = Number.isInteger(requestedIndex) ? requestedIndex : session.selectedSubtitle;
  if (subtitleIndex === null || subtitleIndex === undefined) {
    return NextResponse.json({ error: "subtitle_not_specified" }, { status: 400 });
  }
  const track = media.subtitleTracks.find((t) => t.index === subtitleIndex);
  if (!track) return NextResponse.json({ error: "subtitle_not_found" }, { status: 404 });
  if (track.type !== "text") return NextResponse.json({ error: "subtitle_not_text" }, { status: 422 });

  const liveVtt = findLiveSubtitleVtt(session.mediaId, user.id, subtitleIndex);
  if (liveVtt) {
    console.log(`[transcoder] ${sessionId} sous-titre index=${subtitleIndex} FAST PATH fichier=${liveVtt}`);
    return streamLiveVttFile(req, session.mediaId, user.id, subtitleIndex, liveVtt);
  }
  console.log(`[transcoder] ${sessionId} sous-titre index=${subtitleIndex} pas de session live — extraction dédiée`);

  const args = ["-v", "error"];
  if (session.source.type === "plex_raw") {
    const rawHeaders = Object.entries(session.source.headers).map(([k, v]) => `${k}: ${v}\r\n`).join("");
    if (rawHeaders) args.push("-headers", rawHeaders);
  }
  args.push("-i", session.source.uri, "-map", `0:${subtitleIndex}`, "-f", "webvtt", "pipe:1");
  const proc = spawn(resolveFfmpegBinary(), args, { stdio: ["ignore", "pipe", "pipe"] });

  proc.stderr?.on("data", (d: Buffer) => console.error(`[transcoder] ${sessionId} sous-titre stderr: ${String(d).trim()}`));

  const stream = Readable.toWeb(proc.stdout) as ReadableStream<Uint8Array>;
  proc.on("exit", (code) => {
    if (code !== 0 && code !== null && proc.stdout && !proc.stdout.readableEnded && !proc.stdout.destroyed) {
      proc.stdout.destroy(new Error(`ffmpeg exited with code ${code}`));
    }
  });
  const onAbort = () => { try { proc.kill(); } catch { /* déjà mort */ } };
  req.signal.addEventListener("abort", onAbort);
  proc.once("exit", () => req.signal.removeEventListener("abort", onAbort));

  return new Response(stream, { headers: { "content-type": "text/vtt; charset=utf-8", "cache-control": "no-store" } });
}

/** Identical polling contract to the Plex-backed route's streamLiveVttFile — see its comment for the full state-machine rationale. */
function streamLiveVttFile(req: NextRequest, mediaId: string, userId: string, subtitleIndex: number, initialVttPath: string): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let vttPath = initialVttPath;
      let pos = 0;
      let missCount = 0;
      let stopped = false;
      let timer: NodeJS.Timeout;

      const tick = async () => {
        if (stopped) return;
        try {
          const st = await stat(vttPath);
          if (st.size > pos) {
            const buf = await readFile(vttPath);
            controller.enqueue(buf.subarray(pos));
            pos = st.size;
          }
          missCount = 0;
        } catch {
          const next = findLiveSubtitleVtt(mediaId, userId, subtitleIndex);
          if (next && next !== vttPath) {
            vttPath = next;
            pos = 0;
            missCount = 0;
          } else {
            missCount += 1;
            if (missCount > 60) {
              stopped = true;
              controller.close();
              return;
            }
          }
        }
        timer = setTimeout(tick, 500);
      };
      timer = setTimeout(tick, 300);

      const stop = () => {
        stopped = true;
        clearTimeout(timer);
      };
      req.signal.addEventListener("abort", stop);
    },
    cancel() {
      /* le client est parti — les timers meurent au prochain tick (stopped) */
    },
  });

  return new Response(stream, { headers: { "content-type": "text/vtt; charset=utf-8", "cache-control": "no-store" } });
}
