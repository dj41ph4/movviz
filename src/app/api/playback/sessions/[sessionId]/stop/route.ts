import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getPlaybackSession, stopPlayback } from "@/lib/playback/progressStore";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  const user = requireUser(req); if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { sessionId } = await context.params; const session = getPlaybackSession(sessionId);
  if (!session || session.userId !== user.id) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  let b: any = {}; try { b = await req.json(); } catch { /* empty stop is valid */ }
  const p = stopPlayback(sessionId, Number.isFinite(Number(b?.positionMs)) ? Number(b.positionMs) : undefined);
  return NextResponse.json({ watched: p.watched, resumeOffsetMs: p.watched ? null : p.resumeOffsetMs, revision: p.revision });
}
