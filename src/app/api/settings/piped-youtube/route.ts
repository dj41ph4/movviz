import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireUser } from "@/lib/auth/guard";
import { getPipedYoutubePlaybackEnabled, setPipedYoutubePlaybackEnabled } from "@/lib/settings/trailerSources";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireUser(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ enabled: getPipedYoutubePlaybackEnabled() });
}

export async function PUT(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body.enabled !== "boolean") return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  setPipedYoutubePlaybackEnabled(body.enabled);
  return NextResponse.json({ enabled: getPipedYoutubePlaybackEnabled() });
}
