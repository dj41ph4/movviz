"use client";

import useSWR from "swr";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Reorder } from "framer-motion";
import { StatTile } from "@/components/ui/StatTile";
import { DownloadQueue } from "@/components/media/DownloadQueue";
import { UpdateAvailableBanner } from "@/components/system/UpdateAvailableBanner";
import { LibraryMovieCard } from "@/components/library/LibraryMovieCard";
import { DashboardHero } from "@/components/dashboard/DashboardHero";
import { DashboardRows } from "@/components/dashboard/DashboardRows";
import { DashboardSplash } from "@/components/dashboard/DashboardSplash";
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
  const { data: layoutData, mutate: mutateLayout } = useSWR<{ layout: DashboardLayout }>("/api/dashboard/layout");
  const layout = layoutData?.layout ?? DEFAULT_DASHBOARD_LAYOUT;
  const { data: torrentsData, error: torrentsError } = useSWR<{ torrents: EngineTorrent[] }>(
    interfaceModeReady && (!optimized || layout.mode === "compact") ? "/api/engine/torrents" : null
  );
  const { titlePanel } = useTitlePanel();

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

  const [editMode, setEditMode] = useState(false);
  const [order, setOrder] = useState<DashboardWidgetId[]>([...DASHBOARD_WIDGET_IDS]);
  const [addOpen, setAddOpen] = useState(false);
  const [showSplash, setShowSplash] = useState(false);
  const [splashProgress, setSplashProgress] = useState(14);

  useEffect(() => {
    if (layoutData?.layout) setOrder(layoutData.layout.widgets);
  }, [layoutData]);

  // Splash cold-start uniquement en optimisé (compatibilité va disparaître) : plein centre Movviz haute qualité, jamais à chaque clic/SWR
  useEffect(() => {
    if (!optimized) return;
    if (typeof window === "undefined") return;
    const seen = sessionStorage.getItem("movviz-splash-seen");
    if (!seen && loading) {
      setShowSplash(true);
      setSplashProgress(14);
    }
  }, [loading, optimized]);

  useEffect(() => {
    if (!showSplash) return;
    if (loading) {
      const id = setInterval(() => setSplashProgress((p) => (p < 88 ? p + Math.random() * 7 + 1 : p)), 280);
      return () => clearInterval(id);
    }
    // loading terminé → barre intelligente file à 100 puis fade
    setSplashProgress(100);
    const t = setTimeout(() => {
      setShowSplash(false);
      try { sessionStorage.setItem("movviz-splash-seen", "1"); } catch {}
    }, 520);
    return () => clearTimeout(t);
  }, [showSplash, loading]);

  // Sécurité : si le chargement traîne >4s, on ne bloque pas l'UI indéfiniment
  useEffect(() => {
    if (!showSplash) return;
    const t = setTimeout(() => {
      setShowSplash(false);
      try { sessionStorage.setItem("movviz-splash-seen", "1"); } catch {}
    }, 4000);
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
  }, [loading, showSplash]);

  const persist = (widgets: DashboardWidgetId[]) => {
    setOrder(widgets);
    // Always POST the full layout (not just `widgets`) — sanitizeDashboardLayout
    // treats a payload without `version: 2` as a legacy pre-migration file and
    // resets mode/hero/sections to defaults, which would otherwise silently
    // flip the user back to "classic" on every widget drag.
    const next = { ...(layoutData?.layout ?? DEFAULT_DASHBOARD_LAYOUT), widgets };
    mutateLayout({ layout: next }, false);
    fetch("/api/dashboard/layout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    });
  };

  const removeWidget = (id: DashboardWidgetId) => persist(order.filter((w) => w !== id));
  const addWidget = (id: DashboardWidgetId) => {
    persist([...order, id]);
    setAddOpen(false);
  };

  const hidden = DASHBOARD_WIDGET_IDS.filter((id) => !order.includes(id));
  // Classic reuses cinema's whole layout (compact stat pills, carousel rows)
  // minus the hero — only "compact" keeps the older flat stat-grid + simple
  // recently-added grid.
  const richMode = layout.mode === "cinema" || layout.mode === "classic";

  return (
    <>
      <DashboardSplash show={showSplash} progress={splashProgress} />
      <div className="mx-auto max-w-[1500px] space-y-8">
      {layout.mode === "cinema" && (
        <CardErrorBoundary>
          <DashboardHero settings={layout.hero} />
        </CardErrorBoundary>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {editMode && (
          <div className="relative">
            <button
              onClick={() => setAddOpen((v) => !v)}
              disabled={hidden.length === 0}
              className="flex items-center gap-1.5 rounded-xl glass px-3.5 py-2 text-sm font-semibold text-ink-soft hover:text-ink disabled:opacity-40 transition-transform hover:scale-105"
            >
              <Plus className="h-4 w-4" /> {t("dashboard.addWidget")}
            </button>
            {addOpen && hidden.length > 0 && (
              <div className="absolute right-0 top-full z-20 mt-2 w-56 rounded-xl glass-strong p-2 shadow-2xl">
                {hidden.map((id) => (
                  <button
                    key={id}
                    onClick={() => addWidget(id)}
                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-ink-soft hover:bg-white/5 hover:text-ink"
                  >
                    <Plus className="h-3.5 w-3.5" /> {widgetLabels[id]}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {layout.showStats && (
          <button
            onClick={() => { setEditMode((v) => !v); setAddOpen(false); }}
            title={editMode ? t("dashboard.done") : t("dashboard.edit")}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
              editMode ? "brand-gradient text-white" : "glass text-ink-dim hover:text-ink"
            )}
          >
            {editMode ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          </button>
        )}
      </div>

      {layout.showStats && (
        loading ? (
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
        ) : order.length === 0 ? (
          <p className="rounded-2xl glass p-5 text-sm text-ink-dim">{t("dashboard.noWidgets")}</p>
        ) : editMode ? (
          <Reorder.Group as="div" axis="y" values={order} onReorder={persist} className="flex flex-wrap gap-4">
            {order.map((id) => (
              <Reorder.Item
                key={id}
                value={id}
                className={cn(TILE_CLASS, "relative cursor-grab active:cursor-grabbing")}
              >
                <StatTile label={widgetLabels[id]} value={widgetValues[id]} icon={WIDGET_ICONS[id]} accent={WIDGET_ACCENTS[id]} />
                <button
                  onClick={() => removeWidget(id)}
                  aria-label={t("dashboard.removeWidget")}
                  className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-down/12 text-down shadow-lg backdrop-blur transition-transform hover:scale-110"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </Reorder.Item>
            ))}
          </Reorder.Group>
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
        )
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
          <DashboardRows sections={layout.sections} movies={movies} series={series} recentEpisodes={recentEpisodes} minYear={layout.hero.minYear} />
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
