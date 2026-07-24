"use client";

import useSWR from "swr";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Reorder } from "framer-motion";
import { StatTile } from "@/components/ui/StatTile";
import { DownloadQueue } from "@/components/media/DownloadQueue";
import { UpdateAvailableBanner } from "@/components/system/UpdateAvailableBanner";
import { LibraryMovieCard } from "@/components/library/LibraryMovieCard";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { LibraryMovie, LibrarySeries } from "@/lib/library/types";
import type { EngineTorrent } from "@/lib/types";
import { DASHBOARD_WIDGET_IDS, type DashboardWidgetId, type DashboardLayout } from "@/lib/dashboard/types";
import {
  Film, Tv, HardDriveDownload, Search as SearchIcon, Clock, Compass, ListVideo, AlertCircle,
  Pencil, Check, Plus, X, type LucideIcon,
} from "lucide-react";

const WIDGET_ICONS: Record<DashboardWidgetId, LucideIcon> = {
  movies: Film,
  series: Tv,
  episodes: ListVideo,
  missingEpisodes: AlertCircle,
  available: HardDriveDownload,
  downloading: SearchIcon,
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
  missing: "amber",
  episodesAvailable: "ok",
};

const TILE_CLASS = "w-[calc(50%-0.5rem)] sm:w-[calc(33.333%-0.667rem)] lg:w-[calc(25%-0.75rem)]";

export default function DashboardPage() {
  const t = useT();
  const { data: moviesData, mutate: mutateMovies } = useSWR<{ movies: LibraryMovie[] }>(
    "/api/library/movies"
  );
  const { data: seriesData } = useSWR<{ series: LibrarySeries[] }>(
    "/api/library/series"
  );
  const { data: torrentsData } = useSWR<{ torrents: EngineTorrent[] }>(
    "/api/engine/torrents"
  );
  const { data: layoutData, mutate: mutateLayout } = useSWR<{ layout: DashboardLayout }>("/api/dashboard/layout");

  const movies = moviesData?.movies ?? [];
  const series = seriesData?.series ?? [];
  const torrents = torrentsData?.torrents ?? [];
  const load = () => mutateMovies();
  const loading = !moviesData && !seriesData && !torrentsData;

  const available = movies.filter((m) => m.status === "available");
  const downloadingMovies = movies.filter((m) => m.status === "downloading" || m.status === "searching");
  const missing = movies.filter((m) => m.status === "missing");
  const recentlyAdded = [...movies].sort((a, b) => b.addedAt - a.addedAt).slice(0, 12);

  const monitoredEpisodes = series.flatMap((s) => s.seasons.flatMap((se) => se.episodes)).filter((e) => e.monitored);
  const availableEpisodes = monitoredEpisodes.filter((e) => e.status === "available");
  const downloadingEpisodes = monitoredEpisodes.filter((e) => e.status === "downloading" || e.status === "searching");
  const missingEpisodes = monitoredEpisodes.filter((e) => e.status === "missing");

  const progressFor = (movie: LibraryMovie) =>
    movie.activeInfoHash ? torrents.find((tr) => tr.infoHash === movie.activeInfoHash) : null;

  const widgetValues: Record<DashboardWidgetId, number> = {
    movies: movies.length,
    series: series.length,
    episodes: monitoredEpisodes.length,
    missingEpisodes: missingEpisodes.length,
    available: available.length + availableEpisodes.length,
    downloading: downloadingMovies.length + downloadingEpisodes.length,
    missing: missing.length,
    episodesAvailable: availableEpisodes.length,
  };

  const widgetLabels: Record<DashboardWidgetId, string> = {
    movies: t("dashboard.stats.movies"),
    series: t("dashboard.stats.series"),
    episodes: t("dashboard.stats.episodes"),
    missingEpisodes: t("dashboard.stats.missingEpisodes"),
    available: t("status.available"),
    downloading: t("dashboard.stats.downloading"),
    missing: t("status.missing"),
    episodesAvailable: t("dashboard.stats.episodesAvailable"),
  };

  const [editMode, setEditMode] = useState(false);
  const [order, setOrder] = useState<DashboardWidgetId[]>([...DASHBOARD_WIDGET_IDS]);
  const [addOpen, setAddOpen] = useState(false);

  useEffect(() => {
    if (layoutData?.layout) setOrder(layoutData.layout.widgets);
  }, [layoutData]);

  const persist = (widgets: DashboardWidgetId[]) => {
    setOrder(widgets);
    mutateLayout({ layout: { widgets } }, false);
    fetch("/api/dashboard/layout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ widgets }),
    });
  };

  const removeWidget = (id: DashboardWidgetId) => persist(order.filter((w) => w !== id));
  const addWidget = (id: DashboardWidgetId) => {
    persist([...order, id]);
    setAddOpen(false);
  };

  const hidden = DASHBOARD_WIDGET_IDS.filter((id) => !order.includes(id));

  return (
    <div className="mx-auto max-w-[1500px] space-y-8">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {editMode && (
          <div className="relative">
            <button
              onClick={() => setAddOpen((v) => !v)}
              disabled={hidden.length === 0}
              className="flex items-center gap-1.5 rounded-xl glass px-3.5 py-2 text-sm font-semibold text-ink-soft hover:text-ink disabled:opacity-40"
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
        <button
          onClick={() => { setEditMode((v) => !v); setAddOpen(false); }}
          className={cn(
            "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors",
            editMode ? "brand-gradient text-white" : "glass text-ink-soft hover:text-ink"
          )}
        >
          {editMode ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          {editMode ? t("dashboard.done") : t("dashboard.edit")}
        </button>
      </div>

      {loading ? (
        <div className="flex flex-wrap gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className={cn(TILE_CLASS, "rounded-2xl glass p-5")}>
              <div className="h-3 w-20 animate-pulse rounded bg-white/10" />
              <div className="mt-3 h-8 w-16 animate-pulse rounded bg-white/10" />
            </div>
          ))}
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
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-down text-white shadow-lg transition-transform hover:scale-110"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </Reorder.Item>
          ))}
        </Reorder.Group>
      ) : (
        <div className="flex flex-wrap gap-4">
          {order.map((id) => (
            <div key={id} className={TILE_CLASS}>
              <StatTile label={widgetLabels[id]} value={widgetValues[id]} icon={WIDGET_ICONS[id]} accent={WIDGET_ACCENTS[id]} />
            </div>
          ))}
        </div>
      )}

      {/*
        Always full-width right under the widgets, at every screen size —
        it used to move into a narrow 320px side rail on desktop, which made
        it much harder to read at a glance on a wide screen.
      */}
      <div className="space-y-6">
        <DownloadQueue />
      </div>

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
        ) : movies.length === 0 ? (
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
              {recentlyAdded.map((movie) => (
                <LibraryMovieCard key={movie.id} movie={movie} torrent={progressFor(movie)} onChange={load} />
              ))}
            </div>
          </section>
        )}
      </div>

      <UpdateAvailableBanner />
    </div>
  );
}
