"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { Check } from "lucide-react";
import { useI18n } from "@/i18n/provider";
import { PosterRow } from "@/components/media/PosterRow";
import { useTitleArtworkBatch } from "@/components/media/useTitleArtworkBatch";
import { CardErrorBoundary } from "@/components/ui/CardErrorBoundary";
import { formatEpisodeBadge } from "@/components/library/MediaBadges";
import { groupRecentEpisodes } from "@/lib/library/recentEpisodes";
import type { DashboardLibrarySeries, DashboardRecentEpisode } from "@/lib/dashboard/interfaceTypes";
import type { WatchedEpisode } from "@/lib/plex/watchStore";
import { bleachPresentationKey } from "@/lib/metadata/bleachPresentation";
import { BLEACH_TMDB_ID } from "@/lib/metadata/bleachEpisodeOrder";
import { DashboardPosterCard } from "./DashboardPosterCard";

/** The same recent-arrivals shelf on Home and in the Series library. */
export function RecentEpisodesRow({ episodes, series }: {
  episodes: DashboardRecentEpisode[];
  series: DashboardLibrarySeries[];
}) {
  const { t, locale } = useI18n();
  const [extra, setExtra] = useState<DashboardRecentEpisode[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const loading = useRef(false);
  useEffect(() => {
    setExtra([]);
    setCursor(new Set(episodes.map((episode) => `${episode.tmdbId}:${episode.tmdbId === BLEACH_TMDB_ID && episode.seasonNumber === 17 ? "tybw" : "original"}`)).size >= 20 ? 20 : null);
  }, [episodes]);
  const loadMore = useCallback(async () => {
    if (cursor === null || loading.current) return;
    loading.current = true;
    try {
      const response = await fetch(`/api/interface/dashboard?only=recent&cursor=${cursor}`);
      if (!response.ok) return;
      const page = await response.json() as { recentEpisodes?: DashboardRecentEpisode[]; recentEpisodesNextCursor?: number | null };
      setExtra((current) => [...current, ...(page.recentEpisodes ?? [])]);
      setCursor(page.recentEpisodesNextCursor ?? null);
    } finally {
      loading.current = false;
    }
  }, [cursor]);
  const allEpisodes = useMemo(() => [...episodes, ...extra], [episodes, extra]);
  const { data: watchStatus } = useSWR<{ episodes: WatchedEpisode[] }>(allEpisodes.length ? "/api/watch-status" : null);
  const groups = useMemo(() => groupRecentEpisodes(allEpisodes, watchStatus?.episodes ?? [], series), [allEpisodes, watchStatus, series]);
  const refs = useMemo(() => groups.map(({ latest, seriesPart }) => ({ type: "series" as const, tmdbId: latest.tmdbId, seriesPart })), [groups]);
  const artwork = useTitleArtworkBatch(refs, locale);

  if (!groups.length) return null;
  return <PosterRow title={t("dashboard.recentEpisodes")} onNearEnd={loadMore}>
    {groups.map(({ key, latest: episode, seriesPart, grouped, displaySeason, displayEpisode, unwatchedCount, fullyWatched }) => {
      const art = artwork[bleachPresentationKey({ type: "series", tmdbId: episode.tmdbId, seriesPart })];
      const seasonLabel = displaySeason === 0 ? t("title.edit.specials") : `${t("title.season")} ${displaySeason}`;
      // A season card opens the series; a single episode retains its exact
      // playback target and file metadata, without inventing a resume state.
      const playback = !grouped && episode.plexRatingKey && episode.plexUrl ? {
        ratingKey: episode.plexRatingKey, plexUrl: episode.plexUrl,
        seriesId: episode.seriesId, type: "series" as const,
        seasonNumber: episode.seasonNumber, episodeNumber: episode.episodeNumber,
      } : undefined;
      return <CardErrorBoundary key={key}>
        <DashboardPosterCard
          tmdbId={episode.tmdbId}
          type="series"
          seriesPart={seriesPart}
          title={episode.title}
          posterPath={episode.posterPath}
          backdropPath={episode.customBackdropPath ?? art?.backdropPath ?? episode.backdropPath}
          logoPath={episode.customLogoPath ?? art?.logoPath ?? null}
          titleEmbedded={!seriesPart && !episode.customBackdropPath && art?.titleEmbedded === true}
          rating={episode.rating}
          subtitle={grouped ? seasonLabel : `S${displaySeason} · E${displayEpisode} — ${episode.episodeTitle}`}
          episodeBadge={grouped ? seasonLabel : formatEpisodeBadge(displaySeason, displayEpisode)}
          badge={fullyWatched ? <Check className="h-3 w-3" aria-label={t("watch.watched")} /> : unwatchedCount}
          inLibrary
          playback={playback}
          technical={!grouped ? episode.file ?? undefined : undefined}
        />
      </CardErrorBoundary>;
    })}
  </PosterRow>;
}
