import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { listPlaybackProgress } from "@/lib/playback/progressStore";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const user = requireUser(req); if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ items: listPlaybackProgress(user.id).sort((a, b) => (b.lastPlayedAt ?? 0) - (a.lastPlayedAt ?? 0)) });
}
