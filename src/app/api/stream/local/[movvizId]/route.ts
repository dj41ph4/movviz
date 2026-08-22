import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { resolveMoviePlayback } from "@/lib/playback/sourceResolver";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ movvizId: string }> };

function contentType(file: string): string {
  const ext = file.toLowerCase().split(".").pop();
  return ext === "mkv" ? "video/x-matroska" : ext === "webm" ? "video/webm" : ext === "mov" ? "video/quicktime" : "video/mp4";
}

function rangeBounds(raw: string | null, size: number): { start: number; end: number } | null {
  if (!raw) return { start: 0, end: size - 1 };
  const match = /^bytes=(\d*)-(\d*)$/i.exec(raw.trim());
  if (!match) return null;
  const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
  const end = match[2] ? Number(match[2]) : size - 1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

export async function GET(req: NextRequest, context: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { movvizId } = await context.params;
  const resolved = resolveMoviePlayback(movvizId);
  if (!resolved.ok) return NextResponse.json({ error: resolved.code }, { status: resolved.code === "not_found" ? 404 : 409 });
  if (resolved.value.source !== "movviz" || !resolved.value.path) return NextResponse.json({ error: "local_source_unavailable", plexRatingKey: resolved.value.plexRatingKey }, { status: 409 });

  let stat: fs.Stats;
  try {
    stat = fs.statSync(resolved.value.path);
  } catch {
    return NextResponse.json({ error: "file_unavailable" }, { status: 404 });
  }
  const bounds = rangeBounds(req.headers.get("range"), stat.size);
  if (!bounds) return new NextResponse(null, { status: 416, headers: { "content-range": `bytes */${stat.size}` } });
  const partial = bounds.start !== 0 || bounds.end !== stat.size - 1;
  const headers: Record<string, string> = {
    "content-type": contentType(resolved.value.path),
    "accept-ranges": "bytes",
    "content-length": String(bounds.end - bounds.start + 1),
    "cache-control": "private, no-store",
  };
  if (partial) headers["content-range"] = `bytes ${bounds.start}-${bounds.end}/${stat.size}`;
  const stream = fs.createReadStream(resolved.value.path, { start: bounds.start, end: bounds.end });
  return new NextResponse(stream as unknown as ReadableStream, { status: partial ? 206 : 200, headers });
}

export async function HEAD(req: NextRequest, context: Ctx) {
  const response = await GET(req, context);
  return new NextResponse(null, { status: response.status, headers: response.headers });
}
