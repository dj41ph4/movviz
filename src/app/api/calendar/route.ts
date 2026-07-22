import { NextResponse } from "next/server";
import { loadMovies, loadSeries } from "@/lib/library/store";
import { findAnimeVfLaunch } from "@/lib/metadata/animeVfCalendar";

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
}

/** Every future date attached to something currently monitored. */
export async function GET() {
  const entries: CalendarEntry[] = [];

  for (const movie of loadMovies()) {
    if (!movie.monitored) continue;
    const byDate = new Map<string, string[]>();
    if (movie.releaseDate) byDate.set(movie.releaseDate, ["VO"]);
    // Dubbed/regional dates get merged into the same row when they land on
    // the same date as another version already recorded for this movie.
    if (movie.vfReleaseDate) {
      const existing = byDate.get(movie.vfReleaseDate);
      if (existing) existing.push("VF");
      else byDate.set(movie.vfReleaseDate, ["VF"]);
    }
    for (const [date, badges] of byDate) {
      entries.push({ date, kind: "movie", title: movie.title, posterPath: movie.posterPath, href: `/title/movie/${movie.tmdbId}`, badges });
    }
  }

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
        });
      }
    }

    // Best-effort: anime VF dub launch dates, scraped from a community
    // calendar (no official API exists for this — see animeVfCalendar.ts).
    // A separate row from the episode's own VO air date, since it marks
    // when the season's French dub run actually starts, not one episode.
    const anime = await findAnimeVfLaunch(series.title);
    if (anime && !anime.vostfrOnly) {
      entries.push({
        date: anime.launchDate,
        kind: "series",
        title: series.title,
        posterPath: series.posterPath,
        href: `/title/series/${series.tmdbId}`,
        badges: ["VF"],
      });
    }
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));
  return NextResponse.json({ entries });
}
