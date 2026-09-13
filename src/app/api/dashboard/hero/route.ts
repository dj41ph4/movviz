import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { buildHeroSlides, buildLibraryHeroFallbackSlides } from "@/lib/dashboard/suggestionEngine";
import { loadMovies } from "@/lib/library/store";
import { loadPlexConfig } from "@/lib/plex/store";
import { buildPlexWebUrl } from "@/lib/plex/client";
import { loadDashboardLayout } from "@/lib/dashboard/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const locale = req.nextUrl.searchParams.get("locale") ?? undefined;
  const rich = req.nextUrl.searchParams.get("rich") === "1";
  const { hero, youtubeTrailerSearch } = loadDashboardLayout(user.id);
  // First paint is deliberately local and synchronous: a dashboard hero is
  // useful with its stored artwork even while TMDb is overloaded. The client
  // follows with ?rich=1 to restore recommendation ranking and trailers.
  const fallbackSlides = buildLibraryHeroFallbackSlides(6);
  const slides = rich
    ? await buildHeroSlides(user.id, locale, 6, { includeOwned: hero.includeOwned, includeUnowned: hero.includeUnowned }, youtubeTrailerSearch, hero.minYear).then((resolved) => resolved.length ? resolved : fallbackSlides)
    : fallbackSlides;

  const cfg = loadPlexConfig();
  const byTmdbId = new Map(loadMovies().map((m) => [m.tmdbId, m] as const));
  const withPlexUrl = slides.map((slide) => {
    const movie = byTmdbId.get(slide.detail.tmdbId);
    const plexUrl = movie?.plexRatingKey && cfg.machineIdentifier ? buildPlexWebUrl(cfg.machineIdentifier, movie.plexRatingKey) : null;
    return { ...slide, plexUrl, plexRatingKey: movie?.plexRatingKey ?? null };
  });

  return NextResponse.json({ slides: withPlexUrl });
}
