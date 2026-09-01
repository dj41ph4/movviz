"use client";

import useSWR from "swr";
import { useMemo } from "react";
import { PosterRow } from "@/components/media/PosterRow";
import { DashboardPosterCard, type DashboardCardPlayback } from "@/components/dashboard/DashboardPosterCard";
import { useI18n, useT } from "@/i18n/provider";
import { useTitleArtworkBatch, type TitleArtworkRef } from "@/components/media/useTitleArtworkBatch";
import type { DashboardInterfaceData, DashboardLibraryMovie, DashboardLibrarySeries } from "@/lib/dashboard/interfaceTypes";
import type { MetaSearchResult } from "@/lib/metadata/types";
import type { OnDeckEntry } from "@/app/api/plex/on-deck/route";
import type { DashboardLayout } from "@/lib/dashboard/types";
import { formatEpisodeBadge } from "@/components/library/MediaBadges";

type MediaType = "movie" | "series";
type LibraryItem = DashboardLibraryMovie | DashboardLibrarySeries;

/**
 * Plex-style editorial shelf, but deliberately closed over the local Movviz
 * library. Recommendations help rank the catalogue; they never smuggle an
 * external title into Films/Séries, where users expect every card to exist.
 */
export function LibraryRecommendedRows({ type }: { type: MediaType }) {
  const t = useT();
  const { locale } = useI18n();
  const { data: dashboard } = useSWR<DashboardInterfaceData>("/api/interface/dashboard");
  const { data: recommendations } = useSWR<{ results: MetaSearchResult[] }>(`/api/metadata/recommendations?type=${type}`);
  const { data: onDeck } = useSWR<{ items: OnDeckEntry[] }>("/api/plex/on-deck");
  // "Année minimale des carrousels" (Réglages → Accueil) — reported live as
  // not respected here: this row wasn't reading the setting at all, unlike
  // every discovery carousel on the Home dashboard (DashboardRows.tsx's own
  // afterMinYear). Same field, same semantics ("Minimum release year for the
  // discovery carousels" — dashboard/types.ts), just never wired into this
  // component.
  const { data: layoutData } = useSWR<{ layout: DashboardLayout }>("/api/dashboard/layout");
  const minYear = layoutData?.layout.hero.minYear;
  const afterMinYear = useMemo(
    () => (minYear ? (item: { year: number | null }) => (item.year ?? 0) >= minYear : () => true),
    [minYear]
  );

  const items = useMemo<LibraryItem[]>(() => {
    const source = type === "movie" ? dashboard?.movies ?? [] : dashboard?.series ?? [];
    return source
      .filter((item) => type === "movie"
        ? (item as DashboardLibraryMovie).status === "available"
        : (item as DashboardLibrarySeries).hasAvailableEpisode)
      .filter(afterMinYear);
  }, [dashboard, type, afterMinYear]);
  const byTmdbId = useMemo(() => new Map(items.map((item) => [item.tmdbId, item])), [items]);
  const localRecommendations = useMemo(() => (recommendations?.results ?? [])
    .map((result) => byTmdbId.get(result.tmdbId))
    .filter((item): item is LibraryItem => !!item)
    .slice(0, 20), [recommendations, byTmdbId]);
  const bestRated = useMemo(() => [...items].sort((a, b) => b.rating - a.rating).slice(0, 20), [items]);
  const recentlyAdded = useMemo(() => [...items].sort((a, b) => b.addedAt - a.addedAt).slice(0, 20), [items]);
  const leadingGenres = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => item.genres.forEach((genre) => counts.set(genre, (counts.get(genre) ?? 0) + 1)));
    return [...counts.entries()].filter(([, count]) => count >= 4).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([genre]) => genre);
  }, [items]);
  const continueWatching = useMemo(() => (onDeck?.items ?? []).filter((item) => (type === "movie" ? item.type === "movie" : item.type !== "movie") && byTmdbId.has(item.tmdbId)), [onDeck, type, byTmdbId]);
  const recentEpisodes = type === "series" ? dashboard?.recentEpisodes ?? [] : [];
  // Resolve the artwork for just the cards we are about to display.  This is
  // one bounded batch, never a request per card and never the whole 2,500+
  // title library on first paint.
  // Confirmed live: Reprendre and Épisodes récemment ajoutés cards showed
  // no logo at all — these two rows' tmdbIds were never included in this
  // batch, so `artwork[...]?.logoPath` was always empty for them (their
  // JSX below only ever tried customLogoPath, unlike every other row's
  // card() helper).
  const artworkRefs = useMemo<TitleArtworkRef[]>(() => {
    const selected = new Map<number, LibraryItem>();
    [...localRecommendations, ...recentlyAdded, ...bestRated].forEach((item) => selected.set(item.tmdbId, item));
    leadingGenres.forEach((genre) => items.filter((item) => item.genres.includes(genre)).slice(0, 20).forEach((item) => selected.set(item.tmdbId, item)));
    const refs = [...selected.values()].map((item) => ({ type, tmdbId: item.tmdbId }));
    continueWatching.forEach((entry) => refs.push({ type, tmdbId: entry.tmdbId }));
    if (type === "series") recentEpisodes.forEach((episode) => refs.push({ type: "series", tmdbId: episode.tmdbId }));
    return refs;
  }, [type, localRecommendations, recentlyAdded, bestRated, leadingGenres, items, continueWatching, recentEpisodes]);
  const artwork = useTitleArtworkBatch(artworkRefs, locale);

  const moviePlayback = (item: LibraryItem): DashboardCardPlayback | undefined => {
    if (type !== "movie") return undefined;
    const movie = item as DashboardLibraryMovie;
    return movie.plexRatingKey && movie.plexUrl ? { ratingKey: movie.plexRatingKey, plexUrl: movie.plexUrl, movvizId: movie.id, type: "movie" } : undefined;
  };
  const card = (item: LibraryItem) => (
    <DashboardPosterCard
      key={item.id}
      tmdbId={item.tmdbId}
      type={type}
      title={item.title}
      posterPath={item.posterPath}
      backdropPath={item.customBackdropPath ?? artwork[`${type}:${item.tmdbId}`]?.backdropPath ?? item.backdropPath}
      logoPath={item.customLogoPath ?? artwork[`${type}:${item.tmdbId}`]?.logoPath ?? null}
      rating={item.rating}
      year={item.year}
      runtime={type === "movie" ? (item as DashboardLibraryMovie).runtime : undefined}
      genres={item.genres}
      inLibrary
      playback={moviePlayback(item)}
    />
  );

  if (!dashboard) return <div className="h-44 animate-pulse rounded-2xl bg-white/5" />;
  if (items.length === 0) return <p className="rounded-2xl glass p-6 text-sm text-ink-dim">{t("library.empty")}</p>;

  return (
    <div className="space-y-8">
      {continueWatching.length > 0 && <PosterRow title={t("dashboard.continueWatching")}>
        {continueWatching.map((entry) => {
          const item = byTmdbId.get(entry.tmdbId)!;
          const playback = entry.plexRatingKey && entry.plexUrl ? {
            ratingKey: entry.plexRatingKey, plexUrl: entry.plexUrl, movvizId: entry.movvizId, seriesId: entry.seriesId,
            type, seasonNumber: entry.seasonNumber, episodeNumber: entry.episodeNumber,
          } satisfies DashboardCardPlayback : undefined;
          const hasEpisodeNumbers = entry.type === "episode" && typeof entry.seasonNumber === "number" && typeof entry.episodeNumber === "number";
          return <DashboardPosterCard key={`${entry.type}:${entry.plexRatingKey}`} tmdbId={item.tmdbId} type={type} title={item.title} posterPath={item.posterPath} backdropPath={item.customBackdropPath ?? item.backdropPath} logoPath={item.customLogoPath ?? artwork[`${type}:${item.tmdbId}`]?.logoPath ?? null} rating={item.rating} subtitle={entry.type === "episode" ? `S${entry.seasonNumber} · E${entry.episodeNumber} — ${entry.episodeTitle}` : undefined} episodeBadge={hasEpisodeNumbers ? formatEpisodeBadge(entry.seasonNumber!, entry.episodeNumber!) : undefined} progressPercent={entry.progressPercent} resumeSeconds={entry.offsetMs / 1000} inLibrary playback={playback} />;
        })}
      </PosterRow>}
      {type === "series" && recentEpisodes.length > 0 && <PosterRow title={t("dashboard.recentEpisodes")}>
        {recentEpisodes.map((episode) => {
          const playback = episode.plexRatingKey && episode.plexUrl ? {
            ratingKey: episode.plexRatingKey,
            plexUrl: episode.plexUrl,
            seriesId: episode.seriesId,
            type: "series" as const,
            seasonNumber: episode.seasonNumber,
            episodeNumber: episode.episodeNumber,
          } satisfies DashboardCardPlayback : undefined;
          return <DashboardPosterCard key={`${episode.seriesId}:${episode.seasonNumber}:${episode.episodeNumber}`} tmdbId={episode.tmdbId} type="series" title={episode.title} posterPath={episode.posterPath} backdropPath={episode.customBackdropPath ?? episode.backdropPath} logoPath={episode.customLogoPath ?? artwork[`series:${episode.tmdbId}`]?.logoPath ?? null} rating={episode.rating} subtitle={`S${episode.seasonNumber} · E${episode.episodeNumber} — ${episode.episodeTitle}`} episodeBadge={formatEpisodeBadge(episode.seasonNumber, episode.episodeNumber)} inLibrary technical={episode.file ?? undefined} playback={playback} />;
        })}
      </PosterRow>}
      {localRecommendations.length > 0 && <PosterRow title={t("dashboard.rowRecommended")}>{localRecommendations.map(card)}</PosterRow>}
      <PosterRow title={t("dashboard.recentlyAdded")}>{recentlyAdded.map(card)}</PosterRow>
      <PosterRow title={t("discover.rowTopRated")}>{bestRated.map(card)}</PosterRow>
      {leadingGenres.map((genre) => {
        const matching = items.filter((item) => item.genres.includes(genre)).sort((a, b) => b.rating - a.rating).slice(0, 20);
        return matching.length > 0 ? <PosterRow key={genre} title={`${t("library.moreOf")} ${genre}`}>{matching.map(card)}</PosterRow> : null;
      })}
    </div>
  );
}
