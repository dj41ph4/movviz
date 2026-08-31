import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { resolveMoviePlayback } from "@/lib/playback/sourceResolver";
import { getLocalStreamInfo } from "@/lib/playback/localStreamInfo";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ movvizId: string }> };

export async function GET(req: NextRequest, context: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { movvizId } = await context.params;
  const resolved = resolveMoviePlayback(movvizId);
  if (!resolved.ok) return NextResponse.json({ error: resolved.code }, { status: resolved.code === "not_found" ? 404 : 409 });
  let size: number | null = null;
  if (resolved.value.path) {
    try { size = fs.statSync(resolved.value.path).size; } catch { /* stream route reports availability */ }
  }
  const streamInfo = await getLocalStreamInfo(resolved.value.plexRatingKey, user.id, movvizId, resolved.value.path ?? undefined);
  return NextResponse.json({
    movvizId,
    source: resolved.value.source,
    playable: resolved.value.source === "movviz" ? Boolean(resolved.value.path && size != null) : Boolean(resolved.value.plexRatingKey),
    plexRatingKey: resolved.value.plexRatingKey,
    size,
    ...streamInfo,
  }, { headers: { "cache-control": "private, no-store" } });
}
