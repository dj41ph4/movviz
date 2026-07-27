"use client";

import Link from "next/link";
import { Star, Film, Tv } from "lucide-react";
import { cn } from "@/lib/utils";
import { BADGE_SHAPE } from "@/components/library/MediaBadges";

const POSTER_BASE = "https://image.tmdb.org/t/p/w342";

/**
 * Lighter sibling of Discover's `DiscoverCard` — same poster/rating visual
 * language (reused, not reinvented), but no add-to-library affordance: every
 * dashboard row just opens the sidepanel, since these titles are either
 * already owned or better explored in full on Discover.
 */
export function DashboardPosterCard({
  tmdbId,
  type,
  title,
  posterPath,
  rating,
  badge,
}: {
  tmdbId: number;
  type: "movie" | "series";
  title: string;
  posterPath: string | null;
  rating?: number;
  badge?: string;
}) {
  const poster = posterPath ? `${POSTER_BASE}${posterPath}` : null;
  return (
    <Link
      href={`/title/${type}/${tmdbId}`}
      className="group block w-[150px] shrink-0 sm:w-[170px]"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/5 bg-surface transition-colors duration-200 group-hover:border-brand/30">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt={title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
            {type === "movie" ? <Film className="h-7 w-7 text-ink-soft/70" /> : <Tv className="h-7 w-7 text-ink-soft/70" />}
            <span className="line-clamp-3 text-sm font-semibold text-ink/90">{title}</span>
          </div>
        )}
        {typeof rating === "number" && rating > 0 && (
          <div className={cn(BADGE_SHAPE, "absolute left-2 top-2 border-white/15 bg-black/55 text-amber")}>
            <Star className="h-3 w-3 fill-amber" /> {rating.toFixed(1)}
          </div>
        )}
        {badge && (
          <div className={cn(BADGE_SHAPE, "pointer-events-none absolute right-2 top-2 border-white/15 bg-brand text-white")}>
            {badge}
          </div>
        )}
      </div>
      <p className="mt-1.5 truncate text-sm font-semibold text-ink">{title}</p>
    </Link>
  );
}
