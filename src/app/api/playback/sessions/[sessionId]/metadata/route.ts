import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getPlaybackSession, updatePlaybackDuration } from "@/lib/playback/progressStore";

export const dynamic = "force-dynamic";

/** Receives stream metadata discovered by the player after its initial open. */
export async function POST(req: NextRequest, context: { params: Promise<{ sessionId: string }> }) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { sessionId } = await context.params;
  const session = getPlaybackSession(sessionId);
  if (!session || session.userId !== user.id) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  const body = await req.json().catch(() => null);
  const durationMs = Number(body?.durationMs);
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return NextResponse.json({ error: "invalid_duration" }, { status: 400 });
  }
  const progress = updatePlaybackDuration(sessionId, durationMs);
  if (!progress) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  return NextResponse.json({
    durationMs: progress.durationMs,
    completionBoundaryMs: progress.completionBoundaryMs,
    boundarySource: progress.boundarySource,
  });
}
