import { NextRequest, NextResponse } from "next/server";
import { requireExtensionUser } from "@/lib/extension/auth";
import { lookupMedia, type ExtensionType } from "@/lib/extension/lookup";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireExtensionUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized", source: "extension" }, { status: 401 });

  const p = req.nextUrl.searchParams;
  const rawType = p.get("type");
  const type: ExtensionType | undefined = rawType === "movie" ? "movie" : rawType === "series" ? "series" : undefined;
  const tmdbId = Number(p.get("tmdbId")) || undefined;
  const year = Number(p.get("year")) || undefined;
  const imdbId = p.get("imdbId") || undefined;
  const tvdbId = p.get("tvdbId") || undefined;
  const title = p.get("title") || undefined;
  if (!(tmdbId && type) && !imdbId && !tvdbId && !title) {
    return NextResponse.json({ error: "missing query" }, { status: 400 });
  }

  const media = await lookupMedia({ type, tmdbId, imdbId, tvdbId, title, year });
  if (!media) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ media });
}
