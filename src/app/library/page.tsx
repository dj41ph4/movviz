"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { LibraryMovieCard } from "@/components/library/LibraryMovieCard";
import { LibrarySeriesCard } from "@/components/library/LibrarySeriesCard";
import { SearchAndReplacePanel } from "@/components/library/SearchAndReplacePanel";
import { useT, useI18n } from "@/i18n/provider";
import { cn, relativeTime, formatDate } from "@/lib/utils";
import type { LibraryMovie, LibrarySeries, LibraryStatus } from "@/lib/library/types";
import { decodeLibraryRef } from "@/lib/library/types";
import type { Collection } from "@/lib/collections/types";
import type { EngineTorrent } from "@/lib/types";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { useTitlePanel } from "@/components/title/useTitlePanel";
import { motion, AnimatePresence } from "framer-motion";
import {
  Film, ScanSearch, Loader2, Tv, ListChecks, Library as LibraryIcon, LibraryBig, RotateCw, Calendar, X, Download, SearchCheck,
  Layers, Grid2x2, Grid3x3, List, Check, RefreshCw,
} from "lucide-react";
import { mapWithConcurrency } from "@/lib/concurrency";

interface RescanIssue {
  kind: "missing" | "untracked";
  path: string;
}

interface Job {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  current: number;
  total: number;
  sourceId?: string;
}

const FILTERS: { id: "all" | LibraryStatus; key: string }[] = [
  { id: "all", key: "common.all" },
  { id: "available", key: "status.available" },
  { id: "downloading", key: "status.downloading" },
  { id: "missing", key: "status.missing" },
  { id: "upcoming", key: "status.upcoming" },
];
const TYPES: { id: "all" | "movie" | "series"; key: string }[] = [
  { id: "all", key: "common.all" },
  { id: "movie", key: "common.movies" },
  { id: "series", key: "common.series" },
];
const SORTS: { id: "title" | "recent" | "rating"; key: string }[] = [
  { id: "title", key: "library.sortTitle" },
  { id: "recent", key: "library.sortRecent" },
  { id: "rating", key: "library.sortRating" },
];

const TABS = [
  { id: "library", labelKey: "nav.library", icon: LibraryIcon },
  { id: "collection", labelKey: "nav.collections", icon: LibraryBig },
  { id: "wanted", labelKey: "nav.wanted", icon: ListChecks },
] as const;

// First paint renders this many cards; the rest mount in idle time.
const RENDER_BATCH_INITIAL = 100;
const RENDER_BATCH_STEP = 150;

export default function LibraryPage() {
  return (
    <Suspense fallback={null}>
      <LibraryPageInner />
    </Suspense>
  );
}

function LibraryPageInner() {
  const t = useT();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const initialTab = TABS.find((tb) => tb.id === params.get("tab"))?.id ?? "library";
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>(initialTab);
  // Mounted once at the page level (not per-tab) so the panel survives tab
  // switches, and every <Link href="/title/..."> rendered by any tab (movie/
  // series cards, collection posters) opens it instead of navigating away.
  const { titlePanel } = useTitlePanel();

  const pushTab = (id: (typeof TABS)[number]["id"]) => {
    setTab(id);
    const p = new URLSearchParams(params.toString());
    if (id === "library") p.delete("tab");
    else p.set("tab", id);
    router.push(pathname + (p.toString() ? "?" + p.toString() : ""), { scroll: false });
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader eyebrow={t("library.eyebrow")} title={t("library.title")} description={t("library.description")} />

      <div className="mb-6 flex flex-wrap gap-1.5">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            onClick={() => pushTab(tb.id)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
              tab === tb.id ? "brand-gradient text-white shadow-lg" : "glass text-ink-soft hover:text-ink"
            )}
          >
            <tb.icon className="h-4 w-4" />
            {t(tb.labelKey)}
          </button>
        ))}
      </div>

      {tab === "library" && <LibraryTab />}
      {tab === "collection" && <CollectionTab />}
      {tab === "wanted" && <WantedTab />}

      {titlePanel}
    </div>
  );
}

function LibraryTab() {
  const t = useT();
  const user = useCurrentUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>(
    () => (FILTERS.find((f) => f.id === searchParams.get("filter"))?.id ?? "all") as (typeof FILTERS)[number]["id"]
  );
  const [type, setType] = useState<(typeof TYPES)[number]["id"]>(
    () => (TYPES.find((tp) => tp.id === searchParams.get("type"))?.id ?? "all") as (typeof TYPES)[number]["id"]
  );
  const [sort, setSort] = useState<(typeof SORTS)[number]["id"]>(
    () => (SORTS.find((s) => s.id === searchParams.get("sort"))?.id ?? "title") as (typeof SORTS)[number]["id"]
  );
  const [tagFilter, setTagFilter] = useState(() => searchParams.get("tag") ?? "");
  const [rescanning, setRescanning] = useState(false);
  const [issues, setIssues] = useState<RescanIssue[] | null>(null);
  const [searchAndReplaceOpen, setSearchAndReplaceOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  // Sync library filters to URL for back-button support.
  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString());
    if (filter !== "all") p.set("filter", filter); else p.delete("filter");
    if (type !== "all") p.set("type", type); else p.delete("type");
    if (sort !== "title") p.set("sort", sort); else p.delete("sort");
    if (tagFilter) p.set("tag", tagFilter); else p.delete("tag");
    const qs = p.toString();
    if (qs !== searchParams.toString()) {
      router.push(pathname + (qs ? "?" + qs : ""), { scroll: false });
    }
  }, [filter, type, sort, tagFilter, searchParams, router, pathname]);
  const { data: tagsData } = useSWR<{ tags: string[] }>("/api/tags");
  const allTags = tagsData?.tags ?? [];

  // Poll the job queue for any admin visit to this page (not just while
  // *this* component instance triggered a run) so a "search all missing"
  // job started before a navigation away and back is still shown as
  // in-progress on return, instead of the button forgetting it and
  // looking idle. Only admins can see/trigger the button, so only admins
  // need to poll this.
  const { data: jobsData } = useSWR<{ jobs: Job[] }>(user?.role === "admin" ? "/api/jobs" : null, { refreshInterval: 2000 });
  const searchMissingJob = jobsData?.jobs.find(
    (j) => j.sourceId === "search-all-missing" && (j.status === "queued" || j.status === "running")
  );
  const searchingMissing = starting || !!searchMissingJob;
  const wasSearchingRef = useRef(false);
  useEffect(() => {
    if (wasSearchingRef.current && !searchMissingJob) {
      setStarting(false);
      refresh();
    } else if (searchMissingJob) {
      setStarting(false);
    }
    wasSearchingRef.current = !!searchMissingJob;
  }, [searchMissingJob]);

  const searchMissing = async () => {
    setStarting(true);
    try {
      await fetch(`/api/library/search-missing?scope=${type}`, { method: "POST" });
      setTimeout(() => setStarting(false), 8000);
    } catch {
      setStarting(false);
    }
  };
  const searchMissingLabel = type === "movie"
    ? t("library.searchMissingMovies")
    : type === "series"
      ? t("library.searchMissingEpisodes")
      : t("library.searchMissing");

  // SWR serves whatever was last cached for these URLs instantly on
  // remount (even if it was another page, e.g. Découverte, that populated
  // it) instead of the grid going blank on every visit, then revalidates
  // in the background on the same 3s cadence the old polling used.
  const { data: moviesData, mutate: mutateMovies } = useSWR<{ movies: LibraryMovie[] }>(
    "/api/library/movies"
  );
  const { data: seriesData, mutate: mutateSeries } = useSWR<{ series: LibrarySeries[] }>(
    "/api/library/series"
  );
  const { data: torrentsData } = useSWR<{ torrents: EngineTorrent[] }>(
    "/api/engine/torrents"
  );
  const movies = moviesData?.movies ?? [];
  const series = seriesData?.series ?? [];
  const torrents = torrentsData?.torrents ?? [];
  const loading = !moviesData || !seriesData;
  const refresh = () => { mutateMovies(); mutateSeries(); };

  const rescan = async () => {
    setRescanning(true);
    setIssues(null);
    try {
      const res = await fetch("/api/library/rescan", { cache: "no-store" });
      if (res.ok) setIssues((await res.json()).issues ?? []);
      refresh();
    } finally {
      setRescanning(false);
    }
  };

  // Shared SWR key with the series detail page — fetched once per session.
  const { data: watchData } = useSWR<{ movies: number[] }>("/api/watch-status");
  const watchedMovies = useMemo(() => new Set<number>(watchData?.movies ?? []), [watchData]);

  const sortItems = <TItem extends { title: string; addedAt: number; rating: number }>(list: TItem[]): TItem[] =>
    sort === "recent"
      ? [...list].sort((a, b) => b.addedAt - a.addedAt)
      : sort === "rating"
        ? [...list].sort((a, b) => b.rating - a.rating)
        : [...list].sort((a, b) => a.title.localeCompare(b.title));

  const movieItems = useMemo(
    () => sortItems(type === "series" ? [] : movies.filter((m) => (filter === "all" || m.status === filter) && (!tagFilter || (m.tags ?? []).includes(tagFilter)))),
    [movies, filter, type, tagFilter, sort]
  );
  const seriesStatus = (s: LibrarySeries): LibraryStatus => {
    const monitored = s.seasons.flatMap((se) => se.episodes).filter((e) => e.monitored);
    if (monitored.length > 0 && monitored.every((e) => e.status === "available")) return "available";
    if (monitored.some((e) => e.status === "downloading")) return "downloading";
    if (monitored.some((e) => e.status === "searching")) return "searching";
    return "missing";
  };
  const seriesItems = useMemo(
    () => sortItems(type === "movie" ? [] : series.filter((s) => (filter === "all" || seriesStatus(s) === filter) && (!tagFilter || (s.tags ?? []).includes(tagFilter)))),
    [series, filter, type, tagFilter, sort]
  );
  const items = movieItems;
  const total = items.length + seriesItems.length;

  // Progressive rendering: paint the first batch immediately so the page is
  // interactive at once, then mount the rest in idle time. Rendering the whole
  // library in one pass means thousands of DOM nodes before first paint — the
  // page felt frozen on large libraries.
  const [visibleCount, setVisibleCount] = useState(RENDER_BATCH_INITIAL);
  useEffect(() => {
    setVisibleCount(RENDER_BATCH_INITIAL);
  }, [filter, type, sort]);
  useEffect(() => {
    if (visibleCount >= total) return;
    const grow = () => setVisibleCount((c) => Math.min(totalRef.current, c + RENDER_BATCH_STEP));
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(grow);
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(grow, 50);
    return () => window.clearTimeout(id);
  }, [visibleCount, total]);
  // requestIdleCallback only fires during genuinely idle periods — continuous
  // scrolling keeps generating scroll/input events, so on a large library the
  // browser can go a long time without ever considering itself idle, and
  // growth visibly stalls partway through the alphabet. A sentinel below the
  // rendered grid grows the list immediately once the user scrolls near it,
  // independent of idle time — same pattern as the Discover page's paging.
  const totalRef = useRef(total);
  totalRef.current = total;
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visibleCount >= total) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) setVisibleCount((c) => Math.min(totalRef.current, c + RENDER_BATCH_STEP));
      },
      { rootMargin: "1000px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visibleCount, total]);

  const visibleMovies = items.slice(0, visibleCount);
  const visibleSeries = seriesItems.slice(0, Math.max(0, visibleCount - items.length));

  const progressFor = (movie: LibraryMovie) =>
    movie.activeInfoHash ? torrents.find((t) => t.infoHash === movie.activeInfoHash) : null;

  return (
    <div>
      <div className="mb-6 space-y-4 rounded-2xl glass p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-ink">
            <Film className="h-4 w-4 text-brand-glow" />
            <span className="text-sm font-semibold">{total} {t("common.titles")}</span>
          </div>
          {user?.role === "admin" && (
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={searchMissing}
                disabled={searchingMissing}
                className="flex h-9 items-center gap-2 rounded-lg glass-strong px-3.5 text-sm font-semibold text-ink-soft transition-colors hover:text-ink disabled:opacity-50 whitespace-nowrap"
              >
                {searchingMissing ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCheck className="h-4 w-4" />}
                {searchMissingJob?.status === "queued"
                  ? t("library.searchMissingWaiting")
                  : searchingMissing && searchMissingJob && searchMissingJob.total > 1
                    ? `${searchMissingJob.current} / ${searchMissingJob.total}`
                    : searchMissingLabel}
              </button>
              <button
                onClick={rescan}
                disabled={rescanning}
                className="flex h-9 items-center gap-2 rounded-lg glass-strong px-3.5 text-sm font-semibold text-ink-soft transition-colors hover:text-ink disabled:opacity-50 whitespace-nowrap"
              >
                {rescanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
                {t("library.rescan")}
              </button>
              <button
                onClick={() => setSearchAndReplaceOpen(true)}
                className="flex h-9 items-center gap-2 rounded-lg glass-strong px-3.5 text-sm font-semibold text-ink-soft transition-colors hover:text-ink whitespace-nowrap"
              >
                <RefreshCw className="h-4 w-4" />
                {t("library.searchAndReplace")}
              </button>
            </div>
          )}
        </div>

        {issues && (
          <div className="rounded-xl bg-black/20 p-3.5">
            {issues.length === 0 ? (
              <p className="text-sm text-ok">{t("library.rescanClean")}</p>
            ) : (
              <div className="space-y-1.5">
                {issues.map((issue, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-ink-soft">
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 font-semibold", issue.kind === "missing" ? "bg-down/12 text-down" : "bg-amber/12 text-amber")}>
                      {issue.kind === "missing" ? t("library.fileMissing") : t("library.untrackedFile")}
                    </span>
                    <span className="truncate font-mono">{issue.path}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="h-px bg-white/5" />

        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex flex-wrap gap-1.5">
            {TYPES.map((tp) => (
              <button
                key={tp.id}
                onClick={() => setType(tp.id)}
                className={cn(
                  "rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
                  type === tp.id ? "brand-gradient text-white shadow-lg" : "glass-strong text-ink-soft hover:text-ink"
                )}
              >
                {t(tp.key)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1 rounded-xl glass-strong p-1">
            {SORTS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSort(s.id)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  sort === s.id ? "brand-gradient text-white" : "text-ink-soft hover:text-ink"
                )}
              >
                {t(s.key)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
                filter === f.id ? "brand-gradient text-white shadow-lg" : "glass-strong text-ink-soft hover:text-ink"
              )}
            >
              {t(f.key)}
            </button>
          ))}
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-white/5 pt-3.5">
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => setTagFilter(tagFilter === tag ? "" : tag)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                  tagFilter === tag
                    ? "bg-brand/20 text-brand-glow shadow-lg"
                    : "glass-strong text-ink-soft hover:text-ink"
                )}
              >
                {tag}
                {tagFilter === tag && <X className="ml-1 inline h-3 w-3" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence mode="popLayout">
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {visibleMovies.map((movie, i) => (
            <LibraryMovieCard key={movie.id} index={i} movie={movie} torrent={progressFor(movie)} watched={watchedMovies.has(movie.tmdbId)} onChange={refresh} />
          ))}
          {visibleSeries.map((s, i) => (
            <LibrarySeriesCard key={s.id} index={visibleMovies.length + i} series={s} />
          ))}
        </div>
      </AnimatePresence>

      {visibleCount < total && <div ref={sentinelRef} className="h-1" />}

      {loading && total === 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {[...Array(12)].map((_, i) => (
            <div key={i}>
              <div className="aspect-[2/3] animate-pulse rounded-2xl bg-white/6" />
              <div className="mt-2.5 space-y-1.5 px-0.5">
                <div className="h-3 w-3/4 animate-pulse rounded bg-white/8" />
                <div className="h-2.5 w-1/2 animate-pulse rounded bg-white/6" />
              </div>
            </div>
          ))}
        </div>
      )}
      {!loading && total === 0 && (
        <p className="col-span-full py-16 text-center text-ink-dim">{t("library.empty")}</p>
      )}

      <SearchAndReplacePanel open={searchAndReplaceOpen} onClose={() => setSearchAndReplaceOpen(false)} />
    </div>
  );
}

type ViewMode = "large" | "small" | "list";

function useViewMode(storageKey: string): [ViewMode, (v: ViewMode) => void] {
  const [view, setView] = useState<ViewMode>("large");
  useEffect(() => {
    const stored = localStorage.getItem(storageKey) as ViewMode | null;
    if (stored === "large" || stored === "small" || stored === "list") setView(stored);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const update = (v: ViewMode) => {
    setView(v);
    localStorage.setItem(storageKey, v);
  };
  return [view, update];
}

function ViewModeToggle({ view, onChange }: { view: ViewMode; onChange: (v: ViewMode) => void }) {
  const t = useT();
  const options: { id: ViewMode; icon: typeof Grid2x2; labelKey: string }[] = [
    { id: "large", icon: Grid2x2, labelKey: "collections.viewLarge" },
    { id: "small", icon: Grid3x3, labelKey: "collections.viewSmall" },
    { id: "list", icon: List, labelKey: "collections.viewList" },
  ];
  return (
    <div className="flex items-center gap-1 rounded-xl glass p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          title={t(o.labelKey)}
          aria-label={t(o.labelKey)}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
            view === o.id ? "brand-gradient text-white shadow" : "text-ink-dim hover:text-ink"
          )}
        >
          <o.icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}

interface SagaSummary {
  collectionId: number;
  name: string;
  posterPath: string | null;
  ownedCount: number;
  totalCount: number;
}

function SagaRatioBadge({ ownedCount, totalCount }: { ownedCount: number; totalCount: number }) {
  const complete = ownedCount >= totalCount;
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm",
        complete ? "border-ok/30 bg-ok/15 text-ok" : "border-amber/30 bg-amber/15 text-amber"
      )}
    >
      {complete && <Check className="h-2.5 w-2.5" />}
      {ownedCount}/{totalCount}
    </span>
  );
}

function SagasSection() {
  const t = useT();
  const user = useCurrentUser();
  const [sagas, setSagas] = useState<SagaSummary[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [view, setView] = useViewMode("movviz-sagas-view");
  const loadTokenRef = useRef<object | null>(null);

  // A large library can span hundreds of franchises — waiting for every one
  // to resolve against TMDb before showing anything left this page blank for
  // several seconds on a cold cache. Load the first page immediately, then
  // keep fetching subsequent pages in the background, re-sorting the
  // accumulated list after each one so the order is exactly right once
  // everything has arrived (and only approximate, never wrong-looking,
  // while pages are still trickling in).
  const sortSagas = (list: SagaSummary[]) =>
    [...list].sort((a, b) => (b.totalCount - b.ownedCount) - (a.totalCount - a.ownedCount));

  const load = async () => {
    const pageSize = 30;
    let offset = 0;
    let acc: SagaSummary[] = [];
    const myToken = {};
    loadTokenRef.current = myToken;
    for (;;) {
      const res = await fetch(`/api/collections/sagas?offset=${offset}&limit=${pageSize}`, { cache: "no-store" });
      if (loadTokenRef.current !== myToken) return; // a rescan superseded this load
      const d = res.ok ? await res.json() : null;
      if (!d) { if (offset === 0) setSagas([]); return; }
      acc = acc.concat(d.sagas ?? []);
      setSagas(sortSagas(acc));
      if (!d.hasMore) return;
      offset += pageSize;
    }
  };

  const pollScan = async () => {
    for (;;) {
      const res = await fetch("/api/collections/scan-sagas", { cache: "no-store" });
      const status = await res.json();
      if (!status.running) break;
      await new Promise((r) => setTimeout(r, 2000));
    }
    setScanning(false);
    await load();
  };

  const startScan = async () => {
    setScanning(true);
    await fetch("/api/collections/scan-sagas", { method: "POST" });
    pollScan();
  };

  useEffect(() => { load(); }, []);

  if (sagas === null) {
    return (
      <div className="mb-10 animate-pulse">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="h-5 w-40 rounded bg-white/10" />
            <div className="mt-2 h-3.5 w-64 rounded bg-white/5" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] rounded-2xl bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mb-10">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-ink">{t("collections.sagasTitle")}</h2>
          <p className="text-sm text-ink-dim">{t("collections.sagasHint")}</p>
        </div>
        <div className="flex items-center gap-2">
          <ViewModeToggle view={view} onChange={setView} />
          {user?.role === "admin" && (
            <button
              onClick={startScan}
              disabled={scanning}
              className="flex items-center gap-2 rounded-xl glass px-3.5 py-2 text-xs font-semibold text-ink-soft hover:text-ink disabled:opacity-50"
            >
              {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {scanning ? t("collections.scanning") : t("collections.scanLibrary")}
            </button>
          )}
        </div>
      </div>

      {sagas.length === 0 ? (
        <p className="rounded-2xl glass p-5 text-sm text-ink-dim">{t("collections.sagasEmpty")}</p>
      ) : view === "list" ? (
        <div className="space-y-2">
          {sagas.map((s) => {
            const pct = Math.min(100, Math.round((s.ownedCount / s.totalCount) * 100));
            return (
              <Link
                key={s.collectionId}
                href={`/collection/${s.collectionId}`}
                className="group flex items-center gap-3.5 overflow-hidden rounded-xl glass-strong p-2 transition hover:glass-stronger"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-brand-glow/20 to-purple/20">
                  {s.posterPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`https://image.tmdb.org/t/p/w185${s.posterPath}`} alt={s.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center"><Layers className="h-5 w-5 text-ink-soft/60" /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{s.name}</p>
                  <div className="mt-1.5 h-1 w-full max-w-40 overflow-hidden rounded-full bg-white/8">
                    <div className={cn("h-full rounded-full", pct >= 100 ? "bg-ok" : "brand-gradient")} style={{ width: `${pct}%` }} />
                  </div>
                </div>
                <SagaRatioBadge ownedCount={s.ownedCount} totalCount={s.totalCount} />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className={cn("grid gap-4", view === "small" ? "grid-cols-5 sm:grid-cols-6 md:grid-cols-7 lg:grid-cols-8 xl:grid-cols-9" : "grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7")}>
          {sagas.map((s) => {
            const pct = Math.min(100, Math.round((s.ownedCount / s.totalCount) * 100));
            return (
              <Link
                key={s.collectionId}
                href={`/collection/${s.collectionId}`}
                className="group relative overflow-hidden rounded-2xl border border-white/5 bg-surface transition hover:border-brand/30"
              >
                <div className="aspect-[2/3]">
                  {s.posterPath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={`https://image.tmdb.org/t/p/w342${s.posterPath}`} alt={s.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand/20 to-purple/20">
                      <Layers className="h-8 w-8 text-ink-soft/60" />
                    </div>
                  )}
                </div>
                <div className="absolute inset-x-0 bottom-0 h-1 bg-black/40">
                  <div className={cn("h-full", pct >= 100 ? "bg-ok" : "brand-gradient")} style={{ width: `${pct}%` }} />
                </div>
                <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/25 to-transparent p-3 pb-3.5">
                  <p className={cn("truncate font-semibold text-white", view === "small" ? "text-[10px]" : "text-xs")}>{s.name}</p>
                  <SagaRatioBadge ownedCount={s.ownedCount} totalCount={s.totalCount} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Cap on visible posters per user-curated collection before "+n" — keeps
 *  one big collection from dominating the tab's vertical space, especially
 *  on mobile where the whole page is already narrower. */
const COLLECTION_ITEM_CAP = 6;

interface ResolvedCollectionItem {
  tmdbId: number;
  type: "movie" | "series";
  title: string;
  posterPath: string | null;
}

function resolveCollectionItem(
  libraryRef: string,
  moviesById: Map<string, LibraryMovie>,
  seriesById: Map<string, LibrarySeries>
): ResolvedCollectionItem | null {
  const ref = decodeLibraryRef(libraryRef);
  if (!ref) return null;
  if (ref.kind === "movie") {
    const m = moviesById.get(ref.movieId);
    return m ? { tmdbId: m.tmdbId, type: "movie", title: m.title, posterPath: m.posterPath } : null;
  }
  const s = seriesById.get(ref.seriesId);
  return s ? { tmdbId: s.tmdbId, type: "series", title: s.title, posterPath: s.posterPath } : null;
}

/** User-curated collections — resolved to real posters via their items'
 *  libraryRef, each poster opening the sidepanel. Creating/editing a
 *  collection is a separate, not-yet-built feature (the "+ Nouveau" affordance
 *  is hidden rather than left as a dead click), so this section is display-only. */
function UserCollectionsSection() {
  const t = useT();
  const { data: collectionsData, error, isLoading } = useSWR<{ collections: Collection[] }>("/api/collections");
  const { data: moviesData } = useSWR<{ movies: LibraryMovie[] }>("/api/library/movies");
  const { data: seriesData } = useSWR<{ series: LibrarySeries[] }>("/api/library/series");

  const moviesById = useMemo(() => new Map((moviesData?.movies ?? []).map((m) => [m.id, m])), [moviesData]);
  const seriesById = useMemo(() => new Map((seriesData?.series ?? []).map((s) => [s.id, s])), [seriesData]);

  const collections = collectionsData?.collections ?? [];

  if (error) {
    return <div className="rounded-2xl glass py-12 text-center text-sm text-down">{t("activity.loadError")}</div>;
  }

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="mb-4 h-5 w-40 rounded bg-white/10" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 rounded-2xl bg-white/5" />)}
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold text-ink">{t("collections.title")}</h2>

      {collections.length === 0 ? (
        <div className="rounded-2xl glass py-12 text-center">
          <p className="font-semibold text-ink">{t("collections.empty")}</p>
          <p className="mt-1 text-sm text-ink-dim">{t("collections.emptyHint")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {collections.map((col) => {
            const resolved = col.items
              .map((item) => resolveCollectionItem(item.libraryRef, moviesById, seriesById))
              .filter((x): x is ResolvedCollectionItem => x !== null);
            const visible = resolved.slice(0, COLLECTION_ITEM_CAP);
            const hiddenCount = resolved.length - visible.length;
            return (
              <div key={col.id} className="rounded-2xl glass p-4">
                <div className="mb-3 flex items-baseline justify-between gap-2">
                  <p className="truncate font-bold text-ink">{col.name}</p>
                  <span className="shrink-0 text-xs text-ink-dim">{resolved.length} {t("collections.items")}</span>
                </div>
                {visible.length === 0 ? (
                  <p className="text-sm text-ink-dim">{t("collections.itemsUnavailable")}</p>
                ) : (
                  <div className="flex flex-wrap gap-2.5">
                    {visible.map((item) => (
                      <Link
                        key={`${item.type}-${item.tmdbId}`}
                        href={`/title/${item.type}/${item.tmdbId}`}
                        title={item.title}
                        className="group relative h-24 w-16 shrink-0 overflow-hidden rounded-lg border border-white/5 bg-surface transition hover:border-brand/30"
                      >
                        {item.posterPath ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`https://image.tmdb.org/t/p/w154${item.posterPath}`} alt={item.title} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand/20 to-purple/20">
                            {item.type === "movie" ? <Film className="h-4 w-4 text-ink-soft/60" /> : <Tv className="h-4 w-4 text-ink-soft/60" />}
                          </div>
                        )}
                      </Link>
                    ))}
                    {hiddenCount > 0 && (
                      <div className="flex h-24 w-16 shrink-0 items-center justify-center rounded-lg border border-white/5 bg-black/20 text-xs font-bold text-ink-dim">
                        +{hiddenCount}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CollectionTab() {
  return (
    <div>
      <SagasSection />
      <UserCollectionsSection />
    </div>
  );
}

interface WantedEpisode {
  series: LibrarySeries;
  season: number;
  episode: number;
  title: string;
  airDate: string | null;
}

function WantedTab() {
  const { t, locale } = useI18n();
  const [busy, setBusy] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [allProgress, setAllProgress] = useState<{ current: number; total: number } | null>(null);

  // Same SWR keys as the library tab/dashboard — SSE-driven revalidation.
  const { data: moviesData, mutate: mutateMovies } = useSWR<{ movies: LibraryMovie[] }>(
    "/api/library/movies"
  );
  const { data: seriesData, mutate: mutateSeries } = useSWR<{ series: LibrarySeries[] }>(
    "/api/library/series"
  );
  const movies = useMemo(
    () => (moviesData?.movies ?? []).filter((x) => x.monitored && x.status === "missing"),
    [moviesData]
  );
  const episodes = useMemo(() => {
    const eps: WantedEpisode[] = [];
    for (const series of seriesData?.series ?? []) {
      for (const season of series.seasons) {
        for (const ep of season.episodes) {
          if (ep.monitored && ep.status === "missing") {
            eps.push({ series, season: season.seasonNumber, episode: ep.episodeNumber, title: ep.title, airDate: ep.airDate });
          }
        }
      }
    }
    return eps;
  }, [seriesData]);
  const load = async () => { await Promise.all([mutateMovies(), mutateSeries()]); };

  const searchMovie = async (id: string) => {
    setBusy(`m${id}`);
    try {
      await fetch(`/api/library/movies/${id}/search`, { method: "POST" });
      await load();
    } finally {
      setBusy(null);
    }
  };
  const searchEpisode = async (seriesId: string, season: number, episode: number) => {
    const key = `e${seriesId}.${season}.${episode}`;
    setBusy(key);
    try {
      await fetch(`/api/library/series/${seriesId}/episode/${season}/${episode}/search`, { method: "POST" });
      await load();
    } finally {
      setBusy(null);
    }
  };

  // Each POST just enqueues a background job and returns immediately (see
  // /api/library/movies/[id]/search) — the job queue's own concurrency limit
  // throttles the real work, so firing every request with a small client-side
  // concurrency cap is enough to queue thousands of items without opening
  // thousands of sockets at once.
  const downloadAll = async () => {
    const targets = [...movies, ...episodes];
    if (targets.length === 0) return;
    setDownloadingAll(true);
    setAllProgress({ current: 0, total: targets.length });
    let done = 0;
    try {
      await mapWithConcurrency(targets, 5, async (item) => {
        if ("id" in item) {
          await fetch(`/api/library/movies/${item.id}/search`, { method: "POST" });
        } else {
          await fetch(`/api/library/series/${item.series.id}/episode/${item.season}/${item.episode}/search`, { method: "POST" });
        }
        done++;
        setAllProgress({ current: done, total: targets.length });
      });
      await load();
    } finally {
      setDownloadingAll(false);
      setAllProgress(null);
    }
  };

  const total = movies.length + episodes.length;

  // Progressive rendering, same pattern as the library tab: the wanted list can
  // hold thousands of rows — paint the first batch immediately, mount the
  // rest in idle time so the page never freezes.
  const [visibleCount, setVisibleCount] = useState(RENDER_BATCH_INITIAL);
  useEffect(() => {
    if (visibleCount >= total) return;
    const grow = () => setVisibleCount((c) => c + RENDER_BATCH_STEP);
    if (typeof window.requestIdleCallback === "function") {
      const rid = window.requestIdleCallback(grow);
      return () => window.cancelIdleCallback(rid);
    }
    const tid = window.setTimeout(grow, 50);
    return () => window.clearTimeout(tid);
  }, [visibleCount, total]);
  const visibleMovies = movies.slice(0, visibleCount);
  const visibleEpisodes = episodes.slice(0, Math.max(0, visibleCount - movies.length));

  return (
    <div className="mx-auto max-w-[1100px] space-y-4">
      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl glass px-4 py-3">
          <span className="text-sm font-semibold text-ink-soft">{total} {t("common.titles")}</span>
          <button
            onClick={downloadAll}
            disabled={downloadingAll}
            className="flex h-9 items-center gap-2 rounded-xl brand-gradient px-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {downloadingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {downloadingAll && allProgress ? `${allProgress.current} / ${allProgress.total}` : t("wanted.downloadAll")}
          </button>
        </div>
      )}
      <div className="space-y-2">
      {visibleMovies.map((movie) => (
        <div key={movie.id} className="flex items-center gap-3 rounded-xl glass px-4 py-3">
          <Film className="h-4 w-4 shrink-0 text-ink-dim" />
          <Link href={`/title/movie/${movie.tmdbId}`} className="min-w-0 flex-1 truncate text-sm font-semibold text-ink hover:text-brand-glow">
            {movie.title} {movie.year ? `(${movie.year})` : ""}
          </Link>
          {formatDate(movie.releaseDate, locale) && (
            <span className="flex shrink-0 items-center gap-1 text-xs text-ink-dim">
              <Calendar className="h-3 w-3" /> {formatDate(movie.releaseDate, locale)}
            </span>
          )}
          <span className="text-xs text-ink-dim">{relativeTime(new Date(movie.addedAt).toISOString(), locale)}</span>
          <button
            onClick={() => searchMovie(movie.id)}
            disabled={busy === `m${movie.id}`}
            className="flex h-10 items-center gap-1.5 rounded-lg brand-gradient px-3 text-xs font-bold text-white disabled:opacity-50"
          >
            {busy === `m${movie.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
          </button>
        </div>
      ))}
      {visibleEpisodes.map((e) => (
        <div key={`${e.series.id}-${e.season}-${e.episode}`} className="flex items-center gap-3 rounded-xl glass px-4 py-3">
          <Tv className="h-4 w-4 shrink-0 text-ink-dim" />
          <Link href={`/title/series/${e.series.tmdbId}`} className="min-w-0 flex-1 truncate text-sm font-semibold text-ink hover:text-brand-glow">
            {e.series.title} — {e.season}x{String(e.episode).padStart(2, "0")} {e.title}
          </Link>
          {formatDate(e.airDate, locale) && (
            <span className="flex shrink-0 items-center gap-1 text-xs text-ink-dim">
              <Calendar className="h-3 w-3" /> {formatDate(e.airDate, locale)}
            </span>
          )}
          <button
            onClick={() => searchEpisode(e.series.id, e.season, e.episode)}
            disabled={busy === `e${e.series.id}.${e.season}.${e.episode}`}
            className="flex h-10 items-center gap-1.5 rounded-lg brand-gradient px-3 text-xs font-bold text-white disabled:opacity-50"
          >
            {busy === `e${e.series.id}.${e.season}.${e.episode}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
          </button>
        </div>
      ))}
      </div>
      {total === 0 && <div className="rounded-2xl glass py-16 text-center text-ink-dim">{t("wanted.empty")}</div>}
    </div>
  );
}
