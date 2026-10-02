import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getRecommendations } from "@/lib/recommender/engine";
import { responsiveRows } from "@/lib/recommender/responsiveCache";
import { notifyRecommendationsChanged } from "@/lib/recommender/updates";
import { getWatchedTitles } from "@/lib/recommender/watchedTitles";
import { getFeedback } from "@/lib/ai/tasteProfile";
import type { MetaSearchResult } from "@/lib/metadata/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const type = req.nextUrl.searchParams.get("type") === "series" ? "series" : "movie";
  const key = JSON.stringify([user.id, type, "recommendations"]) + ":recommended";
  const pool = await responsiveRows.read(key, () => getRecommendations(user.id, type), [] as MetaSearchResult[], () => notifyRecommendationsChanged(user.id), 30_000);
  const excluded = new Set([...getWatchedTitles(user.id, type).keys(), ...getFeedback(user.id).filter((f) => f.type === type && !f.liked).map((f) => f.tmdbId)]);
  return NextResponse.json({ results: pool.filter((item) => !excluded.has(item.tmdbId)), pending: responsiveRows.pending(key) });
}
