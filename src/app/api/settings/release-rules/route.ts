import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadReleaseRules, saveReleaseRules } from "@/lib/library/releaseRules";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(loadReleaseRules());
}

export async function PUT(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  if (Array.isArray(body.blockedWords)) {
    patch.blockedWords = body.blockedWords.map((w: unknown) => String(w).trim()).filter(Boolean);
  }
  for (const key of ["maxMovieSizeMb", "maxEpisodeSizeMb", "maxSeasonSizeMb"] as const) {
    if (key in body) patch[key] = body[key] == null ? null : Math.max(0, Number(body[key])) || null;
  }
  if (body.codecScores && typeof body.codecScores === "object") {
    const cur = loadReleaseRules().codecScores;
    patch.codecScores = {
      x264: Number.isFinite(body.codecScores.x264) ? Number(body.codecScores.x264) : cur.x264,
      x265: Number.isFinite(body.codecScores.x265) ? Number(body.codecScores.x265) : cur.x265,
      av1: Number.isFinite(body.codecScores.av1) ? Number(body.codecScores.av1) : cur.av1,
    };
  }
  const next = saveReleaseRules(patch);
  return NextResponse.json(next);
}
