import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { computeStats, type PlaySource, type StatsPeriod } from "@/lib/stats/playStats";

export const dynamic = "force-dynamic";

const PERIODS = new Set([7, 30, 90, 365, 0]);

/** Statistiques de lecture (Movviz + Plex). `/api/stats` reste réservé aux statistiques de bibliothèque. */
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const params = new URL(req.url).searchParams;
  const periodRaw = Number(params.get("period") ?? 30);
  const period = (PERIODS.has(periodRaw) ? periodRaw : 30) as StatsPeriod;
  const sourceRaw = params.get("source");
  const source: PlaySource | null = sourceRaw === "movviz" || sourceRaw === "plex" ? sourceRaw : null;
  const stats = computeStats({
    period,
    source,
    userId: params.get("user") || null,
    offset: Number(params.get("offset")) || 0,
    limit: Number(params.get("limit")) || 50,
  });
  return NextResponse.json(stats);
}
