"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useI18n } from "@/i18n/provider";
import { cn, formatDate } from "@/lib/utils";
import { useShouldReduceMotion } from "@/lib/motion/useReduceMotion";
import type { LibrarySeries } from "@/lib/library/types";
import { Star, Tv, Check, Clock, HardDriveDownload, CalendarCheck, Calendar, Loader2, Sparkles } from "lucide-react";
import { MediaBadges, buildMediaBadgeItems, aggregateBadges, BADGE_SHAPE } from "./MediaBadges";

export function LibrarySeriesCard({ series, index = 0, onChange }: { series: LibrarySeries; index?: number; onChange?: () => void }) {
  const { t, locale } = useI18n();
  const reduceMotion = useShouldReduceMotion();
  const [imgLoaded, setImgLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const poster = series.posterPath ? `/tmdb/w500${series.posterPath}` : null;

  const episodes = series.seasons.flatMap((s) => s.episodes);
  const aggregateFile = aggregateBadges(episodes);
  const monitored = episodes.filter((e) => e.monitored);
  const available = monitored.filter((e) => e.status === "available").length;
  const downloading = monitored.filter((e) => e.status === "downloading").length;

  // Un épisode monitoré "à venir" (pas encore diffusé) ne peut pas manquer —
  // il ne compte donc pas contre l'exhaustivité, comme partout ailleurs
  // (seasonStatus, overallSeriesStatus, library/page.tsx).
  const allAvailable = monitored.length > 0 && monitored.every((e) => e.status === "available" || e.status === "upcoming");
  const nothingMonitored = monitored.length === 0;
  const anyBusy = downloading > 0;
  const statusBadge = allAvailable
    ? { icon: Check, cls: "bg-ok text-white", label: t("status.available") }
    : anyBusy
      ? { icon: Loader2, cls: "bg-purple-500 text-white", label: t("status.downloading") }
      : nothingMonitored
        ? null
        : { icon: Clock, cls: "bg-amber text-white", label: t("status.missing") };

  const hasAvailableEpisodes = episodes.some((e) => e.status === "available" && e.monitored && e.file);

  const handleOptimize = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/library/series/${series.id}/optimize`, { method: "POST" });
      if ((await res.json()).ok) onChange?.();
    } finally { setBusy(false); }
  };

  const cascadeAnim = reduceMotion ? {} : {
    layout: true as const,
    initial: { opacity: 0, y: 20, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    exit: { opacity: 0, y: 20, scale: 0.95, transition: { duration: 0.25, ease: "easeInOut" as const } },
    transition: { duration: 0.3, delay: Math.min(index * 0.05, 0.5) },
    whileHover: { scale: 1.06, y: -4, zIndex: 10 },
    whileTap: { scale: 0.98 },
  };
  const btnSpring = reduceMotion ? {} : {
    whileTap: { scale: 0.95 },
    transition: { type: "spring" as const, stiffness: 400, damping: 17 },
  };

  return (
    <motion.div className="group relative block w-full transition-shadow duration-300 hover:shadow-[0_0_32px_rgba(168,130,255,0.22)]" {...cascadeAnim}>
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/5 bg-surface">
        <Link href={`/title/series/${series.tmdbId}`} className="absolute inset-0 block">
          {poster ? (
            <motion.img
              src={poster}
              alt={series.title}
              loading="lazy"
              className="h-full w-full object-cover"
              initial={reduceMotion ? undefined : { opacity: 0 }}
              animate={reduceMotion ? undefined : { opacity: imgLoaded ? 1 : 0 }}
              transition={{ duration: 0.4 }}
              onLoad={() => setImgLoaded(true)}
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
              <Tv className="h-7 w-7 text-ink-soft/70" />
              <span className="line-clamp-3 text-sm font-semibold text-ink/90">{series.title}</span>
            </div>
          )}
        </Link>
        <div className={cn(BADGE_SHAPE, "absolute left-2 top-2 border-white/15 bg-black/55 text-amber")}>
          <Star className="h-3 w-3 fill-amber" /> {series.rating.toFixed(1)}
        </div>
        {statusBadge && (
          <div className={cn(BADGE_SHAPE, "pointer-events-none absolute right-2 top-2 border-white/15", statusBadge.cls)} title={statusBadge.label}>
            <statusBadge.icon className={cn("h-3 w-3", statusBadge.icon === Loader2 && "animate-spin")} />
          </div>
        )}

        {aggregateFile?.resolution && (
          <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 flex items-center gap-1">
            {buildMediaBadgeItems(
              { resolution: aggregateFile.resolution, videoCodec: null, audioCodec: null, hdr: null, source: null, language: null },
              "overlay"
            )}
          </div>
        )}

        <MediaBadges file={aggregateFile} year={series.year} className="absolute bottom-2 left-2 right-2" compactOnMobile hideTypes={["resolution", "year", "hdr"]} />

        {/* Hover action bar — desktop (lg+) */}
        <div className="pointer-events-none absolute inset-0 hidden lg:flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/10 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          {series.genres.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-white/85">
              {series.genres.slice(0, 2).map((g) => (
                <span key={g} className="rounded-full border border-white/20 px-1.5 py-0.5 text-[10px] font-semibold text-white/80">{g}</span>
              ))}
            </div>
          )}
          {hasAvailableEpisodes && (
            <div className="pointer-events-auto flex gap-2">
              <motion.button {...btnSpring} onClick={handleOptimize} disabled={busy} title="Optimiser (rechercher une meilleure version et remplacer)" className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl glass-strong text-xs font-bold text-brand-glow hover:text-ink">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              </motion.button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile actions — one useful tap at a time, same pattern as LibraryMovieCard.
          Hidden on desktop which keeps its full hover row. */}
      <div className="lg:hidden">
        {hasAvailableEpisodes && (
          <div className="mt-1.5">
            <motion.button {...btnSpring} onClick={handleOptimize} disabled={busy} className="flex w-full h-10 items-center justify-center gap-1.5 rounded-xl glass-strong text-xs font-bold text-ink-soft active:bg-white/10">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              {t("library.optimize")}
            </motion.button>
          </div>
        )}
      </div>

      <div className="mt-2.5 px-0.5">
        <Link href={`/title/series/${series.tmdbId}`}>
          <h3 className="truncate text-sm font-semibold text-ink transition-all duration-200 hover:text-brand-glow">{series.title}</h3>
        </Link>
        <div className="mt-1 flex items-center gap-2">
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
            allAvailable
              ? "text-ok bg-ok/12 border-ok/25"
              : downloading > 0
                ? "text-cyan bg-cyan/12 border-cyan/25"
                : "text-amber bg-amber/12 border-amber/25"
          )}>
            {allAvailable ? <Check className="h-2.5 w-2.5" /> : <HardDriveDownload className="h-2.5 w-2.5" />}
            {available}/{monitored.length} {t("common.episodesShort")}
          </span>
          {formatDate(series.releaseDate, locale) && (
            <span className="flex items-center gap-1 text-[10px] text-ink-dim">
              <Calendar className="h-2.5 w-2.5" /> {formatDate(series.releaseDate, locale)}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}