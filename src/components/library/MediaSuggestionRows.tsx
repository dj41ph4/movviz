"use client";

import useSWR from "swr";
import { useMemo } from "react";
import { PosterRow } from "@/components/media/PosterRow";
import { DashboardPosterCard } from "@/components/dashboard/DashboardPosterCard";
import { CardErrorBoundary } from "@/components/ui/CardErrorBoundary";
import { useI18n, useT } from "@/i18n/provider";
import { useTitleArtworkBatch, type TitleArtworkRef } from "@/components/media/useTitleArtworkBatch";
import type { DashboardInterfaceData } from "@/lib/dashboard/interfaceTypes";
import type { MetaSearchResult } from "@/lib/metadata/types";

type MediaType = "movie" | "series";
type EditorialRow = { key: string; results: MetaSearchResult[]; meta?: { providerName?: string } };

function rowTitle(key: string, type: MediaType, t: ReturnType<typeof useT>, providerName?: string): string {
  if (key === "recommendedTop" || key.startsWith("because")) return t("dashboard.rowRecommended");
  if (key === "trendingPopular" || key === "trending") return t("dashboard.rowTrending");
  if (key === "upcoming" || key === "upcomingVod") return t("dashboard.rowUpcoming");
  if (key.startsWith("provider")) return providerName ?? t("discover.watchProviders");
  return type === "movie" ? t("common.movies") : t("common.series");
}

/**
 * Films and Series are editorial recommendation destinations. The local
 * library lives behind their explicit Library button; it is never mixed into
 * these shelves, so every visible card is a real suggestion that can be
 * added, excluded or opened in the shared title panel.
 */
export function MediaSuggestionRows({ type }: { type: MediaType }) {
  const t = useT();
  const { locale } = useI18n();
  const { data: rowsData } = useSWR<{ configured?: boolean; rows: EditorialRow[] }>(`/api/metadata/rows?type=${type}`);
  const { data: dashboard } = useSWR<DashboardInterfaceData>("/api/interface/dashboard");

  const rows = useMemo(() => (rowsData?.rows ?? []).filter((row) => row.results.length > 0), [rowsData]);
  const libraryIds = useMemo(() => new Set(
    type === "movie" ? (dashboard?.movies ?? []).map((item) => item.tmdbId) : (dashboard?.series ?? []).map((item) => item.tmdbId)
  ), [dashboard, type]);
  const artworkRefs = useMemo<TitleArtworkRef[]>(() => {
    const seen = new Set<number>();
    return rows.flatMap((row) => row.results.slice(0, 20)).filter((item) => {
      if (seen.has(item.tmdbId)) return false;
      seen.add(item.tmdbId);
      return true;
    }).map((item) => ({ type, tmdbId: item.tmdbId }));
  }, [rows, type]);
  const artwork = useTitleArtworkBatch(artworkRefs, locale);

  if (!rowsData) return <div className="h-52 animate-pulse rounded-xl border border-brand/20 bg-surface/45" />;
  if (rows.length === 0) return <p className="rounded-xl border border-brand/20 bg-surface/45 p-6 text-sm text-ink-dim">{t("library.empty")}</p>;

  return (
    <div className="space-y-8">
      {rows.map((row) => (
        <PosterRow key={row.key} title={rowTitle(row.key, type, t, row.meta?.providerName)}>
          {row.results.slice(0, 20).map((item) => {
            const resolved = artwork[`${type}:${item.tmdbId}`];
            return (
              <CardErrorBoundary key={item.tmdbId}>
                <DashboardPosterCard
                  tmdbId={item.tmdbId}
                  type={type}
                  title={item.title}
                  posterPath={item.posterPath}
                  backdropPath={resolved?.backdropPath ?? item.backdropPath}
                  logoPath={resolved?.logoPath ?? null}
                  titleEmbedded={resolved?.titleEmbedded}
                  rating={item.rating}
                  year={item.year}
                  inLibrary={libraryIds.has(item.tmdbId)}
                />
              </CardErrorBoundary>
            );
          })}
        </PosterRow>
      ))}
    </div>
  );
}
