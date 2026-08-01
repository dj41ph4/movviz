import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadMovies, loadSeries } from "@/lib/library/store";
import { encodeLibraryRef, resolveMovieStatus, type LibraryStatus, type LibrarySeries } from "@/lib/library/types";
import { allAnimeVfLaunches } from "@/lib/metadata/animeVfCalendar";
import { titleSimilarity } from "@/lib/library/matching";

export const dynamic = "force-dynamic";

/**
 * `badges` names every dub/version releasing on that date — "VO" for the
 * original, plus one entry per dubbed region we track (currently just "VF"
 * for France; more regions can be appended here later without touching the
 * merge logic below). A title releasing simultaneously in several versions
 * gets ONE calendar row carrying all of them, not one row per version.
 */
export interface CalendarEntry {
  date: string; // ISO date
  kind: "movie" | "episode" | "series";
  title: string;
  posterPath: string | null;
  href: string;
  badges?: string[];
  /** For the sidepanel (movie/series only — TitlePanel doesn't do season/episode-specific views). */
  tmdbId: number;
  /** For the quick-action search trigger (ManualSearchModal) — null for the informational anime-VF-launch row, which has no single grabbable file. */
  libraryRef: string | null;
  /** Movie: resolveMovieStatus(movie). Episode: the episode's own status (the atomic actionable unit). Series (anime-VF row): a coarse aggregate — informational only, no quick action regardless. */
  status: LibraryStatus;
  year?: number | null;
}

/** Coarse aggregate for the anime-VF-launch row only — informational, never drives a quick action. */
function seriesAggregateStatus(series: LibrarySeries): LibraryStatus {
  const monitored = series.seasons.flatMap((s) => s.episodes).filter((e) => e.monitored);
  if (monitored.length === 0) return "missing";
  if (monitored.every((e) => e.status === "available")) return "available";
  if (monitored.some((e) => e.status === "downloading")) return "downloading";
  if (monitored.some((e) => e.status === "searching")) return "searching";
  if (monitored.every((e) => e.status === "upcoming")) return "upcoming";
  return "missing";
}

/** Every future date attached to something currently monitored. */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const entries: CalendarEntry[] = [];

  for (const movie of loadMovies()) {
    if (!movie.monitored) continue;
    // Prioritize VOD/BluRay date over theatrical — a movie is only
    // actionable once it's actually downloadable, which is the digital/
    // physical release, not the cinema premiere.
    const date = movie.vfReleaseDate ?? movie.releaseDate;
    if (!date) continue;
    const badges: string[] = movie.vfReleaseDate ? ["VF"] : ["VO"];
    entries.push({
      date, kind: "movie", title: movie.title, posterPath: movie.posterPath,
      href: `/title/movie/${movie.tmdbId}`, badges,
      tmdbId: movie.tmdbId,
      libraryRef: encodeLibraryRef({ kind: "movie", movieId: movie.id }),
      status: resolveMovieStatus(movie),
      year: movie.year,
    });
  }

  const allAnimeLaunches = await allAnimeVfLaunches();

  for (const series of loadSeries()) {
    if (!series.monitored) continue;
    for (const season of series.seasons) {
      for (const ep of season.episodes) {
        if (!ep.monitored || !ep.airDate) continue;
        entries.push({
          date: ep.airDate,
          kind: "episode",
          title: `${series.title} — ${season.seasonNumber}x${String(ep.episodeNumber).padStart(2, "0")}`,
          posterPath: series.posterPath,
          href: `/title/series/${series.tmdbId}`,
          // Episodes only ever have the original air date — no publicly
          // available data on when a French dub of a given episode lands.
          badges: ["VO"],
          tmdbId: series.tmdbId,
          libraryRef: encodeLibraryRef({ kind: "episode", seriesId: series.id, season: season.seasonNumber, episode: ep.episodeNumber }),
          status: ep.status,
          year: series.year,
        });
      }
    }

    // Best-effort: anime VF dub launch dates, scraped from a community
    // calendar (no official API exists for this — see animeVfCalendar.ts).
    // A separate row from the episode's own VO air date, since it marks
    // when the season's French dub run actually starts, not one episode.
    // Informational only — no single grabbable file behind "the dub
    // launched", so libraryRef is null and the UI must not offer a quick
    // search action for this row.
    const MATCH_THRESHOLD = 0.72;
    let anime: typeof allAnimeLaunches[number] | null = null;
    let bestScore = 0;
    for (const l of allAnimeLaunches) {
      const score = titleSimilarity(series.title, l.title);
      if (score >= MATCH_THRESHOLD && score > bestScore) {
        anime = l;
        bestScore = score;
      }
    }
    if (anime && !anime.vostfrOnly) {
      entries.push({
        date: anime.launchDate,
        kind: "series",
        title: series.title,
        posterPath: series.posterPath,
        href: `/title/series/${series.tmdbId}`,
        badges: ["VF"],
        tmdbId: series.tmdbId,
        libraryRef: null,
        status: seriesAggregateStatus(series),
        year: series.year,
      });
    }
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json({ entries });
}
