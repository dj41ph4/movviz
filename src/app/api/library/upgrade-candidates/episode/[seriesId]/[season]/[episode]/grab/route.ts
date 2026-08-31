import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { grabEpisodeUpgradeCandidate } from "@/lib/library/searchAndReplaceSeries";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ seriesId: string; season: string; episode: string }> };

/** Explicit user click only — never triggered automatically. Mirrors the movie grab route (searchAndReplace.ts). */
export async function POST(req: NextRequest, { params }: Ctx) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { seriesId, season, episode } = await params;
  const result = await grabEpisodeUpgradeCandidate(seriesId, Number(season), Number(episode));
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json(result, { status: result.error === "no_candidate" ? 404 : 502 });
}
