"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Info, Play, Pause, Plus, Loader2, Check } from "lucide-react";
import { HeroSlideshow } from "./HeroSlideshow";
import { TrailerHeader } from "@/components/media/TrailerHeader";
import { MediaBadges } from "@/components/library/MediaBadges";
import { useT, useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { HeroSlide } from "@/lib/dashboard/suggestionEngine";
import type { DashboardHeroSettings } from "@/lib/dashboard/types";

type HeroApiSlide = HeroSlide & { plexUrl: string | null };

const POSTER_BASE = "https://image.tmdb.org/t/p/w1280";

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
  const [manuallyPaused, setManuallyPaused] = useState(false);
  const [showReasons, setShowReasons] = useState(false);
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<Set<number>>(new Set());

  const active = slides[Math.min(index, slides.length - 1)];
  const activeReasons = useMemo(() => active?.score.reasons.filter((r) => r.matched) ?? [], [active]);

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

  if (!settings.enabled || slides.length === 0 || !active) return null;

  const backdropUrl = active.detail.backdropPath ? `${POSTER_BASE}${active.detail.backdropPath}` : null;
  const trailerEnabled = settings.trailerAutoplay || settings.playOnHover;
  const trailerTrigger = settings.trailerAutoplay ? "immediate" : "hover";

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
          backdropUrl={backdropUrl}
          trailerKey={active.detail.trailerKey}
          title={active.detail.title}
          trigger={trailerTrigger}
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

          <h2 className="max-w-2xl text-2xl font-black tracking-tight text-white drop-shadow-lg sm:text-4xl">
            {active.detail.title}
          </h2>

          <div className="flex flex-wrap items-center gap-2 text-sm text-white/80">
            {active.detail.year && <span>{active.detail.year}</span>}
            {active.detail.runtime && <span>{active.detail.runtime} min</span>}
            {active.detail.rating > 0 && <span>★ {active.detail.rating.toFixed(1)}</span>}
            {active.detail.genres.slice(0, 3).map((g) => (
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
              <a
                href={active.plexUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded-xl bg-white/15 px-4 py-2.5 text-sm font-bold text-white backdrop-blur transition-transform hover:scale-105"
              >
                <Play className="h-4 w-4" /> {t("library.watchOnPlex")}
              </a>
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
