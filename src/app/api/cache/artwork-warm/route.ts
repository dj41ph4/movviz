import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { getArtworkWarmState, startArtworkCacheWarm, type ArtworkWarmMode } from "@/lib/metadata/artworkCacheWarm";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(getArtworkWarmState());
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({})) as { mode?: unknown };
  const mode: ArtworkWarmMode = body.mode === "incremental" ? "incremental" : "complete";
  return NextResponse.json(startArtworkCacheWarm(mode));
}
