import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getSeries } from "@/lib/library/store";
import { loadPlexConfig } from "@/lib/plex/store";
import { buildPlexWebUrl } from "@/lib/plex/client";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Resolves only the immediate next episode. Skipping a missing episode to
 * reach a later one would be convenient technically but wrong narratively.
 * The player therefore shows/starts the next item only when that exact item
 * is playable now, from Movviz local storage or Plex.
 */
export async function GET(req: NextRequest, { params }: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const seasonNumber = Number(req.nextUrl.searchParams.get("season"));
  const episodeNumber = Number(req.nextUrl.searchParams.get("episode"));
  if (!Number.isInteger(seasonNumber) || seasonNumber < 0 || !Number.isInteger(episodeNumber) || episodeNumber < 1) {
    return NextResponse.json({ error: "invalid_episode" }, { status: 400 });
  }

  const series = getSeries((await params).id);
  if (!series) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const ordered = series.seasons
    .flatMap((season) => season.episodes.map((episode) => ({ seasonNumber: season.seasonNumber, episode })))
    .sort((a, b) => a.seasonNumber - b.seasonNumber || a.episode.episodeNumber - b.episode.episodeNumber);
  const currentIndex = ordered.findIndex(
    (item) => item.seasonNumber === seasonNumber && item.episode.episodeNumber === episodeNumber,
  );
  const candidate = currentIndex >= 0 ? ordered[currentIndex + 1] : undefined;
  if (!candidate || candidate.episode.status !== "available" || (!candidate.episode.file && !candidate.episode.plexRatingKey)) {
    return NextResponse.json({ next: null });
  }

  const cfg = loadPlexConfig();
  const plexUrl = candidate.episode.plexRatingKey && cfg.machineIdentifier
    ? buildPlexWebUrl(cfg.machineIdentifier, candidate.episode.plexRatingKey)
    : null;
  // A playable player request needs a Plex URL as the final emergency
  // fallback, even when the local source will be chosen first.
  if (!candidate.episode.plexRatingKey || !plexUrl) return NextResponse.json({ next: null });

  return NextResponse.json({
    next: {
      seriesId: series.id,
      seriesTitle: series.title,
      seasonNumber: candidate.seasonNumber,
      episodeNumber: candidate.episode.episodeNumber,
      title: candidate.episode.title,
      plexRatingKey: candidate.episode.plexRatingKey,
      plexUrl,
    },
  });
}
