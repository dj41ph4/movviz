import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getPlaybackProgress } from "@/lib/playback/progressStore";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest, context: { params: Promise<{ ratingKey: string }> }) {
  const user = requireUser(req); if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { ratingKey } = await context.params;
  const mediaId = req.nextUrl.searchParams.get("mediaId")?.trim() || undefined;
  const p = getPlaybackProgress(user.id, ratingKey, mediaId);
  return NextResponse.json(p ? { ...p, resumeOffsetMs: p.watched ? null : p.resumeOffsetMs } : { watched: false, resumeOffsetMs: null, eligibleForResume: false });
}
