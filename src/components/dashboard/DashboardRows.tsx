"use client";

import useSWR from "swr";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { PosterRow } from "@/components/media/PosterRow";
import { DashboardPosterCard } from "./DashboardPosterCard";
import { CardErrorBoundary } from "@/components/ui/CardErrorBoundary";
import { useT } from "@/i18n/provider";
import { daysUntil } from "@/lib/library/releaseSchedule";
import type { LibraryMovie } from "@/lib/library/types";
import type { MetaSearchResult } from "@/lib/metadata/types";
import type { DashboardSectionId, DashboardLayout } from "@/lib/dashboard/types";
import type { OnDeckEntry } from "@/app/api/plex/on-deck/route";

interface UpgradeCandidate {
  movieId: string;
  title: string;
  detectedVersion: string;
}

/**
 * The 5 carousels below the Hero — each one gated by the matching entry in
 * `layout.sections` (same `DashboardSectionId`s defined in LOT5.1), so
 * hiding a row in Réglages (LOT5.6) doesn't need a second toggle system.
 * Reuses `findUpgradeCandidates`/`getRecommendations` verbatim via their
 * existing API routes — no second scoring/search engine.
 */
export function DashboardRows({ sections, movies, minYear }: { sections: DashboardLayout["sections"]; movies: LibraryMovie[]; minYear?: number | null }) {
  const t = useT();
  const router = useRouter();
  const visible = useMemo(() => new Set(sections.filter((s) => s.visible).map((s) => s.id)), [sections]);
  const afterMinYear = useMemo(
    () => (minYear ? (r: { year?: number | null }) => (r.year ?? 0) >= minYear : () => true),
    [minYear]
  );

  const { data: rowsData } = useSWR<{ rows: { key: string; results: MetaSearchResult[] }[] }>(
    visible.has("discover") ? "/api/metadata/rows?type=movie" : null
  );
  const { data: recData } = useSWR<{ results: MetaSearchResult[] }>(
    visible.has("becauseYouLike") ? "/api/metadata/recommendations?type=movie" : null
  );
  // Reflects Plex's own "on deck" state, which Movviz's own player also
  // reports into (see /api/stream/[ratingKey]/progress) — one row, one
  // source of truth, rather than a separate localStorage-only list that
  // could disagree with what Plex itself shows. Revalidates on focus like
  // every other row here (default SWR behavior) so resuming a title in
  // another tab updates this one without a manual refresh.
  const { data: onDeckData } = useSWR<{ items: OnDeckEntry[] }>(
    visible.has("continueWatching") ? "/api/plex/on-deck" : null
  );
  const continueWatching = onDeckData?.items ?? [];
  // Reglages > Qualité toggle, off by default disables ONLY this scan —
  // separate from dashboardUpgradeScanEnabled's sibling autoUpgradeEnabled
  // (background re-grab job), unaffected either way. Rarely changes, so a
  // long dedupingInterval keeps this from adding its own request on every
  // dashboard mount.
  const { data: releaseRules } = useSWR<{ dashboardUpgradeScanEnabled?: boolean }>(
    visible.has("upgradesAvailable") ? "/api/settings/release-rules" : null,
    { revalidateOnFocus: false, dedupingInterval: 10 * 60 * 1000 }
  );
  const dashboardScanEnabled = releaseRules !== undefined && releaseRules.dashboardUpgradeScanEnabled !== false;
  // Without `liveSearch=0` this endpoint runs a real multi-minute scan (up
  // to 25 movies + 25 episodes falling back to live indexer searches) —
  // confirmed live, that eager per-mount cost alone could run past a
  // minute and hit the reverse proxy's own timeout. The dashboard row only
  // ever needs the cheap cache-only pass (the manual "Rechercher et
  // remplacer" panel is where the full live-search behavior belongs — a
  // user consciously clicking it expects to wait). Never revalidate on
  // focus, unlike every other row here; the server-side cache in the route
  // also bounds the cost of whatever revalidations do happen.
  const { data: upgradeData } = useSWR<{ candidates: UpgradeCandidate[] }>(
    visible.has("upgradesAvailable") && dashboardScanEnabled ? "/api/library/upgrade-candidates?liveSearch=0" : null,
    { revalidateOnFocus: false, dedupingInterval: 10 * 60 * 1000 }
  );

  const trending = (rowsData?.rows.find((r) => r.key === "trendingPopular" || r.key === "trending")?.results ?? []).filter(afterMinYear).slice(0, 10);
  const recommended = (recData?.results ?? []).filter(afterMinYear);

  const recentlyAdded = useMemo(
    () => [...movies].filter((m) => m.status === "available" && afterMinYear(m)).sort((a, b) => b.addedAt - a.addedAt).slice(0, 20),
    [movies, afterMinYear]
  );

  const upcoming = useMemo(
    () =>
      movies
        .filter((m) => m.status === "upcoming" && afterMinYear(m))
        .map((m) => ({ m, days: daysUntil(m.vfReleaseDate ?? m.releaseDate) }))
        .filter((x): x is { m: LibraryMovie; days: number } => x.days !== null)
        .sort((a, b) => a.days - b.days)
        .slice(0, 20),
    [movies, afterMinYear]
  );

  const upgrades = useMemo(() => {
    if (!upgradeData?.candidates.length) return [];
    const byId = new Map(movies.map((m) => [m.id, m] as const));
    return upgradeData.candidates
      .map((c) => ({ candidate: c, movie: byId.get(c.movieId) }))
      .filter((x): x is { candidate: UpgradeCandidate; movie: LibraryMovie } => !!x.movie && afterMinYear(x.movie));
  }, [upgradeData, movies, afterMinYear]);

  const sectionOrder: DashboardSectionId[] = ["discover", "continueWatching", "becauseYouLike", "availableNow", "comingSoon", "upgradesAvailable"];

  return (
    <div className="space-y-8">
      {sectionOrder.map((id) => {
        if (!visible.has(id)) return null;

        if (id === "continueWatching" && continueWatching.length > 0) {
          return (
            <PosterRow key={id} title={t("dashboard.continueWatching")}>
              {continueWatching.map((item, i) => (
                <CardErrorBoundary key={`${item.type}:${item.tmdbId}:${i}`}>
                  <DashboardPosterCard
                    tmdbId={item.tmdbId}
                    type={item.type === "movie" ? "movie" : "series"}
                    title={item.title}
                    posterPath={item.posterPath}
                    rating={item.rating}
                    year={item.year ?? undefined}
                    progressPercent={item.progressPercent}
                    subtitle={item.type === "episode" ? `S${item.seasonNumber} E${item.episodeNumber} — ${item.episodeTitle}` : undefined}
                  />
                </CardErrorBoundary>
              ))}
            </PosterRow>
          );
        }

        if (id === "becauseYouLike" && recommended.length > 0) {
          return (
            <PosterRow key={id} title={t("dashboard.rowRecommended")} onSeeAll={() => router.push("/discover?type=movie&row=recommendedTop")}>
              {recommended.map((r) => (
                <CardErrorBoundary key={`${r.type}:${r.tmdbId}`}>
                  <DashboardPosterCard tmdbId={r.tmdbId} type={r.type} title={r.title} posterPath={r.posterPath} rating={r.rating} year={r.year} />
                </CardErrorBoundary>
              ))}
            </PosterRow>
          );
        }

        if (id === "availableNow" && recentlyAdded.length > 0) {
          return (
            <PosterRow key={id} title={t("dashboard.recentlyAdded")} onSeeAll={() => router.push("/library?filter=available&sort=recent")}>
              {recentlyAdded.map((m) => (
                <CardErrorBoundary key={m.id}>
                  <DashboardPosterCard tmdbId={m.tmdbId} type="movie" title={m.title} posterPath={m.posterPath} rating={m.rating} year={m.year} runtime={m.runtime} genres={m.genres} />
                </CardErrorBoundary>
              ))}
            </PosterRow>
          );
        }

        if (id === "comingSoon" && upcoming.length > 0) {
          return (
            <PosterRow key={id} title={t("dashboard.rowUpcoming")} onSeeAll={() => router.push("/library?filter=upcoming")}>
              {upcoming.map(({ m, days }) => (
                <CardErrorBoundary key={m.id}>
                  <DashboardPosterCard
                    tmdbId={m.tmdbId}
                    type="movie"
                    title={m.title}
                    posterPath={m.posterPath}
                    badge={days <= 1 ? t("dashboard.hero.inOneDay") : t("dashboard.hero.inDays", { n: days })}
                    year={m.year}
                    runtime={m.runtime}
                    genres={m.genres}
                  />
                </CardErrorBoundary>
              ))}
            </PosterRow>
          );
        }

        if (id === "upgradesAvailable" && upgrades.length > 0) {
          return (
            <PosterRow key={id} title={t("dashboard.upgradesAvailable")}>
              {upgrades.map(({ candidate, movie }) => (
                <CardErrorBoundary key={candidate.movieId}>
                  <DashboardPosterCard
                    tmdbId={movie.tmdbId}
                    type="movie"
                    title={movie.title}
                    posterPath={movie.posterPath}
                    badge={candidate.detectedVersion}
                    year={movie.year}
                    runtime={movie.runtime}
                    genres={movie.genres}
                  />
                </CardErrorBoundary>
              ))}
            </PosterRow>
          );
        }

        if (id === "discover" && trending.length > 0) {
          return (
            <PosterRow key={id} title={t("dashboard.rowTrending")} onSeeAll={() => router.push("/discover?type=movie&row=trendingPopular")}>
              {trending.map((r, i) => (
                <CardErrorBoundary key={`${r.type}:${r.tmdbId}`}>
                  <DashboardPosterCard tmdbId={r.tmdbId} type={r.type} title={r.title} posterPath={r.posterPath} rating={r.rating} year={r.year} rank={i + 1} />
                </CardErrorBoundary>
              ))}
            </PosterRow>
          );
        }

        return null;
      })}
    </div>
  );
}
