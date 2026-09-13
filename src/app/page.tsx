"use client";

import useSWR from "swr";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Reorder } from "framer-motion";
import { StatTile } from "@/components/ui/StatTile";
import { DownloadQueue } from "@/components/media/DownloadQueue";
import { UpdateAvailableBanner } from "@/components/system/UpdateAvailableBanner";
import { LibraryMovieCard } from "@/components/library/LibraryMovieCard";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardContinuePanel } from "@/components/dashboard/DashboardContinuePanel";
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
import { DASHBOARD_WIDGET_IDS, DEFAULT_DASHBOARD_LAYOUT, type DashboardWidgetId, type DashboardLayout } from "@/lib/dashboard/types";
import {
  Film, Tv, HardDriveDownload, Download, Search as SearchIcon, Clock, Compass, ListVideo, AlertCircle,
  Pencil, Check, Plus, X, type LucideIcon,
} from "lucide-react";

const WIDGET_ICONS: Record<DashboardWidgetId, LucideIcon> = {
  movies: Film,
  series: Tv,
  episodes: ListVideo,
  missingEpisodes: AlertCircle,
  available: HardDriveDownload,
  downloading: Download,
  searching: SearchIcon,
  missing: Clock,
  episodesAvailable: ListVideo,
};

const WIDGET_ACCENTS: Record<DashboardWidgetId, "brand" | "cyan" | "magenta" | "ok" | "amber"> = {
  movies: "brand",
  series: "magenta",
  episodes: "cyan",
  missingEpisodes: "amber",
  available: "ok",
  downloading: "cyan",
  searching: "amber",
  missing: "amber",
  episodesAvailable: "ok",
};

const TILE_CLASS = "w-[calc(50%-0.5rem)] sm:w-[calc(33.333%-0.667rem)] lg:w-[calc(25%-0.75rem)]";

// The NX desktop home has one deliberate editorial composition.  Historical
// user widget layouts remain on disk for backwards compatibility, but no
// longer alter what is shown here.
const FIXED_NX_DASHBOARD_LAYOUT: DashboardLayout = {
  ...DEFAULT_DASHBOARD_LAYOUT,
  mode: "cinema",
  showStats: true,
  showDownloads: false,
  widgets: [...DASHBOARD_WIDGET_IDS],
};

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
  const layout = FIXED_NX_DASHBOARD_LAYOUT;
  const { data: torrentsData, error: torrentsError } = useSWR<{ torrents: EngineTorrent[] }>(
    interfaceModeReady && (!optimized || layout.mode === "compact") ? "/api/engine/torrents" : null
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
      }));
  const torrents = torrentsData?.torrents ?? [];
  const compactRecentMovies = optimized
    ? optimizedData?.compactRecentMovies ?? []
    : [...(moviesData?.movies ?? [])].sort((a, b) => b.addedAt - a.addedAt).slice(0, 12);
  const load = () => optimized ? mutateOptimized() : mutateMovies();
  const hasError = optimized ? optimizedError : moviesError || seriesError || torrentsError;
  const loading = !hasError && (!interfaceModeReady || (optimized ? !optimizedData : !moviesData && !seriesData && !torrentsData));

  const available = movies.filter((m) => m.status === "available");
  // "searching" (actively looking for a release, no torrent grabbed yet) no
  // longer counts as "downloading" — confirmed live: the "En téléchargement"
  // tile showed 9 while zero torrents were actually active, because a whole
  // season stuck in "searching" with activeInfoHash: null was counted as if
  // it were downloading. It gets its own tile below instead of vanishing.
  const downloadingMovies = movies.filter((m) => m.status === "downloading");
  const searchingMovies = movies.filter((m) => m.status === "searching");
  const missing = movies.filter((m) => m.status === "missing");
  const recentlyAdded = compactRecentMovies;

  // Legacy mode keeps feature parity with the compact interface payload. It
  // has no prebuilt Plex Web URL, but the direct-player card still receives
  // the concrete episode identity once compact mode is enabled (the default).
  const recentEpisodes: DashboardRecentEpisode[] = optimized
    ? optimizedData?.recentEpisodes ?? []
    : (seriesData?.series ?? []).flatMap((show) => show.seasons.flatMap((season) => season.episodes
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
      }))))
      .sort((a, b) => b.addedAt - a.addedAt)
      .slice(0, 24);

  const legacySeries = seriesData?.series ?? [];
  const monitoredEpisodes = legacySeries.flatMap((s) => s.seasons.flatMap((se) => se.episodes)).filter((e) => e.monitored);
  const availableEpisodes = monitoredEpisodes.filter((e) => e.status === "available");
  const downloadingEpisodes = monitoredEpisodes.filter((e) => e.status === "downloading");
  const searchingEpisodes = monitoredEpisodes.filter((e) => e.status === "searching");
  const missingEpisodes = monitoredEpisodes.filter((e) => e.status === "missing");

  const progressFor = (movie: LibraryMovie) =>
    movie.activeInfoHash ? torrents.find((tr) => tr.infoHash === movie.activeInfoHash) : null;

  const legacyWidgetValues: Record<DashboardWidgetId, number> = {
    movies: movies.length,
    series: series.length,
    episodes: monitoredEpisodes.length,
    missingEpisodes: missingEpisodes.length,
    available: available.length + availableEpisodes.length,
    downloading: downloadingMovies.length + downloadingEpisodes.length,
    searching: searchingMovies.length + searchingEpisodes.length,
    missing: missing.length,
    episodesAvailable: availableEpisodes.length,
  };
  const widgetValues = optimized ? optimizedData?.widgetValues ?? legacyWidgetValues : legacyWidgetValues;

  const widgetLabels: Record<DashboardWidgetId, string> = {
    movies: t("dashboard.stats.movies"),
    series: t("dashboard.stats.series"),
    episodes: t("dashboard.stats.episodes"),
    missingEpisodes: t("dashboard.stats.missingEpisodes"),
    available: t("status.available"),
    downloading: t("dashboard.stats.downloading"),
    searching: t("dashboard.stats.searching"),
    missing: t("status.missing"),
    episodesAvailable: t("dashboard.stats.episodesAvailable"),
  };

  const order = FIXED_NX_DASHBOARD_LAYOUT.widgets;
  const [showSplash, setShowSplash] = useState(false);
  const [splashProgress, setSplashProgress] = useState(14);
  // Bug fix: WhatsNewModal (mounted in AppShell, no shared parent state with
  // this page) used to appear on top of this splash instead of waiting for
  // it — see splashCoordinator.ts for why a plain prop/context can't cross
  // that boundary here.
  useEffect(() => {
    setSplashActive(showSplash);
    return () => setSplashActive(false);
  }, [showSplash]);
  const [rowsReady, setRowsReady] = useState(false);
  const [imagesReady, setImagesReady] = useState(false);
  const handleRowsReady = useCallback(() => setRowsReady(true), []);

  // Splash cold-start uniquement en optimisé (compatibilité va disparaître) : plein centre Movviz haute qualité, jamais à chaque clic/SWR
  useEffect(() => {
    if (!optimized) return;
    if (typeof window === "undefined") return;
    const seen = sessionStorage.getItem("movviz-splash-seen");
    if (!seen && loading) {
      setShowSplash(true);
      setSplashProgress(14);
      setRowsReady(false);
      setImagesReady(false);
    }
  }, [loading, optimized]);

  useEffect(() => {
    if (!showSplash) return;
    if (loading || !rowsReady) {
      const id = setInterval(() => setSplashProgress((p) => (p < 82 ? p + Math.random() * 5 + 1 : p)), 300);
      return () => clearInterval(id);
    }
    if (!imagesReady) {
      const id = setInterval(() => setSplashProgress((p) => (p < 92 ? p + 0.6 : p)), 400);
      return () => clearInterval(id);
    }
    // loading + rows + images → 100 puis fade
    setSplashProgress(100);
    const t = setTimeout(() => {
      setShowSplash(false);
      try { sessionStorage.setItem("movviz-splash-seen", "1"); } catch {}
    }, 520);
    return () => clearTimeout(t);
  }, [showSplash, loading, rowsReady, imagesReady]);

  // Attente images dashboard avec timeout 15s (demandé) : toutes les affiches/backdrops du dashboard
  useEffect(() => {
    if (!showSplash || loading || !rowsReady || imagesReady) return;
    const urls = new Set<string>();
    const add = (p: string | null, size: string) => { if (p) urls.add(`/tmdb/${size}${p}`); };
    for (const m of movies.slice(0, 12)) { add(m.posterPath, "w500"); add(m.backdropPath, "w780"); }
    for (const s of series.slice(0, 12)) { add(s.posterPath, "w500"); add(s.backdropPath, "w780"); }
    for (const e of recentEpisodes.slice(0, 8)) { add(e.posterPath, "w500"); }
    if (urls.size === 0) { setImagesReady(true); return; }
    let done = 0;
    const total = urls.size;
    const checkDone = () => { done++; setSplashProgress(82 + Math.round((done / total) * 10)); if (done >= total) setImagesReady(true); };
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const u of urls) {
      const img = new window.Image();
      img.onload = checkDone; img.onerror = checkDone; img.src = u;
    }
    const t = setTimeout(() => setImagesReady(true), 15000);
    return () => { clearTimeout(t); timers.forEach(clearTimeout); };
  }, [showSplash, loading, rowsReady, imagesReady, movies, series, recentEpisodes]);

  // Sécurité : si le chargement traîne >15s, on ne bloque pas l'UI indéfiniment (images timeout)
  useEffect(() => {
    if (!showSplash) return;
    const t = setTimeout(() => {
      setShowSplash(false);
      try { sessionStorage.setItem("movviz-splash-seen", "1"); } catch {}
    }, 15000);
    return () => clearTimeout(t);
  }, [showSplash]);

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

  // Classic reuses cinema's whole layout (compact stat pills, carousel rows)
  // minus the hero — only "compact" keeps the older flat stat-grid + simple
  // recently-added grid.
  const richMode = layout.mode === "cinema" || layout.mode === "classic";

  // Si pas de rangées à attendre (classic ou biblio vide), ne bloque pas le splash
  useEffect(() => {
    if (!loading && !richMode) setRowsReady(true);
    if (!loading && richMode && movies.length + series.length === 0) setRowsReady(true);
  }, [loading, richMode, movies.length, series.length]);

  return (
    <>
      <DashboardSplash show={showSplash} progress={splashProgress} />
      <div className="nx-dashboard-content mx-auto max-w-[1500px] space-y-8">
      {layout.mode === "cinema" && (
        <div className="nx-home-hero-grid grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(300px,340px)]">
          <CardErrorBoundary>
            <DashboardHero settings={layout.hero} />
          </CardErrorBoundary>
          <DashboardContinuePanel />
        </div>
      )}

      {layout.mode === "cinema" && (providerData?.tiles?.length ?? 0) > 0 && (
        <section className="nx-home-providers" aria-label={t("discover.watchProviders")}>
          <h2 className="text-sm font-black tracking-tight text-ink">{t("discover.watchProviders")}</h2>
          <div className="mt-2 grid w-full grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
            {providerData!.tiles.slice(0, 8).map((provider) => {
              const localSvg = PROVIDER_SVG[provider.id];
              return (
                <Link key={provider.id} href={`/discover?watchProvider=${provider.id}&watchProviderName=${encodeURIComponent(provider.name)}`} className={cn("nx-provider-tile", localSvg && PROVIDER_LIGHT_TILE.has(provider.id) && "nx-provider-tile-light")} title={provider.name}>
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

      {/* The NX desktop reference reserves operational counters for the
          Downloads control room.  Keep this useful overview on touch layouts,
          but let the desktop dashboard move directly from hero/platforms to
          its editorial rails. */}
      {layout.showStats && (
        <div className="lg:hidden">
        {loading ? (
          <div className={cn("flex flex-wrap", richMode ? "gap-2" : "gap-4")}>
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className={cn(
                  richMode ? "h-[52px] w-[160px] rounded-xl glass" : cn(TILE_CLASS, "rounded-2xl glass p-5")
                )}
              >
                {!richMode && (
                  <>
                    <div className="h-3 w-20 animate-pulse rounded bg-white/10" />
                    <div className="mt-3 h-8 w-16 animate-pulse rounded bg-white/10" />
                  </>
                )}
              </div>
            ))}
          </div>
        ) : hasError ? (
          <div className="rounded-2xl glass p-5 text-center">
            <div className="flex items-center justify-center gap-2 text-amber">
              <AlertCircle className="h-5 w-5" />
              <p className="font-semibold text-ink">{t("common.error")}</p>
            </div>
            <p className="mt-1 text-sm text-ink-dim">{t("dashboard.errorHint")}</p>
          </div>
        ) : richMode ? (
          <div className="flex flex-wrap gap-2">
            {order.map((id) => (
              <StatTile key={id} compact label={widgetLabels[id]} value={widgetValues[id]} icon={WIDGET_ICONS[id]} accent={WIDGET_ACCENTS[id]} />
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-4">
            {order.map((id) => (
              <div key={id} className={TILE_CLASS}>
                <StatTile label={widgetLabels[id]} value={widgetValues[id]} icon={WIDGET_ICONS[id]} accent={WIDGET_ACCENTS[id]} />
              </div>
            ))}
          </div>
        )}
        </div>
      )}

      {/*
        Always full-width right under the widgets, at every screen size —
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
          <DashboardRows sections={layout.sections} movies={movies} series={series} recentEpisodes={recentEpisodes} minYear={layout.hero.minYear} onRowsReady={handleRowsReady} excludeContinueWatching />
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
