"use client";

import { useState } from "react";
import { useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { useShouldReduceMotion } from "@/lib/motion/useReduceMotion";
import type { LibrarySeries } from "@/lib/library/types";
import { Check, HardDriveDownload, Loader2, Sparkles } from "lucide-react";
import { aggregateBadges } from "./MediaBadges";
import { DashboardPosterCard } from "@/components/dashboard/DashboardPosterCard";

export function LibrarySeriesCard({
  series, index = 0, onChange, backdropPath, logoPath, titleEmbedded,
}: {
  series: LibrarySeries;
  index?: number;
  onChange?: () => void;
  /** Resolved by the grid's single batch call (see useTitleArtworkBatch) — never fetched per-card. */
  backdropPath?: string | null;
  logoPath?: string | null;
  titleEmbedded?: boolean;
}) {
  const { t } = useI18n();
  const reduceMotion = useShouldReduceMotion();
  const [busy, setBusy] = useState(false);

  const episodes = series.seasons.flatMap((s) => s.episodes);
  const aggregateFile = aggregateBadges(episodes);
  const monitored = episodes.filter((e) => e.monitored);
  const available = monitored.filter((e) => e.status === "available").length;
  const downloading = monitored.filter((e) => e.status === "downloading").length;

  const allAvailable = monitored.length > 0 && monitored.every((e) => e.status === "available" || e.status === "upcoming");
  const hasAvailableEpisodes = episodes.some((e) => e.status === "available" && e.monitored && e.file);

  const handleOptimize = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/library/series/${series.id}/optimize`, { method: "POST" });
      if ((await res.json()).ok) onChange?.();
    } finally { setBusy(false); }
  };

  const cascadeStyle = reduceMotion ? undefined : ({ "--cascade-delay": `${Math.min(index * 0.05, 0.5)}s` } as React.CSSProperties);

  const episodesPill = (
    <span className={cn(
      "flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-bold",
      allAvailable ? "text-ok bg-ok/12 border-ok/25" : downloading > 0 ? "text-cyan bg-cyan/12 border-cyan/25" : "text-amber bg-amber/12 border-amber/25"
    )}>
      {allAvailable ? <Check className="h-2.5 w-2.5" /> : <HardDriveDownload className="h-2.5 w-2.5" />}
      {available}/{monitored.length} {t("common.episodesShort")}
    </span>
  );

  return (
    <div className={cn("w-full", !reduceMotion && "animate-cascade-in")} style={cascadeStyle}>
      <DashboardPosterCard
        layout="fill"
        tmdbId={series.tmdbId}
        type="series"
        title={series.title}
        posterPath={series.posterPath}
        backdropPath={backdropPath ?? series.backdropPath}
        logoPath={logoPath}
        titleEmbedded={titleEmbedded}
        rating={series.rating}
        year={series.year}
        genres={series.genres}
        badge={episodesPill}
        inLibrary
        technical={aggregateFile ? { resolution: aggregateFile.resolution, videoCodec: aggregateFile.videoCodec, audioCodec: aggregateFile.audioCodec, hdr: aggregateFile.hdr } : undefined}
        popoverActions={
          hasAvailableEpisodes ? (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); void handleOptimize(); }}
              disabled={busy}
              title={t("library.optimize")}
              aria-label={t("library.optimize")}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/45 text-white transition-colors hover:border-white hover:bg-white/10 disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-[18px] w-[18px] animate-spin" /> : <Sparkles className="h-[18px] w-[18px]" />}
            </button>
          ) : undefined
        }
      />
    </div>
  );
}
