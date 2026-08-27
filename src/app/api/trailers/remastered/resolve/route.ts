import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { isRemasteredTrailersEnabled } from "@/lib/settings/remasteredTrailers";
import { resolveRemasteredTrailers } from "@/lib/trailers/remastered/resolver";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireUser(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // AVANT toute requête réseau
  if (!isRemasteredTrailersEnabled()) {
    return NextResponse.json({ candidates: [] });
  }
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") === "series" ? "series" : "movie";
  const tmdbId = parseInt(searchParams.get("tmdbId") || "", 10);
  const title = searchParams.get("title") || "";
  const originalTitle = searchParams.get("originalTitle");
  const yearRaw = searchParams.get("year");
  const year = yearRaw ? parseInt(yearRaw, 10) : null;
  const locale = searchParams.get("locale") || "fr";
  const originalLanguage = searchParams.get("originalLanguage");
  const context = searchParams.get("context") === "details" ? "details" : "carousel";

  if (!Number.isFinite(tmdbId) || tmdbId <= 0 || !title) {
    return NextResponse.json({ error: "invalid_params" }, { status: 400 });
  }

  try {
    const candidates = await resolveRemasteredTrailers({
      type: type as "movie" | "series",
      tmdbId,
      title,
      originalTitle,
      year: Number.isFinite(year as number) ? (year as number) : null,
      locale,
      originalLanguage,
      context: context as "carousel" | "details",
    });
    return NextResponse.json({ candidates });
  } catch (e) {
    // Jamais casser la page — fallback silencieux
    console.log(`[trailers:premium] resolve error ${e}`);
    return NextResponse.json({ candidates: [] });
  }
}
