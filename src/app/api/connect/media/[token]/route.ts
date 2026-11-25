import fs from "node:fs";
import { spawn } from "node:child_process";
import { Readable } from "node:stream";
import { NextRequest, NextResponse } from "next/server";
import { contentTypeFor, getCastMedia, remuxArgs } from "@/lib/connect/castMedia";
import { resolveFfmpegBinary } from "@/lib/playback/engine/mediaRuntime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ token: string }> };

function rangeBounds(raw: string | null, size: number): { start: number; end: number } | null {
  if (!raw) return { start: 0, end: size - 1 };
  const match = /^bytes=(\d*)-(\d*)$/i.exec(raw.trim());
  if (!match) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

// Le récepteur Google Cast est une page web d'une autre origine : le jeton suffit, aucun cookie n'est lu.
const CORS = { "access-control-allow-origin": "*", "access-control-expose-headers": "content-length, content-range, accept-ranges" };

// Profil DLNA : lecture en continu, déplacement par plage d'octets autorisé.
const DLNA_FEATURES = "DLNA.ORG_OP=01;DLNA.ORG_CI=0;DLNA.ORG_FLAGS=01700000000000000000000000000000";

/**
 * Vidéo d'un écran réseau (Chromecast, téléviseur DLNA), accessible par jeton
 * seulement (voir castMedia.ts) : le fichier tel quel avec plages d'octets, ou
 * un remux MP4 fragmenté (« ?t= » secondes de départ) pour le Chromecast.
 */
async function serve(req: NextRequest, context: Ctx, head: boolean) {
  const { token } = await context.params;
  const media = getCastMedia(token);
  if (!media) return NextResponse.json({ error: "not_found" }, { status: 404 });
  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(media.path);
  } catch {
    return NextResponse.json({ error: "file_unavailable" }, { status: 404 });
  }

  if (media.mode === "direct") {
    const bounds = rangeBounds(req.headers.get("range"), stat.size);
    if (!bounds) return new NextResponse(null, { status: 416, headers: { "content-range": `bytes */${stat.size}` } });
    const partial = bounds.start !== 0 || bounds.end !== stat.size - 1;
    const headers: Record<string, string> = {
      "content-type": contentTypeFor(media.path),
      "accept-ranges": "bytes",
      "content-length": String(bounds.end - bounds.start + 1),
      "cache-control": "no-store",
      ...CORS,
      "transferMode.dlna.org": "Streaming",
      "contentFeatures.dlna.org": DLNA_FEATURES,
    };
    if (partial) headers["content-range"] = `bytes ${bounds.start}-${bounds.end}/${stat.size}`;
    if (head) return new NextResponse(null, { status: partial ? 206 : 200, headers });
    const stream = fs.createReadStream(media.path, { start: bounds.start, end: bounds.end, highWaterMark: 1024 * 1024 });
    req.signal.addEventListener("abort", () => stream.destroy());
    return new NextResponse(Readable.toWeb(stream) as ReadableStream, { status: partial ? 206 : 200, headers });
  }

  const headers = { "content-type": "video/mp4", "cache-control": "no-store", "accept-ranges": "none", ...CORS };
  if (head) return new NextResponse(null, { status: 200, headers });
  const startRaw = Number(req.nextUrl.searchParams.get("t") ?? "0");
  const start = Number.isFinite(startRaw) && startRaw > 0 ? Math.min(startRaw, 1_000_000) : 0;
  // Vidéo copiée, ou recodée en H.264 quand l'écran ne lit pas la source (voir castProfileFor).
  const args = remuxArgs(media.path, start, media);
  const ffmpeg = spawn(resolveFfmpegBinary(), args, { stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
  const stop = () => {
    if (ffmpeg.exitCode === null) ffmpeg.kill("SIGKILL");
  };
  req.signal.addEventListener("abort", stop);
  ffmpeg.on("error", stop);
  const body = Readable.toWeb(ffmpeg.stdout) as ReadableStream;
  return new NextResponse(body, { status: 200, headers });
}

export async function GET(req: NextRequest, context: Ctx) {
  return serve(req, context, false);
}

export async function HEAD(req: NextRequest, context: Ctx) {
  return serve(req, context, true);
}

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { ...CORS, "access-control-allow-methods": "GET, HEAD, OPTIONS", "access-control-allow-headers": "range", "access-control-max-age": "86400" } });
}
