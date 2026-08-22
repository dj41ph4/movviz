"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useRef, useState } from "react";
import { Star, Film, Tv, Play } from "lucide-react";
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
  const [hovered, setHovered] = useState(false);
  const [popover, setPopover] = useState<{ left: number; top: number; width: number; above: boolean } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poster = posterPath ? `${POSTER_BASE}${posterPath}` : null;
  const hasMeta = !subtitle && (!!year || !!runtime || (genres && genres.length > 0));
  const showRank = !!rank && rank >= 1 && rank <= 10;
  return (
    <>
    <Link
      href={`/title/${type}/${tmdbId}`}
      onMouseEnter={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const above = rect.top > 190;
        setPopover({ left: Math.max(8, Math.min(rect.left, window.innerWidth - rect.width - 8)), top: above ? rect.top - 12 : rect.bottom + 12, width: rect.width, above });
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        hoverTimer.current = setTimeout(() => setHovered(true), 700);
      }}
      onMouseLeave={() => {
        if (hoverTimer.current) clearTimeout(hoverTimer.current);
        setHovered(false);
      }}
      className={cn("group shrink-0", showRank ? "flex w-[190px] items-end sm:w-[220px]" : "block w-[205px] lg:w-[210px] xl:w-[205px]")}
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
      <div className={cn("shrink-0", showRank ? "w-[150px] sm:w-[170px]" : "w-full")}>
      <div className={cn("relative shrink-0 overflow-hidden rounded-2xl border border-white/5 bg-surface transition-colors duration-200 group-hover:border-brand/30", showRank ? "aspect-[2/3] w-[150px] sm:w-[170px]" : "aspect-video w-full")}>
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
          <div className={cn(BADGE_SHAPE, "pointer-events-none absolute right-2 top-2 border-white/15 bg-black/60 text-white/85 backdrop-blur-md")}>
            {badge}
          </div>
        )}
        {typeof progressPercent === "number" && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/8">
            <div className="h-full brand-gradient" style={{ width: `${Math.max(0, Math.min(100, progressPercent))}%` }} />
          </div>
        )}
      </div>
      {showRank && <p className="mt-1.5 truncate text-center text-sm font-semibold text-ink">{title}</p>}
      {showRank && subtitle && <p className="truncate text-center text-xs text-ink-dim">{subtitle}</p>}
      </div>
    </Link>
    {hovered && popover && typeof document !== "undefined" && createPortal(
      <div
        className="pointer-events-none fixed z-[80] hidden overflow-hidden rounded-2xl border border-white/15 bg-[#171522]/95 p-3 shadow-2xl shadow-black/50 backdrop-blur-xl sm:block"
        style={{ left: popover.left, top: popover.top, width: popover.width, transform: popover.above ? "translateY(-100%)" : undefined }}
      >
        {poster && <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20" />}
        <div className="relative flex items-center gap-2 text-xs font-semibold text-white/90">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-lg"><Play className="ml-0.5 h-3.5 w-3.5 fill-current" /></span>
          <span className="truncate text-sm">{title}</span>
        </div>
        {subtitle && <p className="relative mt-1 truncate text-[11px] text-white/70">{subtitle}</p>}
        {(hasMeta || showRank) && <div className="relative mt-1 flex flex-wrap items-center gap-x-1.5 text-[11px] font-semibold text-white/80">
          {showRank && <span className="text-brand-glow">Top {rank}</span>}
          {year && <span>{year}</span>}
          {runtime && <><span className="text-white/40">•</span><span>{runtime} min</span></>}
        </div>}
        {genres && genres.length > 0 && <div className="relative mt-1 flex flex-wrap gap-1">
          {genres.slice(0, 2).map((g) => <span key={g} className="rounded-full border border-white/20 px-1.5 py-0.5 text-[10px] text-white/80">{g}</span>)}
        </div>}
      </div>, document.body
    )}
    </>
  );
}
