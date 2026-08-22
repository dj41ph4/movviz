"use client";

import useSWR from "swr";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { PosterRow } from "@/components/media/PosterRow";
import { DashboardPosterCard, type DashboardCardPlayback } from "./DashboardPosterCard";
import { CardErrorBoundary } from "@/components/ui/CardErrorBoundary";
import { useI18n, useT } from "@/i18n/provider";
import { daysUntil } from "@/lib/library/releaseSchedule";
import type { LibraryMovie, LibrarySeries } from "@/lib/library/types";
import type { MetaSearchResult } from "@/lib/metadata/types";
import type { DashboardSectionId, DashboardLayout } from "@/lib/dashboard/types";
import type { OnDeckEntry } from "@/app/api/plex/on-deck/route";

interface UpgradeCandidate {
  movieId: string;
  title: string;
  detectedVersion: string;
}

type EditorialLibraryItem =
  | { type: "movie"; item: DashboardMovie }
  | { type: "series"; item: LibrarySeries };

type ArtworkByKey = Record<string, {
  backdropPath: string | null;
  logoPath: string | null;
  titleEmbedded: boolean;
}>;
type LocalArtwork = {
  /** The library's normal TMDb backdrop, useful before the artwork batch lands. */
  backdropPath: string | null;
  /** A deliberate user artwork override: it must always beat the TMDb cache. */
  customBackdropPath: string | null;
  logoPath: string | null;
};
type ResolvedArtwork = Pick<LocalArtwork, "backdropPath" | "logoPath"> & { titleEmbedded: boolean };
type DashboardMovie = LibraryMovie & { plexUrl?: string | null };

function moviePlayback(movie: DashboardMovie): DashboardCardPlayback | undefined {
  if (movie.status !== "available" || !movie.file || !movie.plexRatingKey || !movie.plexUrl) return undefined;
  return {
    ratingKey: movie.plexRatingKey,
    plexUrl: movie.plexUrl,
    movvizId: movie.id,
    type: "movie",
  };
}

/** Keep a mixed home row genuinely mixed without inventing a second ranking:
 * both source lists retain their own order and alternate while either has
 * items left. */
function interleave<T>(first: T[], second: T[]): T[] {
  const mixed: T[] = [];
  const total = Math.max(first.length, second.length);
  for (let index = 0; index < total; index++) {
    if (first[index]) mixed.push(first[index]);
    if (second[index]) mixed.push(second[index]);
  }
  return mixed;
}

/**
 * The editorial carousels below the Hero — each one gated by the matching entry in
 * `layout.sections` (same `DashboardSectionId`s defined in LOT5.1), so
 * hiding a row in Réglages (LOT5.6) doesn't need a second toggle system.
 * Reuses `findUpgradeCandidates`/`getRecommendations` verbatim via their
 * existing API routes — no second scoring/search engine.
 */
export function DashboardRows({
  sections,
  movies,
  series,
  minYear,
}: {
  sections: DashboardLayout["sections"];
  movies: DashboardMovie[];
  series: LibrarySeries[];
  minYear?: number | null;
}) {
  const t = useT();
  const { locale } = useI18n();
  const router = useRouter();
  const visible = useMemo(() => new Set(sections.filter((s) => s.visible).map((s) => s.id)), [sections]);
  const afterMinYear = useMemo(
    () => (minYear ? (r: { year?: number | null }) => (r.year ?? 0) >= minYear : () => true),
    [minYear]
  );

  const { data: rowsData } = useSWR<{ rows: { key: string; results: MetaSearchResult[] }[] }>(
    visible.has("discover") ? "/api/metadata/rows?type=movie" : null
  );
  const { data: seriesRowsData } = useSWR<{ rows: { key: string; results: MetaSearchResult[] }[] }>(
    visible.has("discover") ? "/api/metadata/rows?type=series" : null
  );
  const { data: recData } = useSWR<{ results: MetaSearchResult[] }>(
    visible.has("becauseYouLike") ? "/api/metadata/recommendations?type=movie" : null
  );
  const { data: seriesRecData } = useSWR<{ results: MetaSearchResult[] }>(
    visible.has("becauseYouLike") ? "/api/metadata/recommendations?type=series" : null
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

  const movieTrending = (rowsData?.rows.find((r) => r.key === "trendingPopular" || r.key === "trending")?.results ?? []).filter(afterMinYear);
  const seriesTrending = (seriesRowsData?.rows.find((r) => r.key === "trendingPopular" || r.key === "trending")?.results ?? []).filter(afterMinYear);
  const trending = interleave(movieTrending, seriesTrending).slice(0, 10);
  const recommended = interleave(
    (recData?.results ?? []).filter(afterMinYear),
    (seriesRecData?.results ?? []).filter(afterMinYear)
  );

  const recentlyAdded = useMemo(
    () => {
      const availableMovies: EditorialLibraryItem[] = movies
        .filter((m) => m.status === "available" && afterMinYear(m))
        .map((item) => ({ type: "movie", item }));
      const availableSeries: EditorialLibraryItem[] = series
        .filter((s) => s.seasons.some((season) => season.episodes.some((episode) => episode.status === "available")) && afterMinYear(s))
        .map((item) => ({ type: "series", item }));
      return [...availableMovies, ...availableSeries]
        .sort((a, b) => b.item.addedAt - a.item.addedAt)
        .slice(0, 20);
    },
    [movies, series, afterMinYear]
  );

  // Netflix's "short on time" idea, grounded in Movviz data rather than an
  // invented runtime: only files that are actually available and whose movie
  // runtime is known make the row. Series are intentionally excluded until
  // episode duration is part of their persisted library model.
  const shortSessions = useMemo(
    () => movies
      .filter((movie) => movie.status === "available" && movie.runtime !== null && movie.runtime <= 40 && afterMinYear(movie))
      .sort((a, b) => b.addedAt - a.addedAt)
      .slice(0, 20),
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
      .filter((x): x is { candidate: UpgradeCandidate; movie: DashboardMovie } => !!x.movie && afterMinYear(x.movie));
  }, [upgradeData, movies, afterMinYear]);

  // The only per-title artwork data not carried by row APIs is the official
  // TMDb logo. Gather all currently visible rows first, then resolve them in
  // one bounded request; cards themselves never issue network requests.
  const localArtwork = useMemo(() => {
    const artwork = new Map<string, LocalArtwork>();
    for (const movie of movies) {
      artwork.set(`movie:${movie.tmdbId}`, {
        backdropPath: movie.backdropPath,
        customBackdropPath: movie.customBackdropPath ?? null,
        logoPath: movie.customLogoPath ?? null,
      });
    }
    for (const show of series) {
      artwork.set(`series:${show.tmdbId}`, {
        backdropPath: show.backdropPath,
        customBackdropPath: show.customBackdropPath ?? null,
        logoPath: show.customLogoPath ?? null,
      });
    }
    return artwork;
  }, [movies, series]);

  const libraryTitleKeys = useMemo(() => new Set([
    ...movies.map((movie) => `movie:${movie.tmdbId}`),
    ...series.map((show) => `series:${show.tmdbId}`),
  ]), [movies, series]);

  const artworkRefs = useMemo(() => {
    const refs = new Map<string, { type: "movie" | "series"; tmdbId: number }>();
    const add = (type: "movie" | "series", tmdbId: number) => {
      const key = `${type}:${tmdbId}`;
      // Skip TMDb only if the user explicitly supplied both parts. Otherwise
      // the row gets its horizontal TMDb backdrop + official logo pair.
      const local = localArtwork.get(key);
      if (!local?.customBackdropPath || !local.logoPath) refs.set(key, { type, tmdbId });
    };

    if (visible.has("continueWatching")) {
      continueWatching.forEach((item) => add(item.type === "movie" ? "movie" : "series", item.tmdbId));
    }
    if (visible.has("becauseYouLike")) recommended.forEach((item) => add(item.type, item.tmdbId));
    if (visible.has("shortSessions")) shortSessions.forEach((item) => add("movie", item.tmdbId));
    if (visible.has("discover")) trending.forEach((item) => add(item.type, item.tmdbId));
    if (visible.has("availableNow")) recentlyAdded.forEach(({ type, item }) => add(type, item.tmdbId));
    if (visible.has("comingSoon")) upcoming.forEach(({ m }) => add("movie", m.tmdbId));
    if (visible.has("upgradesAvailable")) upgrades.forEach(({ movie }) => add("movie", movie.tmdbId));

    return [...refs.values()].slice(0, 160);
  }, [visible, continueWatching, recommended, shortSessions, trending, recentlyAdded, upcoming, upgrades, localArtwork]);

  const artworkRequest = useMemo(() => {
    if (artworkRefs.length === 0) return null;
    const items = artworkRefs.map(({ type, tmdbId }) => `${type}:${tmdbId}`).join(",");
    return `/api/metadata/images/batch?items=${encodeURIComponent(items)}&locale=${encodeURIComponent(locale)}`;
  }, [artworkRefs, locale]);
  const { data: artworkData } = useSWR<{ artwork: ArtworkByKey }>(artworkRequest);

  const resolveArtwork = (type: "movie" | "series", tmdbId: number, fallbackBackdrop?: string | null): ResolvedArtwork => {
    const key = `${type}:${tmdbId}`;
    const local = localArtwork.get(key);
    return {
      // Every editorial card gets a true TMDb backdrop. A user-selected
      // Movviz backdrop remains the explicit choice and always wins; the
      // library/row path is only the instant first-paint fallback.
      backdropPath: local?.customBackdropPath ?? artworkData?.artwork[key]?.backdropPath ?? local?.backdropPath ?? fallbackBackdrop ?? null,
      logoPath: local?.logoPath ?? artworkData?.artwork[key]?.logoPath ?? null,
      titleEmbedded: !local?.customBackdropPath && artworkData?.artwork[key]?.titleEmbedded === true,
    };
  };

  const sectionOrder: DashboardSectionId[] = ["continueWatching", "becauseYouLike", "shortSessions", "discover", "availableNow", "comingSoon", "upgradesAvailable"];

  return (
    <div className="space-y-8">
      {sectionOrder.map((id) => {
        if (!visible.has(id)) return null;

        if (id === "continueWatching" && continueWatching.length > 0) {
          return (
            <PosterRow key={id} title={t("dashboard.continueWatching")}>
              {continueWatching.map((item, i) => {
                const type = item.type === "movie" ? "movie" : "series";
                const artwork = resolveArtwork(type, item.tmdbId);
                const playback = item.plexRatingKey && item.plexUrl
                  ? {
                      ratingKey: item.plexRatingKey,
                      plexUrl: item.plexUrl,
                      movvizId: item.movvizId,
                      seriesId: item.seriesId,
                      type,
                      seasonNumber: item.seasonNumber,
                      episodeNumber: item.episodeNumber,
                    } satisfies DashboardCardPlayback
                  : undefined;
                return (
                  <CardErrorBoundary key={`${item.type}:${item.tmdbId}:${i}`}>
                    <DashboardPosterCard
                      tmdbId={item.tmdbId}
                      type={type}
                      title={item.title}
                      posterPath={item.posterPath}
                      backdropPath={artwork.backdropPath}
                      logoPath={artwork.logoPath}
                      titleEmbedded={artwork.titleEmbedded}
                      rating={item.rating}
                      year={item.year ?? undefined}
                      progressPercent={item.progressPercent}
                      subtitle={item.type === "episode" ? `S${item.seasonNumber} E${item.episodeNumber} — ${item.episodeTitle}` : undefined}
                      inLibrary={libraryTitleKeys.has(`${type}:${item.tmdbId}`)}
                      playback={playback}
                    />
                  </CardErrorBoundary>
                );
              })}
            </PosterRow>
          );
        }

        if (id === "becauseYouLike" && recommended.length > 0) {
          return (
            <PosterRow key={id} title={t("dashboard.rowRecommended")} onSeeAll={() => router.push("/discover?type=movie&row=recommendedTop")}>
              {recommended.map((r) => {
                const artwork = resolveArtwork(r.type, r.tmdbId, r.backdropPath);
                return (
                  <CardErrorBoundary key={`${r.type}:${r.tmdbId}`}>
                    <DashboardPosterCard tmdbId={r.tmdbId} type={r.type} title={r.title} posterPath={r.posterPath} backdropPath={artwork.backdropPath} logoPath={artwork.logoPath} titleEmbedded={artwork.titleEmbedded} rating={r.rating} year={r.year} inLibrary={libraryTitleKeys.has(`${r.type}:${r.tmdbId}`)} />
                  </CardErrorBoundary>
                );
              })}
            </PosterRow>
          );
        }

        if (id === "shortSessions" && shortSessions.length > 0) {
          return (
            <PosterRow key={id} title={t("dashboard.shortSessions")}>
              {shortSessions.map((movie) => {
                const artwork = resolveArtwork("movie", movie.tmdbId, movie.backdropPath);
                return (
                  <CardErrorBoundary key={movie.id}>
                    <DashboardPosterCard
                      tmdbId={movie.tmdbId}
                      type="movie"
                      title={movie.title}
                      posterPath={movie.posterPath}
                      backdropPath={artwork.backdropPath}
                      logoPath={artwork.logoPath}
                      titleEmbedded={artwork.titleEmbedded}
                      rating={movie.rating}
                      year={movie.year}
                      runtime={movie.runtime}
                      genres={movie.genres}
                      inLibrary={true}
                      playback={moviePlayback(movie)}
                    />
                  </CardErrorBoundary>
                );
              })}
            </PosterRow>
          );
        }

        if (id === "availableNow" && recentlyAdded.length > 0) {
          return (
            <PosterRow key={id} title={t("dashboard.recentlyAdded")} onSeeAll={() => router.push("/library?filter=available&sort=recent")}>
              {recentlyAdded.map(({ type, item }) => {
                const artwork = resolveArtwork(type, item.tmdbId, item.backdropPath);
                return (
                  <CardErrorBoundary key={`${type}:${item.id}`}>
                    <DashboardPosterCard
                      tmdbId={item.tmdbId}
                      type={type}
                      title={item.title}
                      posterPath={item.posterPath}
                      backdropPath={artwork.backdropPath}
                      logoPath={artwork.logoPath}
                      titleEmbedded={artwork.titleEmbedded}
                      rating={item.rating}
                      year={item.year}
                      runtime={type === "movie" ? item.runtime : undefined}
                      genres={item.genres}
                      inLibrary={true}
                      playback={type === "movie" ? moviePlayback(item) : undefined}
                    />
                  </CardErrorBoundary>
                );
              })}
            </PosterRow>
          );
        }

        if (id === "comingSoon" && upcoming.length > 0) {
          return (
            <PosterRow key={id} title={t("dashboard.rowUpcoming")} onSeeAll={() => router.push("/library?filter=upcoming")}>
              {upcoming.map(({ m, days }) => {
                const artwork = resolveArtwork("movie", m.tmdbId, m.backdropPath);
                return (
                  <CardErrorBoundary key={m.id}>
                    <DashboardPosterCard
                      tmdbId={m.tmdbId}
                      type="movie"
                      title={m.title}
                      posterPath={m.posterPath}
                      backdropPath={artwork.backdropPath}
                      logoPath={artwork.logoPath}
                      titleEmbedded={artwork.titleEmbedded}
                      badge={days <= 1 ? t("dashboard.hero.inOneDay") : t("dashboard.hero.inDays", { n: days })}
                      year={m.year}
                      runtime={m.runtime}
                      genres={m.genres}
                      inLibrary={true}
                    />
                  </CardErrorBoundary>
                );
              })}
            </PosterRow>
          );
        }

        // A single technical upgrade rendered as a lone landscape card leaves
        // an otherwise editorial home shelf visibly empty. Keep this shelf
        // for a real selection; the one-off optimisation remains accessible
        // from the existing library/quality workflow.
        if (id === "upgradesAvailable" && upgrades.length > 1) {
          return (
            <PosterRow key={id} title={t("dashboard.upgradesAvailable")}>
              {upgrades.map(({ candidate, movie }) => {
                const artwork = resolveArtwork("movie", movie.tmdbId, movie.backdropPath);
                return (
                  <CardErrorBoundary key={candidate.movieId}>
                    <DashboardPosterCard
                      tmdbId={movie.tmdbId}
                      type="movie"
                      title={movie.title}
                      posterPath={movie.posterPath}
                      backdropPath={artwork.backdropPath}
                      logoPath={artwork.logoPath}
                      titleEmbedded={artwork.titleEmbedded}
                      badge={candidate.detectedVersion}
                      year={movie.year}
                      runtime={movie.runtime}
                      genres={movie.genres}
                      inLibrary={true}
                      playback={moviePlayback(movie)}
                    />
                  </CardErrorBoundary>
                );
              })}
            </PosterRow>
          );
        }

        if (id === "discover" && trending.length > 0) {
          return (
            <PosterRow key={id} title={t("dashboard.rowTrending")} onSeeAll={() => router.push("/discover?type=movie&row=trendingPopular")}>
              {trending.map((r, i) => {
                const artwork = resolveArtwork(r.type, r.tmdbId, r.backdropPath);
                return (
                  <CardErrorBoundary key={`${r.type}:${r.tmdbId}`}>
                    <DashboardPosterCard tmdbId={r.tmdbId} type={r.type} title={r.title} posterPath={r.posterPath} backdropPath={artwork.backdropPath} logoPath={artwork.logoPath} titleEmbedded={artwork.titleEmbedded} rating={r.rating} year={r.year} rank={i + 1} inLibrary={libraryTitleKeys.has(`${r.type}:${r.tmdbId}`)} />
                  </CardErrorBoundary>
                );
              })}
            </PosterRow>
          );
        }

        return null;
      })}
    </div>
  );
}
