import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getWatchStatus } from "@/lib/plex/watchStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const status = getWatchStatus(user.id);
  return NextResponse.json({ movies: status?.movies ?? [], episodes: status?.episodes ?? [] });
}
