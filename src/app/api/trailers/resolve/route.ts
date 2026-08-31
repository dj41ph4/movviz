import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { resolveTrailerSources } from "@/lib/trailers/resolver";

export const dynamic = "force-dynamic";

/**
 * Server-side because the Apple/IMDb lookups are cross-origin fetches best
 * kept off the client (no CORS surprises, shared cache across every viewer
 * instead of one per browser). Gated entirely behind the caller's own
 * enhancedTrailerSourcesEnabled check — this route itself doesn't know or
 * care about the setting, it just resolves what it's asked for.
 */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const tmdbId = Number(searchParams.get("tmdbId"));
  const title = searchParams.get("title");
  const yearParam = searchParams.get("year");
  const imdbId = searchParams.get("imdbId");

  if ((type !== "movie" && type !== "series") || !Number.isFinite(tmdbId) || !title) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  const year = yearParam ? Number(yearParam) : null;
  const sources = await resolveTrailerSources(type, tmdbId, title, Number.isFinite(year as number) ? year : null, imdbId);
  return NextResponse.json({ sources });
}
