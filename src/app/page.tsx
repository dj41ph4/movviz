"use client";

import "./dashboard-premium.css";

import useSWR from "swr";
import Link from "next/link";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { Reorder } from "framer-motion";
import { DownloadQueue } from "@/components/media/DownloadQueue";
import { UpdateAvailableBanner } from "@/components/system/UpdateAvailableBanner";
import { LibraryMovieCard } from "@/components/library/LibraryMovieCard";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardRows } from "@/components/dashboard/DashboardRows";
import { DashboardSplash } from "@/components/dashboard/DashboardSplash";
import { TmdbImage } from "@/components/media/TmdbImage";
import { setSplashActive } from "@/lib/dashboard/splashCoordinator";
import { PROVIDER_LIGHT_TILE, PROVIDER_SVG } from "@/lib/metadata/providerSvg";
import { CardErrorBoundary } from "@/components/ui/CardErrorBoundary";
import { useTitlePanel } from "@/components/title/useTitlePanel";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { LibraryMovie, LibrarySeries } from "@/lib/library/types";
import type { EngineTorrent } from "@/lib/types";
import type { DashboardInterfaceData, DashboardLibraryMovie, DashboardLibrarySeries, DashboardRecentEpisode } from "@/lib/dashboard/interfaceTypes";
import { useInterfaceDataMode } from "@/lib/settings/useInterfaceDataMode";
import type { DashboardLayout } from "@/lib/dashboard/types";
import { mergeNxDashboardLayout } from "@/lib/dashboard/homeLayout";
import { recentEpisodesAcrossSeries } from "@/lib/library/recentEpisodes";
import { Compass } from "lucide-react";

const SPLASH_SEEN_KEY = "movviz-splash-seen";
const noopSubscribe = () => () => {};


export default function DashboardPage() {
  const t = useT();
  const { optimized, ready: interfaceModeReady } = useInterfaceDataMode();
  const { data: optimizedData, error: optimizedError, mutate: mutateOptimized } = useSWR<DashboardInterfaceData>(
    interfaceModeReady && optimized ? "/api/interface/dashboard" : null,
  );
  const { data: moviesData, error: moviesError, mutate: mutateMovies } = useSWR<{ movies: LibraryMovie[] }>(
    interfaceModeReady && !optimized ? "/api/library/movies" : null
  );
  const { data: seriesData, error: seriesError } = useSWR<{ series: LibrarySeries[] }>(
    interfaceModeReady && !optimized ? "/api/library/series" : null
  );
  const { data: layoutData } = useSWR<{ layout: DashboardLayout }>("/api/dashboard/layout");
  const layout = mergeNxDashboardLayout(layoutData?.layout);
  const { data: torrentsData, error: torrentsError } = useSWR<{ torrents: EngineTorrent[] }>(
    interfaceModeReady && !optimized ? "/api/engine/torrents" : null
  );
  const { titlePanel } = useTitlePanel();
  const { data: providerData } = useSWR<{ tiles: { id: number; name: string; logoPath: string | null }[] }>("/api/metadata/logos?kind=watchProvider");

  const movies: DashboardLibraryMovie[] = optimized ? optimizedData?.movies ?? [] : moviesData?.movies ?? [];
  const series: DashboardLibrarySeries[] = optimized
    ? optimizedData?.series ?? []
    : (seriesData?.series ?? []).map((show) => ({
        id: show.id,
        tmdbId: show.tmdbId,
        title: show.title,
        year: show.year,
        posterPath: show.posterPath,
        backdropPath: show.backdropPath,
        customBackdropPath: show.customBackdropPath ?? null,
        customLogoPath: show.customLogoPath ?? null,
        rating: show.rating,
        genres: show.genres,
        addedAt: show.addedAt,
        hasAvailableEpisode: show.seasons.some((season) => season.episodes.some((episode) => episode.status === "available")),
        availableBySeason: Object.fromEntries(show.seasons.map((season) => [season.seasonNumber, season.episodes.filter((episode) => episode.status === "available" && episode.file).length])),
      }));
  const torrents = torrentsData?.torrents ?? [];
  const compactRecentMovies = optimized
    ? optimizedData?.compactRecentMovies ?? []
    : [...(moviesData?.movies ?? [])].sort((a, b) => b.addedAt - a.addedAt).slice(0, 12);
  const load = () => optimized ? mutateOptimized() : mutateMovies();
  const hasError = optimized ? optimizedError : moviesError || seriesError || torrentsError;
  const loading = !hasError && (!interfaceModeReady || (optimized ? !optimizedData : !moviesData && !seriesData && !torrentsData));

  const recentlyAdded = compactRecentMovies;

  // Legacy mode keeps feature parity with the compact interface payload. It
  // has no prebuilt Plex Web URL, but the direct-player card still receives
  // the concrete episode identity once compact mode is enabled (the default).
  const recentEpisodes: DashboardRecentEpisode[] = optimized
    ? optimizedData?.recentEpisodes ?? []
    : recentEpisodesAcrossSeries((seriesData?.series ?? []).flatMap((show) => show.seasons.flatMap((season) => season.episodes
      .filter((episode) => episode.status === "available" && episode.file)
      .map((episode) => ({
        seriesId: show.id,
        tmdbId: show.tmdbId,
        title: show.title,
        year: show.year,
        posterPath: show.posterPath,
        backdropPath: show.backdropPath,
        customBackdropPath: show.customBackdropPath ?? null,
        customLogoPath: show.customLogoPath ?? null,
        rating: show.rating,
        genres: show.genres,
        seasonNumber: season.seasonNumber,
        episodeNumber: episode.episodeNumber,
        episodeTitle: episode.title,
        addedAt: episode.file!.addedAt,
        plexRatingKey: episode.plexRatingKey,
        file: episode.file,
      })))));


  const progressFor = (movie: LibraryMovie) =>
    movie.activeInfoHash ? torrents.find((tr) => tr.infoHash === movie.activeInfoHash) : null;

  // Splash (cold start, once per session): it may stay as long as needed, but it leaves only when
  // everything visible underneath is ready — data, rows, and every image inside the viewport.
  // State is derived where possible (no synchronous setState inside effects).
  const splashUnseen = useSyncExternalStore(noopSubscribe, () => !sessionStorage.getItem(SPLASH_SEEN_KEY), () => false);
  const [loadingAtMount] = useState(loading);
  const [splashDismissed, setSplashDismissed] = useState(false);
  const showSplash = optimized && splashUnseen && loadingAtMount && !splashDismissed;
  const [splashProgress, setSplashProgress] = useState(14);
  const dismissSplash = useCallback(() => {
    setSplashDismissed(true);
    try { sessionStorage.setItem(SPLASH_SEEN_KEY, "1"); } catch {}
  }, []);
  // Bug fix: WhatsNewModal (mounted in AppShell, no shared parent state with
  // this page) used to appear on top of this splash instead of waiting for
  // it — see splashCoordinator.ts for why a plain prop/context can't cross
  // that boundary here.
  useEffect(() => {
    setSplashActive(showSplash);
    return () => setSplashActive(false);
  }, [showSplash]);
  const richMode = layout.mode === "beta";
  const [rowsReported, setRowsReported] = useState(false);
  const handleRowsReady = useCallback(() => setRowsReported(true), []);
  // No rows to wait for (classic layout or empty library).
  const rowsReady = rowsReported || (!loading && (!richMode || movies.length + series.length === 0));
  const [imagesReady, setImagesReady] = useState(false);
  const splashDone = !loading && rowsReady && imagesReady;
  const splashPct = splashDone ? 100 : splashProgress;

  // Simulated progress while waiting for data, then the real share of visible images.
  useEffect(() => {
    if (!showSplash || !loading && rowsReady) return;
    const id = setInterval(() => setSplashProgress((p) => (p < 70 ? p + Math.random() * 5 + 1 : p)), 300);
    return () => clearInterval(id);
  }, [showSplash, loading, rowsReady]);

  // Every <img> inside the viewport must be decoded (or failed) — twice in a row, since rows keep
  // mounting new images for a moment — plus the web fonts.
  useEffect(() => {
    if (!showSplash || loading || !rowsReady || imagesReady) return;
    let stable = 0;
    let fontsReady = false;
    document.fonts?.ready.then(() => { fontsReady = true; }, () => { fontsReady = true; });
    const id = setInterval(() => {
      const root = document.querySelector(".nx-dashboard-content");
      const visible = root
        ? [...root.querySelectorAll("img")].filter((img) => {
            const r = img.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight && r.right > 0 && r.left < window.innerWidth;
          })
        : [];
      const done = visible.filter((img) => img.complete).length;
      setSplashProgress(70 + Math.round((visible.length ? done / visible.length : 1) * 29));
      stable = done === visible.length && fontsReady ? stable + 1 : 0;
      if (stable >= 2) setImagesReady(true);
    }, 150);
    return () => clearInterval(id);
  }, [showSplash, loading, rowsReady, imagesReady]);

  useEffect(() => {
    if (!showSplash || !splashDone) return;
    const t = setTimeout(dismissSplash, 250);
    return () => clearTimeout(t);
  }, [showSplash, splashDone, dismissSplash]);

  // Safety net: never block the interface indefinitely.
  useEffect(() => {
    if (!showSplash) return;
    const t = setTimeout(dismissSplash, 20000);
    return () => clearTimeout(t);
  }, [showSplash, dismissSplash]);

  // Préchargement Découverte en arrière-plan une fois le dashboard totalement chargé — optimisé uniquement
  useEffect(() => {
    if (!optimized || loading || showSplash) return;
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem("movviz-discover-prefetched")) return;
    const doPrefetch = () => {
      try { sessionStorage.setItem("movviz-discover-prefetched", "1"); } catch {}
      const urls = ["/api/metadata/rows?type=movie", "/api/metadata/rows?type=series"];
      for (const u of urls) fetch(u, { priority: "low" } as RequestInit).catch(() => {});
      // Précharge aussi la route Next pour un clic instantané
      try { (import("next/navigation") as unknown as { prefetch?: (href: string) => void }); } catch {}
    };
    const w = window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(doPrefetch, { timeout: 2500 });
      return () => { try { (window as unknown as { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id); } catch {} };
    }
    const t = setTimeout(doPrefetch, 900);
    return () => clearTimeout(t);
  }, [loading, showSplash, optimized]);

  return (
    <>
      <DashboardSplash show={showSplash} progress={splashPct} />
      <div className="nx-dashboard-content nx-dashboard-premium w-full max-w-[2000px] space-y-8">
      {richMode && (
        <div className="nx-home-hero-grid">
          <CardErrorBoundary>
            <DashboardHero settings={layout.hero} />
          </CardErrorBoundary>
        </div>
      )}

      {richMode && (providerData?.tiles?.length ?? 0) > 0 && (
        <section className="nx-home-providers" aria-label={t("discover.watchProviders")}>
          <div className="mt-2 grid w-full grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
            {providerData!.tiles.slice(0, 8).map((provider) => {
              const localSvg = PROVIDER_SVG[provider.id];
              return (
                <Link data-premium-card key={provider.id} href={`/discover?watchProvider=${provider.id}&watchProviderName=${encodeURIComponent(provider.name)}`} className={cn("nx-provider-tile", localSvg && PROVIDER_LIGHT_TILE.has(provider.id) && "nx-provider-tile-light")} title={provider.name}>
                  {localSvg ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={localSvg} alt={provider.name} className="max-h-[64%] max-w-[84%] object-contain" />
                  ) : provider.logoPath ? (
                    <TmdbImage path={provider.logoPath} size="w154" alt={provider.name} className="max-h-[64%] max-w-[84%] object-contain" />
                  ) : (
                    <span>{provider.name}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/*
        Always full-width right under the hero rows, at every screen size —
        it used to move into a narrow 320px side rail on desktop, which made
        it much harder to read at a glance on a wide screen.
      */}
      {layout.showDownloads && (
        <div className="space-y-6">
          <DownloadQueue />
        </div>
      )}

      {richMode ? (
        !loading && !hasError && movies.length + series.length > 0 && (
          <DashboardRows sections={layout.sections} movies={movies} series={series} recentEpisodes={recentEpisodes} minYear={layout.hero.minYear} onRowsReady={handleRowsReady} />
        )
      ) : (
        <div className="mt-8">
          {loading ? (
            <div className="space-y-3">
              <div className="h-6 w-40 animate-pulse rounded bg-white/10" />
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {[...Array(10)].map((_, i) => (
                  <div key={i} className="aspect-[2/3] animate-pulse rounded-2xl bg-white/10" />
                ))}
              </div>
            </div>
          ) : hasError ? null : movies.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl glass py-20 text-center">
              <Compass className="h-8 w-8 text-brand-glow" />
              <p className="font-semibold text-ink">{t("library.empty")}</p>
              <Link href="/discover" className="rounded-xl brand-gradient px-5 py-2.5 text-sm font-bold text-white">
                {t("discover.title")}
              </Link>
            </div>
          ) : (
            <section>
              <h2 className="mb-3 text-lg font-bold tracking-tight text-ink">{t("dashboard.recentlyAdded")}</h2>
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {recentlyAdded.map((movie, i) => (
                  <LibraryMovieCard key={movie.id} index={i} movie={movie} torrent={progressFor(movie)} onChange={load} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <UpdateAvailableBanner />
      {titlePanel}
    </div>
    </>
  );
}
