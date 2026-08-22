import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { mapWithConcurrency } from "@/lib/concurrency";
import { getTitleImages, pickEditorialArtwork } from "@/lib/metadata/tmdb";
import { cacheTitleArtwork, loadCachedTitleArtwork } from "@/lib/metadata/titleArtworkCache";

export const dynamic = "force-dynamic";

type ArtworkRef = { tmdbId: number; type: "movie" | "series" };

const MAX_ARTWORK_ITEMS = 160;
const TMDB_ARTWORK_CONCURRENCY = 4;

function parseArtworkRefs(raw: string | null): ArtworkRef[] | null {
  if (!raw) return null;

  const seen = new Set<string>();
  const refs: ArtworkRef[] = [];
  for (const value of raw.split(",")) {
    const [type, id] = value.split(":");
    const tmdbId = Number(id);
    if ((type !== "movie" && type !== "series") || !Number.isInteger(tmdbId) || tmdbId <= 0) return null;
    const key = `${type}:${tmdbId}`;
    if (!seen.has(key)) {
      seen.add(key);
      refs.push({ type, tmdbId });
    }
  }

  return refs.length > 0 && refs.length <= MAX_ARTWORK_ITEMS ? refs : null;
}

/**
 * Resolves the small amount of artwork needed by an editorial screen in one
 * browser request. Individual cards must never fan out into one TMDb request
 * each. The selected 16:9 backdrop and logo are stored durably in Movviz, so
 * normal page loads resolve here without waiting for TMDb at all.
 */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const refs = parseArtworkRefs(req.nextUrl.searchParams.get("items"));
  if (!refs) return NextResponse.json({ error: "invalid_items" }, { status: 400 });
  const locale = req.nextUrl.searchParams.get("locale") ?? undefined;

  const cached = loadCachedTitleArtwork(refs, locale);
  const missing = refs.filter((ref) => !cached[`${ref.type}:${ref.tmdbId}`]);
  const freshEntries = await mapWithConcurrency(missing, TMDB_ARTWORK_CONCURRENCY, async (ref) => {
    const images = await getTitleImages(ref.tmdbId, ref.type, locale);
    const artwork = pickEditorialArtwork(images);
    return {
      type: ref.type,
      tmdbId: ref.tmdbId,
      // The pair is intentionally blank if TMDb has no neutral backdrop:
      // a duplicate title treatment is worse than Movviz's text fallback.
      ...artwork,
    };
  });
  cacheTitleArtwork(freshEntries, locale);
  const artwork: Record<string, { backdropPath: string | null; logoPath: string | null }> = {};
  for (const [key, entry] of Object.entries(cached)) {
    artwork[key] = { backdropPath: entry.backdropPath, logoPath: entry.logoPath };
  }
  for (const entry of freshEntries) {
    artwork[`${entry.type}:${entry.tmdbId}`] = {
      backdropPath: entry.backdropPath,
      logoPath: entry.logoPath,
    };
  }

  return NextResponse.json(
    { artwork },
    {
      headers: {
        // The URL is deterministic for one title set + locale. Browser cache
        // makes tab changes/back-navigation instant; the durable server cache
        // remains the fallback after a browser restart.
        "Cache-Control": "private, max-age=86400, stale-while-revalidate=604800",
      },
    }
  );
}
