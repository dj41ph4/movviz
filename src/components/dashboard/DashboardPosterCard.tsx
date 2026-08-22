"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import { Star, Film, Tv, Play, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { BADGE_SHAPE } from "@/components/library/MediaBadges";
import { useT } from "@/i18n/provider";

const POSTER_BASE = "/tmdb/w500";
const BACKDROP_BASE = "/tmdb/w780";
const LOGO_BASE = "/tmdb/w500";

/**
 * Single editorial landscape card for Dashboard, Films and Series. It owns
 * neither add/download behavior nor a detail implementation: its existing
 * Link is intercepted by useTitlePanel, so every click still opens the one
 * shared TitleContent inside the floating panel.
 *
 * Editorial rows use actual 16:9 backdrops. If TMDb genuinely has none, a
 * neutral Movviz title card is preferable to pretending that a vertical
 * poster crop is a landscape image.
 */
export function DashboardPosterCard({
  tmdbId,
  type,
  title,
  posterPath,
  backdropPath,
  logoPath,
  rating,
  badge,
  year,
  runtime,
  genres,
  rank,
  progressPercent,
  subtitle,
  layout = "row",
  reserveBottomRight = false,
}: {
  tmdbId: number;
  type: "movie" | "series";
  title: string;
  posterPath: string | null;
  backdropPath?: string | null;
  /** Pre-resolved by the row-level artwork batch, or a Movviz custom logo. */
  logoPath?: string | null;
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
  /** `row` owns its editorial carousel width; `fill` lets a catalogue grid
   *  decide the column width while keeping the exact same visual card. */
  layout?: "row" | "fill";
  /** Keeps the title mark clear of an action supplied by the parent card. */
  reserveBottomRight?: boolean;
}) {
  const t = useT();
  const [hovered, setHovered] = useState(false);
  const [popover, setPopover] = useState<{ left: number; top: number; width: number; above: boolean } | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poster = posterPath ? `${POSTER_BASE}${posterPath}` : null;
  const backdrop = backdropPath ? `${BACKDROP_BASE}${backdropPath}` : null;
  const logo = logoPath ? `${LOGO_BASE}${logoPath}` : null;
  const previewImage = backdrop;
  const hasMeta = !subtitle && (!!year || !!runtime || (genres && genres.length > 0));
  const showRank = !!rank && rank >= 1 && rank <= 10;

  const clearTimers = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    hoverTimer.current = null;
    leaveTimer.current = null;
  };
  const closePreview = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    // The tiny delay lets the pointer cross from the source card to its
    // portalled preview. Without it, the old pointer-events-none preview
    // disappeared at the exact moment it became useful.
    leaveTimer.current = setTimeout(() => setHovered(false), 110);
  };
  const openPreview = (target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const width = Math.min(Math.max(Math.round(rect.width * 1.24), 360), 480, window.innerWidth - 16);
    const estimatedHeight = Math.round(width * 0.5625) + 116;
    const above = rect.top + estimatedHeight > window.innerHeight - 12;
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8));
    // Netflix-style: the preview grows from the hovered tile rather than
    // appearing below it as a detached tooltip.
    setPopover({ left, top: above ? rect.bottom + 12 : Math.max(8, rect.top - 12), width, above });
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => setHovered(true), 520);
  };

  useEffect(() => () => clearTimers(), []);

  return (
    <>
    <Link
      href={`/title/${type}/${tmdbId}`}
      onMouseEnter={(event) => openPreview(event.currentTarget)}
      onMouseLeave={closePreview}
      className={cn("group shrink-0 transition-opacity duration-200", showRank ? "flex w-[190px] items-end sm:w-[220px]" : layout === "fill" ? "block w-full" : "block w-[300px] lg:w-[320px] xl:w-[340px] 2xl:w-[360px]", hovered && "opacity-0 sm:opacity-35")}
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
          {showRank ? (
            poster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={poster} alt={title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
                {type === "movie" ? <Film className="h-7 w-7 text-ink-soft/70" /> : <Tv className="h-7 w-7 text-ink-soft/70" />}
                <span className="line-clamp-3 text-sm font-semibold text-ink/90">{title}</span>
              </div>
            )
          ) : backdrop ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={backdrop} alt={title} loading="lazy" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.035]" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/90 via-black/15 to-black/5" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/45 via-transparent to-transparent" />
            </>
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-[radial-gradient(circle_at_30%_20%,rgba(181,64,255,0.32),transparent_45%),#12111c] p-4 text-center">
              {type === "movie" ? <Film className="h-7 w-7 text-ink-soft/70" /> : <Tv className="h-7 w-7 text-ink-soft/70" />}
            </div>
          )}

          {!showRank && (
            <div
              className={cn(
                "pointer-events-none absolute bottom-3 left-3 z-10 flex min-h-8 items-end",
                reserveBottomRight ? "right-14" : "right-3",
              )}
            >
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" loading="lazy" className="max-h-10 max-w-[78%] object-contain object-left drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]" />
              ) : (
                <span className="line-clamp-2 text-sm font-black leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">{title}</span>
              )}
            </div>
          )}

          {typeof rating === "number" && rating > 0 && (
            <div className={cn(BADGE_SHAPE, "absolute left-2 top-2 z-10 border-white/15 bg-black/55 text-amber")}>
              <Star className="h-3 w-3 fill-amber" /> {rating.toFixed(1)}
            </div>
          )}
          {badge && (
            <div className={cn(BADGE_SHAPE, "pointer-events-none absolute right-2 top-2 z-10 border-white/15 bg-black/60 text-white/85 backdrop-blur-md")}>
              {badge}
            </div>
          )}
          {typeof progressPercent === "number" && (
            <div className="absolute inset-x-0 bottom-0 z-20 h-1 bg-white/8">
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
        onMouseEnter={() => {
          if (leaveTimer.current) clearTimeout(leaveTimer.current);
          if (hoverTimer.current) clearTimeout(hoverTimer.current);
          setHovered(true);
        }}
        onMouseLeave={closePreview}
        className="fixed z-[80] hidden overflow-hidden rounded-[18px] border border-white/20 bg-[#171522]/98 shadow-[0_24px_70px_rgba(0,0,0,0.72)] ring-1 ring-white/10 backdrop-blur-xl sm:block"
        style={{ left: popover.left, top: popover.top, width: popover.width, transform: popover.above ? "translateY(-100%)" : undefined }}
      >
        <Link href={`/title/${type}/${tmdbId}`} className="group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow">
          <div className="relative aspect-video overflow-hidden">
            {previewImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewImage} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-[radial-gradient(circle_at_30%_20%,rgba(181,64,255,0.36),transparent_45%),#12111c]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/10 to-transparent" />
            <div className="absolute inset-x-4 bottom-3 min-w-0">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logo} alt="" className="max-h-11 max-w-[210px] object-contain object-left drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]" />
              ) : (
                <span className="line-clamp-2 text-base font-black leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">{title}</span>
              )}
            </div>
          </div>
          <div className="space-y-2.5 p-3.5">
            <div className="flex items-center gap-2.5 text-xs font-semibold text-white/90">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black shadow-lg transition-transform duration-150 group-hover:scale-105"><Play className="ml-0.5 h-4 w-4 fill-current" /></span>
              <span className="flex h-9 min-w-0 flex-1 items-center rounded-full bg-white/10 px-3 text-sm text-white transition-colors group-hover:bg-white/16">{t("dashboard.hero.moreInfo")}</span>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 text-white/85"><Info className="h-4 w-4" /></span>
            </div>
            {subtitle && <p className="truncate text-[11px] text-white/70">{subtitle}</p>}
            {(hasMeta || showRank) && <div className="flex flex-wrap items-center gap-x-1.5 text-[11px] font-semibold text-white/80">
              {showRank && <span className="text-brand-glow">Top {rank}</span>}
              {year && <span>{year}</span>}
              {runtime && <><span className="text-white/40">•</span><span>{runtime} min</span></>}
            </div>}
            {genres && genres.length > 0 && <div className="flex flex-wrap gap-1">
              {genres.slice(0, 2).map((g) => <span key={g} className="rounded-full border border-white/20 px-1.5 py-0.5 text-[10px] text-white/80">{g}</span>)}
            </div>}
          </div>
        </Link>
      </div>, document.body
    )}
    </>
  );
}
