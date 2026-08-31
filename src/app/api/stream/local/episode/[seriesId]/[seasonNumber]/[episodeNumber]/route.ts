import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { resolveEpisodePlayback } from "@/lib/playback/sourceResolver";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ seriesId: string; seasonNumber: string; episodeNumber: string }> };

function mime(file: string) {
  const ext = file.toLowerCase().split(".").pop();
  return ext === "mkv" ? "video/x-matroska" : ext === "webm" ? "video/webm" : "video/mp4";
}

export async function GET(req: NextRequest, context: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const p = await context.params;
  const season = Number(p.seasonNumber), episode = Number(p.episodeNumber);
  if (!Number.isInteger(season) || !Number.isInteger(episode)) return NextResponse.json({ error: "invalid_episode" }, { status: 400 });
  const resolved = resolveEpisodePlayback(p.seriesId, season, episode);
  if (!resolved.ok) return NextResponse.json({ error: resolved.code }, { status: resolved.code === "not_found" ? 404 : 409 });
  if (resolved.value.source !== "movviz" || !resolved.value.path) return NextResponse.json({ error: "local_source_unavailable", plexRatingKey: resolved.value.plexRatingKey }, { status: 409 });
  let size: number;
  try { size = fs.statSync(resolved.value.path).size; } catch { return NextResponse.json({ error: "file_unavailable" }, { status: 404 }); }
  const raw = req.headers.get("range");
  let start = 0, end = size - 1;
  if (raw) {
    const m = /^bytes=(\d*)-(\d*)$/i.exec(raw.trim());
    if (!m) return new NextResponse(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]));
    end = m[2] ? Number(m[2]) : end;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= size) return new NextResponse(null, { status: 416, headers: { "content-range": `bytes */${size}` } });
    end = Math.min(end, size - 1);
  }
  const partial = start !== 0 || end !== size - 1;
  const headers: Record<string, string> = { "content-type": mime(resolved.value.path), "accept-ranges": "bytes", "content-length": String(end - start + 1), "cache-control": "private, no-store" };
  if (partial) headers["content-range"] = `bytes ${start}-${end}/${size}`;
  return new NextResponse(fs.createReadStream(resolved.value.path, { start, end }) as unknown as ReadableStream, { status: partial ? 206 : 200, headers });
}

export async function HEAD(req: NextRequest, context: Ctx) {
  const response = await GET(req, context);
  return new NextResponse(null, { status: response.status, headers: response.headers });
}
