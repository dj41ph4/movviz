"use client";

import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Info, Play, Pause, Plus, Loader2, Check, ThumbsDown } from "lucide-react";
import { HeroSlideshow } from "./HeroSlideshow";
import { TrailerHeader } from "@/components/media/TrailerHeader";
import { TitleMark } from "@/components/media/TitleMark";
import { MediaBadges } from "@/components/library/MediaBadges";
import { useT, useI18n } from "@/i18n/provider";
import { cn, openPlexLink } from "@/lib/utils";
import type { HeroSlide } from "@/lib/dashboard/suggestionEngine";
import type { DashboardHeroSettings } from "@/lib/dashboard/types";
import { useBetaPlayer } from "@/lib/settings/useBetaPlayer";
import { usePlayer } from "@/lib/player/PlayerProvider";
import { usePlayLabel } from "@/lib/player/usePlayLabel";
import { useTmdbImageUrl } from "@/lib/settings/useTmdbImageUrl";
import { useTrailerSources } from "@/lib/trailers/useTrailerSources";

type HeroApiSlide = HeroSlide & { plexUrl: string | null; plexRatingKey: string | null };

// The featured slide is a deterministic ranking over data that barely moves
// day to day (library/watch/request state) — with no anchoring, every fresh
// page load just restarts at index 0 and shows the same top-ranked title
// again, so in practice it never visibly changes across separate visits (the
// in-page auto-rotation only advances while the tab stays open, which rarely
// happens for 3h straight). Anchoring the starting index to a wall-clock
// time bucket makes it stable within a window but genuinely advance to the
// next candidate once that window has passed, regardless of session length.
const ROTATION_PERIOD_MS = 3 * 60 * 60 * 1000;

function reasonLabel(t: ReturnType<typeof useT>, reason: HeroSlide["score"]["reasons"][number]): string {
  if (reason.key === "genreMatch" && reason.params?.genres) {
    return t("dashboard.hero.reasons.genreMatchWithNames", { genres: reason.params.genres });
  }
  return t(`dashboard.hero.reasons.${reason.key}`);
}

export function DashboardHero({ settings }: { settings: DashboardHeroSettings }) {
  const t = useT();
  const { locale } = useI18n();
  const { data } = useSWR<{ slides: HeroApiSlide[] }>(settings.enabled ? `/api/dashboard/hero?locale=${locale}` : null);
  const slides = data?.slides ?? [];

  const [index, setIndex] = useState(0);
  const [anchored, setAnchored] = useState(false);
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [showReasons, setShowReasons] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<Set<number>>(new Set());

  // Runs once per mount, as soon as the slide count is known — not on every
  // SWR revalidation, so it never yanks the user back to a different slide
  // mid-visit after they've navigated manually.
  useEffect(() => {
    if (anchored || slides.length === 0) return;
    setIndex(Math.floor(Date.now() / ROTATION_PERIOD_MS) % slides.length);
    setAnchored(true);
  }, [anchored, slides.length]);

  const active = slides[Math.min(index, slides.length - 1)];
  // Defensive, not decorative: a slide missing `score` or `detail.genres`
  // (stale cached payload from before a schema change, or a real API gap
  // for some edge-case title) used to throw here — since this runs inside
  // CardErrorBoundary, that silently blanked the whole hero, not just this
  // one field, for as long as that slide stayed the featured one.
  const activeReasons = useMemo(() => active?.score?.reasons?.filter((r) => r.matched) ?? [], [active]);
  const { enabled: betaPlayer } = useBetaPlayer();
  const { play } = usePlayer();
  const { label: playLabel } = usePlayLabel(active?.plexRatingKey);

  const addActiveToLibrary = async () => {
    if (!active) return;
    setAdding(true);
    try {
      const endpoint = active.detail.type === "movie" ? "/api/library/movies" : "/api/library/series";
      await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tmdbId: active.detail.tmdbId }) });
      setAdded((prev) => new Set(prev).add(active.detail.tmdbId));
    } finally {
      setAdding(false);
    }
  };

  const [dislikingGenre, setDislikingGenre] = useState(false);
  const [dislikedGenre, setDislikedGenre] = useState(false);
  useEffect(() => setDislikedGenre(false), [active?.detail.tmdbId]);
  const dislikeGenre = async () => {
    if (!active || dislikingGenre || dislikedGenre) return;
    setDislikingGenre(true);
    try {
      const genres = (active.detail.genres ?? []).slice(0, 3).join(", ");
      await fetch("/api/ai/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tmdbId: active.detail.tmdbId, type: active.detail.type, title: active.detail.title, liked: false, reason: genres || undefined }),
      });
      setDislikedGenre(true);
      setIndex((i) => (i + 1) % slides.length);
    } finally {
      setDislikingGenre(false);
    }
  };

  // A landscape backdrop, cropped down to a narrow portrait phone screen,
  // tends to lose the actual subject (framed for a wide 16:9 composition).
  // Poster art is already composed portrait — a dedicated mobile source, not
  // just a smaller version of the desktop crop, same idea confirmed live on
  // Netflix's own mobile hero.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    setIsMobile(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const { path: heroBackdropPath, size: heroBackdropSize } =
    isMobile && active?.detail.posterPath
      ? { path: active.detail.posterPath, size: "w780" as const }
      : { path: active?.detail.backdropPath ?? null, size: "w1280" as const };
  // Only needed for play()'s backdropUrl (Tier 3, no fallback — see
  // useTmdbImageUrl's doc comment); TrailerHeader below resolves its own
  // CDN-vs-local (with fallback) directly from heroBackdropPath/Size.
  // Both hooks below must run on every render regardless of `active` (Rules
  // of Hooks) — confirmed live: the early `if (!active) return null` used to
  // sit BEFORE these two calls, which crashed the whole hero with "Rendered
  // more hooks than during the previous render" the moment a render without
  // an active slide was followed by one with — now they always run, using
  // `active?.` so a still-loading/empty slide list just resolves to
  // null/no-op inputs instead of skipping the hook call itself.
  const backdropUrl = useTmdbImageUrl(heroBackdropPath, heroBackdropSize);
  const enhancedTrailerSources = useTrailerSources(
    active?.detail.type ?? "movie",
    active?.detail.tmdbId ?? null,
    active?.detail.title ?? null,
    active?.detail.originalTitle,
    active?.detail.year ?? null,
    active?.detail.imdbId ?? null
  );
  const trailerEnabled = settings.trailerAutoplay;

  if (!settings.enabled || slides.length === 0 || !active) return null;

  const statusLabel =
    active.libraryStatus === "available"
      ? t("dashboard.hero.available")
      : active.daysUntilRelease === 1
        ? t("dashboard.hero.inOneDay")
        : active.daysUntilRelease !== null
          ? t("dashboard.hero.inDays", { n: active.daysUntilRelease })
          : active.libraryStatus === "upcoming"
            ? t("dashboard.hero.upcoming")
            : t("dashboard.hero.discovery");

  return (
    <HeroSlideshow
      count={slides.length}
      index={index}
      onIndexChange={setIndex}
      intervalMs={settings.slideshowSpeedSec * 1000}
      paused={manuallyPaused}
      className="-mx-4 mb-8 overflow-hidden rounded-none sm:mx-0 sm:rounded-3xl"
    >
      <div className="relative h-[52vh] min-h-[320px] w-full sm:h-[62vh] sm:min-h-[420px]">
        <TrailerHeader
          backdropPath={heroBackdropPath}
          size={heroBackdropSize}
          trailerKeys={active.detail.ambientVideoKeys}
          enhancedSources={enhancedTrailerSources}
          title={active.detail.title}
          trigger="immediate"
          enabled={trailerEnabled}
          className="absolute inset-0 h-full w-full"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/95 via-black/45 to-black/10" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/70 via-transparent to-transparent" />

        {active.libraryFile && (
          <div className="pointer-events-none absolute right-3 top-3 z-10 origin-top-right scale-90 opacity-80 sm:right-6 sm:top-6">
            <MediaBadges file={active.libraryFile} variant="overlay" />
          </div>
        )}

        <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-4 sm:p-10">
          <span className="w-fit rounded-full bg-black/40 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur">
            {statusLabel}
          </span>

          <TitleMark
            key={`${active.detail.type}:${active.detail.tmdbId}`}
            tmdbId={active.detail.tmdbId}
            type={active.detail.type}
            title={active.detail.title}
            locale={locale}
          />

          <div className="flex flex-wrap items-center gap-2 text-sm text-white/80">
            {active.detail.year && <span>{active.detail.year}</span>}
            {active.detail.runtime && <span>{active.detail.runtime} min</span>}
            {active.detail.rating > 0 && <span>★ {active.detail.rating.toFixed(1)}</span>}
            {(active.detail.genres ?? []).slice(0, 3).map((g) => (
              <span key={g} className="rounded-full border border-white/20 px-2 py-0.5 text-xs">{g}</span>
            ))}
          </div>

          <p className="line-clamp-2 max-w-xl text-sm text-white/70 sm:line-clamp-3">{active.detail.overview}</p>

          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Link
              href={`/title/${active.detail.type}/${active.detail.tmdbId}`}
              className="flex items-center gap-1.5 rounded-xl brand-gradient px-4 py-2.5 text-sm font-bold text-white transition-transform hover:scale-105"
            >
              <Info className="h-4 w-4" /> {t("dashboard.hero.moreInfo")}
            </Link>

            {active.plexUrl ? (
              betaPlayer && active.plexRatingKey ? (
                <button
                  type="button"
                  onClick={(e) => play({
                    ratingKey: active.plexRatingKey!,
                    plexUrl: active.plexUrl!,
                    title: active.detail.title,
                    useTranscode: betaPlayer,
                    tmdbId: active.detail.tmdbId,
                    type: active.detail.type,
                    originRect: e.currentTarget.getBoundingClientRect(),
                    backdropUrl,
                  })}
                  className="flex items-center gap-1.5 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-bold text-white backdrop-blur transition-transform hover:scale-105"
                >
                  <Play className="h-4 w-4" /> {playLabel}
                </button>
              ) : (
                <a
                  href={active.plexUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(e) => openPlexLink(e, active.plexUrl!)}
                  className="flex items-center gap-1.5 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-bold text-white backdrop-blur transition-transform hover:scale-105"
                >
                  <Play className="h-4 w-4" /> {t("library.watchOnPlex")}
                </a>
              )
            ) : !active.libraryStatus ? (
              <button
                type="button"
                onClick={addActiveToLibrary}
                disabled={adding || added.has(active.detail.tmdbId)}
                className="flex items-center gap-1.5 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-bold text-white backdrop-blur transition-transform hover:scale-105 disabled:opacity-60"
              >
                {added.has(active.detail.tmdbId) ? (
                  <Check className="h-4 w-4" />
                ) : adding ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {added.has(active.detail.tmdbId) ? t("discover.added") : t("discover.addToLibrary")}
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => setShowReasons((v) => !v)}
              className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white/80 backdrop-blur transition-transform hover:scale-105"
            >
              {t("dashboard.hero.whyThisTitle")}
            </button>

            <button
              type="button"
              onClick={dislikeGenre}
              disabled={dislikingGenre || dislikedGenre}
              title="Moins de ce genre"
              className="flex items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2.5 text-xs font-semibold text-white/80 backdrop-blur transition-transform hover:scale-105 disabled:opacity-60"
            >
              {dislikingGenre ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ThumbsDown className="h-3.5 w-3.5" />}
              {dislikedGenre ? "Pris en compte" : "Moins de ce genre"}
            </button>

            {slides.length > 1 && (
              <button
                type="button"
                onClick={() => setManuallyPaused((v) => !v)}
                aria-label={manuallyPaused ? t("dashboard.hero.play") : t("dashboard.hero.pause")}
                className="ml-auto flex h-10 w-10 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition-transform hover:scale-110"
              >
                {manuallyPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </button>
            )}
          </div>

          {showReasons && activeReasons.length > 0 && (
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {activeReasons.map((r) => (
                <li
                  key={r.key}
                  className={cn("rounded-full border border-white/15 bg-black/30 px-2.5 py-1 text-xs text-white/80")}
                >
                  {reasonLabel(t, r)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </HeroSlideshow>
  );
}
