"use client";

import Link from "next/link";
import { Star, Film, Tv } from "lucide-react";
import { cn } from "@/lib/utils";
import { BADGE_SHAPE } from "@/components/library/MediaBadges";

const POSTER_BASE = "/tmdb/w342";

/**
 * Lighter sibling of Discover's `DiscoverCard` — same poster/rating visual
 * language (reused, not reinvented), but no add-to-library affordance: every
 * dashboard row just opens the sidepanel, since these titles are either
 * already owned or better explored in full on Discover.
 *
 * Hover reveals a metadata strip (year / runtime / genres) rather than a
 * full expand-and-preview treatment — pointer-only (`hidden sm:flex`), since
 * touch devices have no hover state to reveal it with in the first place.
 */
export function DashboardPosterCard({
  tmdbId,
  type,
  title,
  posterPath,
  rating,
  badge,
  year,
  runtime,
  genres,
  rank,
  progressPercent,
  subtitle,
}: {
  tmdbId: number;
  type: "movie" | "series";
  title: string;
  posterPath: string | null;
  rating?: number;
  badge?: string;
  year?: number | null;
  runtime?: number | null;
  genres?: string[];
  /** 1-based chart position — only ever set for a genuinely ranked row (e.g.
   *  TMDb's own trending order), never invented client-side. Only 1-10
   *  render the numeral treatment; anything past that is a plain card. */
  rank?: number;
  /** 0-100 — Continue Watching only. Drawn as a track across the bottom
   *  edge of the poster, same visual language as every other progress bar
   *  in the app (h-1 track + brand-gradient fill). */
  progressPercent?: number;
  /** Continue Watching only — the episode label ("S2 E5") under the title,
   *  in place of the hover-only year/runtime/genres strip which doesn't
   *  make sense for a specific in-progress episode. */
  subtitle?: string;
}) {
  const poster = posterPath ? `${POSTER_BASE}${posterPath}` : null;
  const hasMeta = !subtitle && (!!year || !!runtime || (genres && genres.length > 0));
  const showRank = !!rank && rank >= 1 && rank <= 10;
  return (
    <Link
      href={`/title/${type}/${tmdbId}`}
      className={cn("group shrink-0", showRank ? "flex w-[190px] items-end sm:w-[220px]" : "block w-[150px] sm:w-[170px]")}
    >
      {showRank && (
        <span
          aria-hidden
          className="pointer-events-none relative -mr-2 -translate-y-1 select-none text-[84px] font-black leading-none tracking-tighter text-transparent sm:-mr-3 sm:text-[104px]"
          style={{ WebkitTextStroke: "3px rgba(255,255,255,0.22)" }}
        >
          {rank}
        </span>
      )}
      <div className="w-[150px] shrink-0 sm:w-[170px]">
      <div className="relative aspect-[2/3] w-[150px] shrink-0 overflow-hidden rounded-2xl border border-white/5 bg-surface transition-colors duration-200 group-hover:border-brand/30 sm:w-[170px]">
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
        {hasMeta && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden flex-col gap-1 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-2.5 pb-2.5 pt-6 opacity-0 transition-opacity duration-200 group-hover:opacity-100 sm:flex">
            <div className="flex flex-wrap items-center gap-x-1.5 text-[11px] font-semibold text-white/85">
              {year && <span>{year}</span>}
              {runtime && (
                <>
                  {year && <span className="text-white/40">•</span>}
                  <span>{runtime} min</span>
                </>
              )}
            </div>
            {genres && genres.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {genres.slice(0, 2).map((g) => (
                  <span key={g} className="rounded-full border border-white/20 px-1.5 py-0.5 text-[10px] text-white/80">{g}</span>
                ))}
              </div>
            )}
          </div>
        )}
        {typeof progressPercent === "number" && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/8">
            <div className="h-full brand-gradient" style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }} />
          </div>
        )}
      </div>
      <p className="mt-1.5 truncate text-center text-sm font-semibold text-ink">{title}</p>
      {subtitle && <p className="truncate text-center text-xs text-ink-dim">{subtitle}</p>}
      </div>
    </Link>
  );
}
