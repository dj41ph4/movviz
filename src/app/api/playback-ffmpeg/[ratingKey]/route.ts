import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { resolvePlexPartUrl } from "@/lib/playback/plexSource";
import {
  DuplicateSessionError,
  MAX_CONCURRENT,
  activeSessionCount,
  isFfmpegAvailable,
  startRemux,
  stopAllForRatingKey,
  stopRemux,
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

  // Garde de capacité AVANT de tenter startRemux : évite de tenter un spawn
  // qu'on sait perdant. startRemux() re-vérifie de toute façon en interne
  // (source de vérité) — cette vérification ici n'est qu'un fast-path pour
  // le cas capacité pleine ET clé non déjà active (le cas "déjà active" est
  // toujours autorisé à passer, c'est startRemux qui distingue via
  // DuplicateSessionError).
  if (activeSessionCount() >= MAX_CONCURRENT) {
    console.error(`[remux] 429 capacité atteinte pour ${ratingKey}`);
    return NextResponse.json({ error: "too_many_remux_sessions" }, { status: 429 });
  }

  let result: { proc: import("node:child_process").ChildProcess; stream: ReadableStream<Uint8Array>; key: string } | null;
  try {
    result = startRemux(ratingKey, user.id, ref, { audioIndex, seekToSec });
  } catch (e) {
    if (e instanceof DuplicateSessionError) {
      // Une session avec la même clé (ratingKey:userId:audioIndex:seekSec)
      // tourne déjà — un ReadableStream ne se partage pas entre deux
      // consommateurs HTTP, donc on refuse plutôt que de brancher un second
      // lecteur sur le même stdout. C'est une requête dupliquée (double
      // montage du <video>, retry réseau...), pas une vraie erreur serveur.
      console.error(`[remux] 409 session déjà active: ${e.key}`);
      return NextResponse.json({ error: "session_already_active" }, { status: 409 });
    }
    console.error(`[remux] erreur démarrage ${ratingKey}`, e);
    return NextResponse.json({ error: "remux_start_failed" }, { status: 502 });
  }

  if (!result) {
    return NextResponse.json({ error: "too_many_remux_sessions" }, { status: 429 });
  }

  const { proc, stream, key } = result;

  let stopped = false;
  const onAbort = () => {
    if (stopped) return;
    stopped = true;
    console.log(`[remux] abort client — stop ${key}`);
    stopRemux(key);
  };
  req.signal.addEventListener("abort", onAbort);

  proc.once("exit", () => {
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
