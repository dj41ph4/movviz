import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { resolveConnectPlay } from "@/lib/connect/resolve";

export const dynamic = "force-dynamic";

const intParam = (v: string | null, lo: number, hi: number): number | undefined => {
  if (v === null || !/^\d+$/.test(v)) return undefined;
  const n = Number(v);
  return n >= lo && n <= hi ? n : undefined;
};

/** Un appareil récepteur demande quoi lire (identifiants du fichier + reprise) pour un ordre Connect. */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const q = req.nextUrl.searchParams;
  const tmdbId = intParam(q.get("tmdbId"), 1, 2_000_000_000);
  const mediaType = q.get("type") === "series" ? "series" : q.get("type") === "movie" ? "movie" : null;
  if (tmdbId === undefined || !mediaType) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const resumeRaw = Number(q.get("resume"));
  const resolved = resolveConnectPlay(user.id, {
    tmdbId,
    mediaType,
    season: intParam(q.get("season"), 0, 1000),
    episode: intParam(q.get("episode"), 0, 100_000),
    fromBeginning: q.get("fromBeginning") === "1",
    resumeSeconds: q.has("resume") && Number.isFinite(resumeRaw) && resumeRaw >= 0 ? Math.min(resumeRaw, 1_000_000) : undefined,
  });
  if (!resolved) return NextResponse.json({ error: "not_playable" }, { status: 404 });
  return NextResponse.json(resolved, { headers: { "cache-control": "no-store" } });
}
