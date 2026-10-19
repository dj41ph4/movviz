import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { mapWithConcurrency } from "@/lib/concurrency";
import { getTitleImages, pickEditorialArtwork } from "@/lib/metadata/tmdb";
import { cacheTitleArtwork, loadCachedTitleArtwork } from "@/lib/metadata/titleArtworkCache";
import { BLEACH_TMDB_ID } from "@/lib/metadata/bleachEpisodeOrder";
import { bleachPresentationKey, parseBleachPart, type BleachPart } from "@/lib/metadata/bleachPresentation";
import { bleachPartArtwork } from "@/lib/metadata/bleachArtwork";
import { getSeriesByTmdbId } from "@/lib/library/store";

export const dynamic = "force-dynamic";

type ArtworkRef = { tmdbId: number; type: "movie" | "series"; seriesPart?: BleachPart };

// Request chunk guard, not a library-wide limit. Clients split arbitrary
// result sets into these bounded batches.
const MAX_ARTWORK_ITEMS = 120;
const TMDB_ARTWORK_CONCURRENCY = 4;

function parseArtworkRefs(raw: string | null): ArtworkRef[] | null {
  if (!raw) return null;

  const seen = new Set<string>();
  const refs: ArtworkRef[] = [];
  for (const value of raw.split(",")) {
    const [type, id, part, ...extra] = value.split(":");
    const tmdbId = Number(id);
    if ((type !== "movie" && type !== "series") || !Number.isInteger(tmdbId) || tmdbId <= 0) return null;
    const seriesPart = parseBleachPart(part);
    if (extra.length || (part !== undefined && (!seriesPart || type !== "series" || tmdbId !== BLEACH_TMDB_ID))) return null;
    const key = bleachPresentationKey({ type, tmdbId, seriesPart });
    if (!seen.has(key)) {
      seen.add(key);
      refs.push({ type, tmdbId, seriesPart });
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

  // TMDb artwork is shared by provider ID; only the final cosmetic choices
  // are per fiche. Resolve that provider once even when both parts are shown.
  const providerRefs = [...new Map(refs.map(ref => [`${ref.type}:${ref.tmdbId}`, { type: ref.type, tmdbId: ref.tmdbId }])).values()];
  const cached = loadCachedTitleArtwork(providerRefs, locale);
  const missing = providerRefs.filter((ref) => !cached[`${ref.type}:${ref.tmdbId}`]);
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
  const automatic: Record<string, { backdropPath: string | null; logoPath: string | null; titleEmbedded: boolean }> = {};
  for (const [key, entry] of Object.entries(cached)) {
    automatic[key] = {
      backdropPath: entry.backdropPath,
      logoPath: entry.logoPath,
      titleEmbedded: entry.titleEmbedded,
    };
  }
  for (const entry of freshEntries) {
    automatic[`${entry.type}:${entry.tmdbId}`] = {
      backdropPath: entry.backdropPath,
      logoPath: entry.logoPath,
      titleEmbedded: entry.titleEmbedded,
    };
  }
  const scoped = refs.some(ref => ref.seriesPart);
  const bleach = scoped ? getSeriesByTmdbId(BLEACH_TMDB_ID) : null;
  const artwork: typeof automatic = {};
  for (const ref of refs) {
    const base = automatic[`${ref.type}:${ref.tmdbId}`];
    if (!base) continue;
    const selected = ref.seriesPart && bleach ? bleachPartArtwork(bleach, ref.seriesPart) : {};
    artwork[bleachPresentationKey(ref)] = {
      backdropPath: selected.customBackdropPath ?? base.backdropPath,
      logoPath: selected.customLogoPath ?? (ref.seriesPart === "tybw" ? null : base.logoPath),
      titleEmbedded: selected.customBackdropPath || ref.seriesPart === "tybw" ? false : base.titleEmbedded,
    };
  }

  // A title that came back with neither backdrop nor logo (or no entry at all)
  // is a failed lookup: keep it out of the long browser cache so it is retried.
  const complete = refs.every((ref) => { const entry = artwork[bleachPresentationKey(ref)]; return !!entry && (entry.backdropPath != null || entry.logoPath != null); });
  return NextResponse.json(
    { artwork },
    {
      headers: {
        // The URL is deterministic for one title set + locale. Browser cache
        // makes tab changes/back-navigation instant; the durable server cache
        // remains the fallback after a browser restart.
        "Cache-Control": scoped || !complete ? "private, no-store" : "private, max-age=86400, stale-while-revalidate=604800",
      },
    }
  );
}
