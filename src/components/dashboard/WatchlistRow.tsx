"use client";

import { useMemo } from "react";
import { useI18n } from "@/i18n/provider";
import { PosterRow } from "@/components/media/PosterRow";
import { useTitleArtworkBatch } from "@/components/media/useTitleArtworkBatch";
import { CardErrorBoundary } from "@/components/ui/CardErrorBoundary";
import { formatEpisodeBadge } from "@/components/library/MediaBadges";
import { bleachPresentationKey } from "@/lib/metadata/bleachPresentation";
import type { WatchlistItem } from "@/lib/watchlist/types";
import { DashboardPosterCard, type DashboardCardPlayback } from "./DashboardPosterCard";

export function WatchlistRow({ items: source, libraryTitleKeys, moviePlaybackByTmdbId }: { items: WatchlistItem[]; libraryTitleKeys: Set<string>; moviePlaybackByTmdbId?: (type: "movie" | "series", tmdbId: number) => DashboardCardPlayback | undefined }) {
  const { t, locale } = useI18n();
  const items = useMemo(() => [...source].sort((a, b) => b.addedAt - a.addedAt), [source]);
  const refs = useMemo(() => items.map((item) => ({ type: item.type === "movie" ? "movie" as const : "series" as const, tmdbId: item.tmdbId, seriesPart: item.seriesPart })), [items]);
  const artwork = useTitleArtworkBatch(refs, locale);
  if (!items.length) return null;
  return <PosterRow title={t("watchlist.title")}>
    {items.map((item) => {
      const type = item.type === "movie" ? "movie" : "series";
      const art = artwork[bleachPresentationKey({ type, tmdbId: item.tmdbId, seriesPart: item.seriesPart })];
      return <CardErrorBoundary key={`${item.type}:${item.tmdbId}:${item.seriesPart ?? ""}:${item.seasonNumber ?? ""}:${item.episodeNumber ?? ""}`}>
        <DashboardPosterCard
          tmdbId={item.tmdbId} type={type} seriesPart={item.seriesPart}
          title={item.type === "episode" ? item.parentTitle ?? item.title : item.title}
          posterPath={item.posterPath} backdropPath={art?.backdropPath} logoPath={art?.logoPath}
          titleEmbedded={art?.titleEmbedded} year={item.year} rating={item.rating}
          episodeBadge={item.type === "episode" && item.seasonNumber != null && item.episodeNumber != null ? formatEpisodeBadge(item.seasonNumber, item.episodeNumber) : undefined}
          inLibrary={libraryTitleKeys.has(`${type}:${item.tmdbId}`)}
          playback={!item.seriesPart ? moviePlaybackByTmdbId?.(type, item.tmdbId) : undefined}
        />
      </CardErrorBoundary>;
    })}
  </PosterRow>;
}
