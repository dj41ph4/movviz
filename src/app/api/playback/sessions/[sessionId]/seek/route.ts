import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { applyMarkerSkip, applySeek, getPlaybackSession } from "@/lib/playback/progressStore";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  const user = requireUser(req); if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { sessionId } = await context.params; const session = getPlaybackSession(sessionId);
  if (!session || session.userId !== user.id) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  let b: any; try { b = await req.json(); } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }); }
  const p = b?.reason === "skip_marker" ? applyMarkerSkip(sessionId, Number(b?.toMs) || 0, String(b?.markerType ?? "")) : applySeek(sessionId, Number(b?.toMs) || 0);
  return NextResponse.json({ watched: p.watched, resumeOffsetMs: p.watched ? null : p.resumeOffsetMs, revision: p.revision });
}
