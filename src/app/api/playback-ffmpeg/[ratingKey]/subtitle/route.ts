import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { stat, readFile } from "node:fs/promises";
import { requireUser } from "@/lib/auth/guard";
import { resolvePlexPartUrl } from "@/lib/playback/plexSource";
import { isFfmpegAvailable, findRemuxSubtitleVtt } from "@/lib/playback/ffmpeg/remuxSession";

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
 * FAST PATH : si la piste demandée est celle que la session de remux active
 * pré-extrait en WebVTT (sortie secondaire du process — zéro lecture disque
 * supplémentaire), on tail-e simplement ce fichier : les cues arrivent dès
 * les premières secondes de lecture du film au lieu d'attendre la lecture
 * complète du fichier par une extraction séparée (~1 min sur NAS).
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

  // FAST PATH : la session de remux en cours écrit déjà cette piste en
  // WebVTT (sortie secondaire) — tail du fichier au lieu d'une nouvelle
  // lecture du fichier source. Si aucune session ne correspond, on retombe
  // sur l'extraction ffmpeg dédiée (plus lente, mais complète).
  const liveVtt = findRemuxSubtitleVtt(ratingKey, user.id, match.index);
  if (liveVtt) {
    return streamLiveVttFile(req, ratingKey, user.id, match.index, liveVtt);
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

/**
 * Streame le fichier WebVTT en cours d'écriture par le process de remux
 * (tail -f) : poll toutes les 500 ms, envoie les nouveaux octets au client.
 *
 * - Fichier existant mais qui ne grossit plus : c'est la pause/backpressure
 *   du remux (le client ne lit plus le pipe) — on attend, pas de timeout.
 * - Fichier disparu : la session de remux a été remplacée (seek, changement
 *   de qualité/audio → nouveau process, nouveau fichier) — on bascule sur le
 *   nouveau fichier live (les temps absolus sont les mêmes) sans interruption.
 * - Fichier absent pendant ~30 s sans nouvelle session : fin propre du
 *   stream (le client re-fetch au besoin).
 * - Client déconnecté (abort) : arrêt immédiat, aucun timer ne traîne.
 */
function streamLiveVttFile(
  req: NextRequest,
  ratingKey: string,
  userId: string,
  subtitleIndex: number,
  initialVttPath: string
): Response {
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
          // Fichier absent/supprimé — session de remux remplacée ou arrêtée :
          // bascule sur le fichier live suivant, sinon fin propre du stream.
          const next = findRemuxSubtitleVtt(ratingKey, userId, subtitleIndex);
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
      // Le client est parti — les timers meurent au prochain tick (stopped).
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/vtt; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
