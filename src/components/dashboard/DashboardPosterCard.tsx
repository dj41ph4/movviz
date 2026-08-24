"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import useSWR from "swr";
import { Star, Film, Tv, Play, Plus, ThumbsUp, ThumbsDown, ChevronDown, Loader2, Clock3, RotateCcw } from "lucide-react";
import { cn, openPlexLink } from "@/lib/utils";
import { BADGE_SHAPE, buildMediaBadgeItems, type BadgeInfo } from "@/components/library/MediaBadges";
import { useI18n } from "@/i18n/provider";
import { toast } from "@/components/ui/Toast";
import type { MetaDetail } from "@/lib/metadata/types";
import { useBetaPlayer } from "@/lib/settings/useBetaPlayer";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { AdaptiveTitleLogo } from "@/components/media/AdaptiveTitleLogo";

const POSTER_BASE = "/tmdb/w500";
const BACKDROP_BASE = "/tmdb/w780";
const LOGO_BASE = "/tmdb/w500";
const fetcher = (url: string) => fetch(url).then((response) => (response.ok ? response.json() : null));

export type DashboardCardPlayback = {
  ratingKey: string;
  plexUrl: string;
  movvizId?: string;
  seriesId?: string;
  type: "movie" | "series";
  seasonNumber?: number;
  episodeNumber?: number;
};

function formatRuntime(minutes: number | null | undefined): string | null {
  if (!minutes || minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  return hours > 0 ? `${hours} h${remaining ? ` ${remaining} min` : ""}` : `${minutes} min`;
}

function formatResumeTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remaining = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`
    : `${minutes}:${String(remaining).padStart(2, "0")}`;
}

/** Technical facts attached to the exact local file being resumed. */
export type DashboardCardTechnical = Pick<BadgeInfo, "resolution" | "videoCodec" | "audioCodec" | "hdr">;

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
  titleEmbedded = false,
  rating,
  badge,
  year,
  runtime,
  genres,
  rank,
  progressPercent,
  resumeSeconds,
  subtitle,
  inLibrary = false,
  layout = "row",
  reserveBottomRight = false,
  playback,
  technical,
  popoverActions,
  popoverFooter,
  dislikable = false,
}: {
  tmdbId: number;
  type: "movie" | "series";
  title: string;
  posterPath: string | null;
  backdropPath?: string | null;
  /** Pre-resolved by the row-level artwork batch, or a Movviz custom logo. */
  logoPath?: string | null;
  /** True when the selected 16:9 key art already carries its title. */
  titleEmbedded?: boolean;
  rating?: number;
  /** Usually a short status label, but any node works — e.g. a colored
   *  status pill or a watched-toggle button (see LibraryMovieCard). */
  badge?: ReactNode;
  year?: number | null;
  runtime?: number | null;
  genres?: string[];
  /** Extra buttons rendered in the popover's action row, after the like
   *  button — e.g. Bibliothèque's optimize/search/tags/delete menu. Kept
   *  as a single slot so this shared card stays unaware of library-specific
   *  actions; the caller owns their icons, handlers and confirm states. */
  popoverActions?: ReactNode;
  /** Extra content rendered at the bottom of the popover, below genres —
   *  e.g. Bibliothèque's tag chips. */
  popoverFooter?: ReactNode;
  /** 1-based chart position — only ever set for a genuinely ranked row (e.g.
   *  TMDb's own trending order), never invented client-side. Only 1-10
   *  render the numeral treatment; anything past that is a plain card. */
  rank?: number;
  /** 0-100 — Continue Watching only. Drawn as a track across the bottom
   *  edge of the poster, same visual language as every other progress bar
   *  in the app (h-1 track + brand-gradient fill). */
  progressPercent?: number;
  /** Exact position for a Continue Watching item, in seconds. */
  resumeSeconds?: number;
  /** Continue Watching only — the episode label ("S2 E5") under the title,
   *  in place of the hover-only year/runtime/genres strip which doesn't
   *  make sense for a specific in-progress episode. */
  subtitle?: string;
  /** A non-owned title gets an add action, never a misleading play icon. */
  inLibrary?: boolean;
  /** `row` owns its editorial carousel width; `fill` lets a catalogue grid
   *  decide the column width while keeping the exact same visual card. */
  layout?: "row" | "fill";
  /** Keeps the title mark clear of an action supplied by the parent card. */
  reserveBottomRight?: boolean;
  /** Present only for a concrete locally available movie or episode. */
  playback?: DashboardCardPlayback;
  /** File facts for the exact item being played, never inferred from TMDb. */
  technical?: DashboardCardTechnical;
  /** Opt-in for non-owned suggestion rows (Recommandé pour vous, Tendances) —
   *  shows a 👎 that hard-excludes this title from future personalized
   *  recommendations (same /api/ai/feedback signal as the AI chat cards)
   *  and removes the card from view immediately. Never set on rows backed
   *  by the user's own library (Continue Watching, Récemment ajouté…) —
   *  disliking a suggestion must never look like it touches ownership. */
  dislikable?: boolean;
}) {
  const { t, locale } = useI18n();
  const { enabled: betaPlayer } = useBetaPlayer();
  const { play } = usePlayer();
  const [hovered, setHovered] = useState(false);
  const [popover, setPopover] = useState<{ left: number; top: number; width: number; above: boolean } | null>(null);
  const [adding, setAdding] = useState(false);
  const [addedHere, setAddedHere] = useState(false);
  const [liked, setLiked] = useState(false);
  const [ratingSaving, setRatingSaving] = useState(false);
  const [dislikeSaving, setDislikeSaving] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const poster = posterPath ? `${POSTER_BASE}${posterPath}` : null;
  const backdrop = backdropPath ? `${BACKDROP_BASE}${backdropPath}` : null;
  const logo = logoPath ? `${LOGO_BASE}${logoPath}` : null;
  const previewImage = backdrop;
  const { data: previewDetail } = useSWR<MetaDetail | null>(
    hovered ? `/api/metadata/detail?type=${type}&tmdbId=${tmdbId}&lang=${locale}` : null,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 5 * 60 * 1000 }
  );
  const previewYear = year ?? previewDetail?.year ?? null;
  const previewRuntime = runtime ?? previewDetail?.runtime ?? null;
  const previewGenres = genres?.length ? genres : (previewDetail?.genres ?? []);
  const hasMeta = !!previewYear || !!previewRuntime || !!technical;
  const showRank = !!rank && rank >= 1 && rank <= 10;

  useEffect(() => setAddedHere(false), [inLibrary, tmdbId, type]);

  const addToLibrary = async () => {
    if (adding || inLibrary || addedHere) return;
    setAdding(true);
    try {
      const endpoint = type === "movie" ? "/api/library/movies" : "/api/library/series";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tmdbId }),
      });
      const body = await response.json().catch(() => null) as { blocked?: boolean } | null;
      if (!response.ok || body?.blocked) throw new Error("add_failed");
      setAddedHere(true);
    } catch {
      toast("error", t("ai.addFailed"));
    } finally {
      setAdding(false);
    }
  };

  const rateFiveStars = async () => {
    if (liked || ratingSaving) return;
    setRatingSaving(true);
    try {
      const response = await fetch("/api/ai/ratings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId, type, title, rating: 5 }),
      });
      if (!response.ok) throw new Error("rating_failed");
      setLiked(true);
    } catch {
      toast("error", t("title.ratingError"));
    } finally {
      setRatingSaving(false);
    }
  };

  const dislike = async () => {
    if (dislikeSaving) return;
    setDislikeSaving(true);
    try {
      const response = await fetch("/api/ai/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId, type, title, liked: false }),
      });
      if (!response.ok) throw new Error("feedback_failed");
      setDismissed(true);
    } catch {
      toast("error", t("title.ratingError"));
    } finally {
      setDislikeSaving(false);
    }
  };

  const startPlayback = (
    event: React.MouseEvent<HTMLButtonElement>,
    options?: { resumeFromSeconds?: number; startFromBeginning?: boolean },
  ) => {
    if (!playback) return;
    event.preventDefault();
    event.stopPropagation();
    play({
      ratingKey: playback.ratingKey,
      movvizId: playback.movvizId,
      seriesId: playback.seriesId,
      plexUrl: playback.plexUrl,
      title,
      useTranscode: betaPlayer,
      tmdbId,
      type: playback.type,
      seasonNumber: playback.seasonNumber,
      episodeNumber: playback.episodeNumber,
      originRect: event.currentTarget.getBoundingClientRect(),
      backdropUrl: backdrop,
      posterUrl: poster,
      resumeFromSeconds: options?.resumeFromSeconds,
      startFromBeginning: options?.startFromBeginning,
    });
  };

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
    // Action row + metadata badges + three genres can be taller than the
    // old single “Informations” line; use the real preview footprint when
    // deciding whether it must grow upward near the bottom of the viewport.
    const estimatedHeight = Math.round(width * 0.5625) + 158;
    const above = rect.top + estimatedHeight > window.innerHeight - 12;
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - width / 2, window.innerWidth - width - 8));
    // Netflix-style: the preview grows from the hovered tile rather than
    // appearing below it as a detached tooltip.
    setPopover({ left, top: above ? rect.bottom + 12 : Math.max(8, rect.top - 12), width, above });
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    // The artwork is already preloaded on the source card; a short intent
    // delay keeps accidental passes from opening the preview without making
    // the logo feel late when the pointer deliberately rests on a tile.
    hoverTimer.current = setTimeout(() => setHovered(true), 240);
  };

  useEffect(() => () => clearTimers(), []);

  if (dismissed) return null;

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
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/78 via-black/10 to-black/0" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/32 via-transparent to-transparent" />
            </>
          ) : poster ? (
            <>
              {/* A title with no landscape artwork must not become an empty
                * card. Keep its real cover legible over a blurred extension
                * rather than cropping a portrait into fake 16:9 artwork. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={poster} alt="" loading="lazy" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-45 blur-xl" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={poster} alt={title} loading="lazy" className="relative z-[1] h-full w-full object-contain drop-shadow-2xl" />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/15" />
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
                <AdaptiveTitleLogo src={logo} className="max-h-10 max-w-[78%] drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]" />
              ) : !titleEmbedded ? (
                <span className="line-clamp-2 text-sm font-black leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">{title}</span>
              ) : null}
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
            <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/8 to-transparent" />
            <div className="absolute inset-x-4 bottom-3 min-w-0">
              {logo ? (
                <AdaptiveTitleLogo src={logo} className="max-h-11 max-w-[210px] drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]" />
              ) : !titleEmbedded ? (
                <span className="line-clamp-2 text-base font-black leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">{title}</span>
              ) : null}
            </div>
          </div>
        </Link>
        <div className="space-y-2.5 p-3.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {playback ? (
                betaPlayer ? (
                  resumeSeconds && resumeSeconds > 0 ? (
                    <>
                      <button
                        type="button"
                        onClick={(event) => startPlayback(event, { resumeFromSeconds: resumeSeconds })}
                        title={`${t("player.betaResumeFrom")} ${formatResumeTime(resumeSeconds)}`}
                        aria-label={`${t("player.betaResumeFrom")} ${formatResumeTime(resumeSeconds)}`}
                        className="flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-black shadow-lg transition-transform duration-150 hover:scale-[1.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow"
                      >
                        <Play className="h-4 w-4 fill-current" />
                        {t("player.betaResumeFrom")} {formatResumeTime(resumeSeconds)}
                      </button>
                      <button
                        type="button"
                        onClick={(event) => startPlayback(event, { startFromBeginning: true })}
                        title={t("player.betaStartOver")}
                        aria-label={t("player.betaStartOver")}
                        className="flex h-10 w-10 items-center justify-center rounded-full border border-white/45 text-white transition-colors hover:border-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow"
                      >
                        <RotateCcw className="h-[18px] w-[18px]" />
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={startPlayback}
                      title={t("common.play")}
                      aria-label={t("common.play")}
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow-lg transition-transform duration-150 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow"
                    >
                      <Play className="ml-0.5 h-5 w-5 fill-current" />
                    </button>
                  )
                ) : (
                  <a
                    href={playback.plexUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => openPlexLink(event, playback.plexUrl)}
                    title={t("library.watchOnPlex")}
                    aria-label={t("library.watchOnPlex")}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-black shadow-lg transition-transform duration-150 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow"
                  >
                    <Play className="ml-0.5 h-5 w-5 fill-current" />
                  </a>
                )
              ) : inLibrary ? (
                <span
                  title={t("common.inLibrary")}
                  aria-label={t("common.inLibrary")}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 text-white/55"
                >
                  <Clock3 className="h-5 w-5" />
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => void addToLibrary()}
                  disabled={adding || addedHere}
                  title={t("common.addToLibrary")}
                  aria-label={t("common.addToLibrary")}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/45 text-white transition-colors hover:border-white hover:bg-white/10 disabled:cursor-default disabled:opacity-90"
                >
                  {adding ? <Loader2 className="h-5 w-5 animate-spin" /> : addedHere ? <Clock3 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                </button>
              )}
              <button
                type="button"
                onClick={() => void rateFiveStars()}
                disabled={ratingSaving}
                title={t("title.rateStars", { n: 5 })}
                aria-label={t("title.rateStars", { n: 5 })}
                className={cn("flex h-10 w-10 items-center justify-center rounded-full border transition-colors disabled:cursor-wait", liked ? "border-amber bg-amber text-black" : "border-white/45 text-white hover:border-white hover:bg-white/10")}
              >
                {ratingSaving ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <ThumbsUp className={cn("h-[18px] w-[18px]", liked && "fill-current")} />}
              </button>
              {dislikable && (
                <button
                  type="button"
                  onClick={() => void dislike()}
                  disabled={dislikeSaving}
                  title={t("ai.feedbackDislike")}
                  aria-label={t("ai.feedbackDislike")}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/45 text-white transition-colors hover:border-white hover:bg-white/10 disabled:cursor-wait"
                >
                  {dislikeSaving ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <ThumbsDown className="h-[18px] w-[18px]" />}
                </button>
              )}
              {popoverActions}
            </div>
            <Link
              href={`/title/${type}/${tmdbId}`}
              title={t("common.open")}
              aria-label={t("common.open")}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/45 text-white transition-colors hover:border-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow"
            >
              <ChevronDown className="h-5 w-5" />
            </Link>
          </div>
          {subtitle && <p className="truncate text-[11px] text-white/70">{subtitle}</p>}
          {hasMeta && (
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-white/85">
              {previewYear && <span className="rounded-full border border-white/30 px-2 py-0.5">{previewYear}</span>}
              {formatRuntime(previewRuntime) && <span className="rounded-full border border-white/30 px-2 py-0.5">{formatRuntime(previewRuntime)}</span>}
              {technical && buildMediaBadgeItems({ ...technical, source: null }, "surface")}
            </div>
          )}
          {previewGenres.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-2 text-[12px] font-semibold text-white/90">
              {previewGenres.slice(0, 3).map((genre, index) => (
                <span key={genre} className="flex items-center gap-x-2">
                  {index > 0 && <span className="text-white/45">•</span>}
                  {genre}
                </span>
              ))}
            </div>
          )}
          {popoverFooter}
        </div>
      </div>, document.body
    )}
    </>
  );
}
