import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getRecommendations } from "@/lib/recommender/engine";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const type = req.nextUrl.searchParams.get("type") === "series" ? "series" : "movie";
  const results = await getRecommendations(user.id, type);
  return NextResponse.json({ results });
}
