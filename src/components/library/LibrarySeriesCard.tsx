"use client";

import Link from "next/link";
import { useI18n } from "@/i18n/provider";
import { cn, formatDate } from "@/lib/utils";
import type { LibrarySeries } from "@/lib/library/types";
import { Star, Tv, Check, Clock, HardDriveDownload, CalendarCheck, Calendar, Loader2 } from "lucide-react";
import { MediaBadges, aggregateBadges } from "./MediaBadges";

export function LibrarySeriesCard({ series }: { series: LibrarySeries }) {
  const { t, locale } = useI18n();
  const poster = series.posterPath ? `https://image.tmdb.org/t/p/w500${series.posterPath}` : null;

  const episodes = series.seasons.flatMap((s) => s.episodes);
  const monitored = episodes.filter((e) => e.monitored);
  const available = monitored.filter((e) => e.status === "available").length;
  const downloading = monitored.filter((e) => e.status === "downloading").length;

  const allAvailable = monitored.length > 0 && available === monitored.length;
  const nothingMonitored = monitored.length === 0;
  const anyBusy = downloading > 0;
  const statusBadge = allAvailable
    ? { icon: Check, cls: "bg-ok/90 text-white", label: t("status.available") }
    : anyBusy
      ? { icon: Loader2, cls: "bg-purple-500/90 text-white", label: t("status.downloading") }
      : nothingMonitored
        ? null
        : { icon: Clock, cls: "bg-amber/80 text-white", label: t("status.missing") };

  return (
    <Link href={`/title/series/${series.tmdbId}`} className="group block w-full">
      <div className="relative aspect-[2/3] overflow-hidden rounded-2xl border border-white/5 bg-surface">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt={series.title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
            <Tv className="h-7 w-7 text-ink-soft/70" />
            <span className="line-clamp-3 text-sm font-semibold text-ink/90">{series.title}</span>
          </div>
        )}
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] font-bold backdrop-blur">
          <Star className="h-3 w-3 fill-amber text-amber" /> {series.rating.toFixed(1)}
        </div>
        {statusBadge && (
          <div className={cn("pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold backdrop-blur", statusBadge.cls)} title={statusBadge.label}>
            <statusBadge.icon className={cn("h-3 w-3", statusBadge.icon === Loader2 && "animate-spin")} />
          </div>
        )}

        <MediaBadges file={aggregateBadges(episodes)} className="absolute bottom-2 left-2 right-2" />
      </div>

      <div className="mt-2.5 px-0.5">
        <h3 className="truncate text-sm font-semibold text-ink">{series.title}</h3>
        <div className="mt-1 flex items-center gap-2">
          <span className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold",
            available === monitored.length && monitored.length > 0
              ? "text-ok bg-ok/12 border-ok/25"
              : downloading > 0
                ? "text-cyan bg-cyan/12 border-cyan/25"
                : "text-amber bg-amber/12 border-amber/25"
          )}>
            {available === monitored.length && monitored.length > 0 ? <Check className="h-2.5 w-2.5" /> : <HardDriveDownload className="h-2.5 w-2.5" />}
            {available}/{monitored.length} {t("common.episodesShort")}
          </span>
          {formatDate(series.releaseDate, locale) && (
            <span className="flex items-center gap-1 text-[10px] text-ink-dim">
              <Calendar className="h-2.5 w-2.5" /> {formatDate(series.releaseDate, locale)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
