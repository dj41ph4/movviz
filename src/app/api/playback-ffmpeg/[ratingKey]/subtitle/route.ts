import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { requireUser } from "@/lib/auth/guard";
import { resolvePlexPartUrl } from "@/lib/playback/plexSource";
import { isFfmpegAvailable } from "@/lib/playback/ffmpeg/remuxSession";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ ratingKey: string }> };

/**
 * Extraction d'une piste de sous-titres TEXTE en WebVTT via ffmpeg —
 * sans aucun transcode Plex : Movviz lit le fichier brut et convertit
 * lui-même (srt/ass/ssa/webvtt/mov_text → WebVTT).
 *
 * Le VTT est STREAMÉ au fil de la lecture du fichier par ffmpeg (les cues
 * arrivent dans l'ordre chronologique) — le client parse au fur et à mesure
 * et n'attend JAMAIS la fin de l'extraction complète du film. Temps absolus
 * du fichier ; la leg ffmpeg applique le décalage `seekBase` côté client.
 *
 * Pistes IMAGE (pgs/vobsub) : non convertibles en texte → 422 ; le lecteur
 * bascule alors sur le repli HLS habituel.
 */
export async function GET(req: NextRequest, context: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { ratingKey } = await context.params;

  const available = await isFfmpegAvailable();
  if (!available) {
    return NextResponse.json({ error: "ffmpeg_unavailable" }, { status: 502 });
  }

  const ref = await resolvePlexPartUrl(ratingKey, user.id);
  if (!ref) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const sp = req.nextUrl.searchParams;
  const subtitleStreamID = sp.get("subtitleStreamID");
  const match = ref.subtitleStreams.find(
    (s) => subtitleStreamID ? String(s.id) === subtitleStreamID : s.selected
  );
  if (!match) {
    return NextResponse.json({ error: "subtitle_not_found" }, { status: 404 });
  }
  if (!match.toTextConvertible) {
    return NextResponse.json({ error: "subtitle_not_text" }, { status: 422 });
  }

  const tokenHeader = Object.entries(ref.headers).find(
    ([k]) => k.toLowerCase() === "x-plex-token"
  )?.[1];
  if (!tokenHeader) {
    return NextResponse.json({ error: "plex_token_missing" }, { status: 500 });
  }

  const args = [
    "-v", "error",
    "-headers", `X-Plex-Token: ${tokenHeader}\r\n`,
    "-i", ref.sourceUrl,
    "-map", `0:s:${match.index}`,
    "-f", "webvtt",
    "pipe:1",
  ];

  const proc = spawn(process.env.MOVVIZ_FFMPEG_PATH?.trim() || "ffmpeg", args, {
    stdio: ["ignore", "pipe", "pipe"],
  });

  proc.stderr?.on("data", (d: Buffer) => {
    console.error(`[subtitle] ${ratingKey} piste=${match.id} stderr: ${String(d).trim()}`);
  });

  const stream = Readable.toWeb(proc.stdout) as ReadableStream<Uint8Array>;

  // Sur exit anormal AVANT la fin naturelle du flux (EOF), on force une
  // erreur sur le stdout plutôt que de laisser un EOF silencieux passer
  // pour une fin de flux valide (même règle que la session remux).
  proc.on("exit", (code) => {
    if (code !== 0 && code !== null && proc.stdout && !proc.stdout.readableEnded && !proc.stdout.destroyed) {
      proc.stdout.destroy(new Error(`ffmpeg exited with code ${code}`));
    }
  });

  // Client déconnecté → tue ffmpeg (pas d'extraction orpheline qui lit
  // tout le fichier pour rien).
  const onAbort = () => {
    try { proc.kill(); } catch { /* déjà mort */ }
  };
  req.signal.addEventListener("abort", onAbort);
  proc.once("exit", () => {
    req.signal.removeEventListener("abort", onAbort);
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/vtt; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
