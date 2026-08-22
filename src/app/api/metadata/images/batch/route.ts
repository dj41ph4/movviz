import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { mapWithConcurrency } from "@/lib/concurrency";
import { getTitleImages } from "@/lib/metadata/tmdb";

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
 * each; TMDb's process cache remains the source for the upstream responses,
 * while this route bounds cold-cache work to four concurrent requests.
 */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const refs = parseArtworkRefs(req.nextUrl.searchParams.get("items"));
  if (!refs) return NextResponse.json({ error: "invalid_items" }, { status: 400 });
  const locale = req.nextUrl.searchParams.get("locale") ?? undefined;

  const entries = await mapWithConcurrency(refs, TMDB_ARTWORK_CONCURRENCY, async (ref) => {
    const images = await getTitleImages(ref.tmdbId, ref.type, locale);
    return [
      `${ref.type}:${ref.tmdbId}`,
      {
        // A backdrop is an actual TMDb 16:9 editorial image. Cards must not
        // silently turn a vertical poster into a pseudo-landscape crop.
        backdropPath: images.backdrops[0]?.filePath ?? null,
        logoPath: images.logos[0]?.filePath ?? null,
      },
    ] as const;
  });

  return NextResponse.json({ artwork: Object.fromEntries(entries) });
}
