import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadBlocklist, addToBlocklist } from "@/lib/blocklist/store";
import { getMovie, getSeries } from "@/lib/metadata/tmdb";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ blocklist: loadBlocklist() });
}

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const type = body.type === "series" ? "series" : "movie";
  const tmdbId = Number(body.tmdbId);
  if (!tmdbId) return NextResponse.json({ error: "tmdbId required" }, { status: 400 });

  const meta = type === "movie" ? await getMovie(tmdbId) : await getSeries(tmdbId);
  if (!meta) return NextResponse.json({ error: `${type} not found on TMDb` }, { status: 404 });

  const entry = addToBlocklist({
    id: `blk_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    type,
    tmdbId: meta.tmdbId,
    title: meta.title,
    year: meta.year,
    posterPath: meta.posterPath,
    reason: String(body.reason ?? "").trim(),
    blockedBy: admin.username,
    blockedAt: Date.now(),
  });

  return NextResponse.json(entry, { status: 201 });
}
