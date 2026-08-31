import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { buildHeroSlides } from "@/lib/dashboard/suggestionEngine";
import { loadMovies } from "@/lib/library/store";
import { loadPlexConfig } from "@/lib/plex/store";
import { buildPlexWebUrl } from "@/lib/plex/client";
import { loadDashboardLayout } from "@/lib/dashboard/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const locale = req.nextUrl.searchParams.get("locale") ?? undefined;
  const { hero, youtubeTrailerSearch } = loadDashboardLayout(user.id);
  const slides = await buildHeroSlides(user.id, locale, 6, { includeOwned: hero.includeOwned, includeUnowned: hero.includeUnowned }, youtubeTrailerSearch, hero.minYear);

  const cfg = loadPlexConfig();
  const byTmdbId = new Map(loadMovies().map((m) => [m.tmdbId, m] as const));
  const withPlexUrl = slides.map((slide) => {
    const movie = byTmdbId.get(slide.detail.tmdbId);
    const plexUrl = movie?.plexRatingKey && cfg.machineIdentifier ? buildPlexWebUrl(cfg.machineIdentifier, movie.plexRatingKey) : null;
    return { ...slide, plexUrl, plexRatingKey: movie?.plexRatingKey ?? null };
  });

  return NextResponse.json({ slides: withPlexUrl });
}
