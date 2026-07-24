"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { LibraryMovieCard } from "@/components/library/LibraryMovieCard";
import { LibrarySeriesCard } from "@/components/library/LibrarySeriesCard";
import { useT, useI18n } from "@/i18n/provider";
import { cn, relativeTime, formatDate } from "@/lib/utils";
import type { LibraryMovie, LibrarySeries, LibraryStatus } from "@/lib/library/types";
import type { EngineTorrent } from "@/lib/types";
import type { CalendarEntry } from "@/app/api/calendar/route";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { Film, ScanSearch, Loader2, Tv, CalendarDays, ListChecks, Library as LibraryIcon, RotateCw, Calendar, X, Download, SearchCheck } from "lucide-react";
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
  { id: "calendar", labelKey: "nav.calendar", icon: CalendarDays },
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
  const initialTab = TABS.find((tb) => tb.id === params.get("tab"))?.id ?? "library";
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>(initialTab);

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader eyebrow={t("library.eyebrow")} title={t("library.title")} description={t("library.description")} />

      <div className="mb-6 flex flex-wrap gap-1.5">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
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
      {tab === "calendar" && <CalendarTab />}
      {tab === "wanted" && <WantedTab />}
    </div>
  );
}

function LibraryTab() {
  const t = useT();
  const user = useCurrentUser();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [type, setType] = useState<(typeof TYPES)[number]["id"]>("all");
  const [sort, setSort] = useState<(typeof SORTS)[number]["id"]>("title");
  const [tagFilter, setTagFilter] = useState("");
  const [rescanning, setRescanning] = useState(false);
  const [issues, setIssues] = useState<RescanIssue[] | null>(null);
  const [starting, setStarting] = useState(false);
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
      <div className="mb-6 space-y-4 rounded-2xl glass p-4">
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

      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {visibleMovies.map((movie) => (
          <LibraryMovieCard key={movie.id} movie={movie} torrent={progressFor(movie)} watched={watchedMovies.has(movie.tmdbId)} onChange={refresh} />
        ))}
        {visibleSeries.map((s) => (
          <LibrarySeriesCard key={s.id} series={s} />
        ))}
      </div>

      {visibleCount < total && <div ref={sentinelRef} className="h-1" />}

      {loading && total === 0 && (
        <div className="flex items-center justify-center gap-2 py-16 text-ink-dim">
          <Loader2 className="h-5 w-5 animate-spin" /> {t("common.loading")}
        </div>
      )}
      {!loading && total === 0 && (
        <p className="col-span-full py-16 text-center text-ink-dim">{t("library.empty")}</p>
      )}
    </div>
  );
}

function CalendarTab() {
  const t = useT();
  // Cached by SWR: instant paint on revisit, background revalidation.
  const { data } = useSWR<{ entries: CalendarEntry[] }>("/api/calendar");
  const entries = data?.entries ?? [];

  const todayIso = new Date().toISOString().slice(0, 10);
  const upcoming = entries.filter((e) => e.date >= todayIso);

  const groups = upcoming.reduce<Record<string, CalendarEntry[]>>((acc, e) => {
    (acc[e.date] ??= []).push(e);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-[1100px] space-y-5">
      {Object.entries(groups).map(([date, items]) => (
        <div key={date}>
          <div className="mb-2 flex items-center gap-2 text-sm font-bold text-ink-soft">
            <CalendarDays className="h-4 w-4 text-brand-glow" />
            {date === todayIso ? t("calendar.today") : new Date(date).toLocaleDateString()}
          </div>
          <div className="space-y-1.5">
            {items.map((e, i) => {
              const poster = e.posterPath ? `https://image.tmdb.org/t/p/w92${e.posterPath}` : null;
              return (
                <Link
                  key={`${date}-${i}`}
                  href={e.href}
                  className={cn("flex items-center gap-3 rounded-xl glass px-4 py-2.5 transition-colors hover:bg-white/5")}
                >
                  <div className="h-10 w-7 shrink-0 overflow-hidden rounded bg-surface">
                    {poster ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={poster} alt={e.title} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        {e.kind === "movie" ? <Film className="h-3.5 w-3.5 text-ink-soft/50" /> : <Tv className="h-3.5 w-3.5 text-ink-soft/50" />}
                      </div>
                    )}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{e.title}</span>
                  {e.badges?.map((badge) => (
                    <span
                      key={badge}
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold",
                        badge === "VF" ? "border-brand/30 bg-brand/12 text-brand-glow" : "border-white/10 bg-white/5 text-ink-dim"
                      )}
                    >
                      {badge === "VF" ? t("calendar.vf") : t("calendar.vo")}
                    </span>
                  ))}
                  <span className="flex shrink-0 items-center gap-1 text-xs text-ink-dim">
                    {e.kind === "movie" ? <Film className="h-3 w-3" /> : <Tv className="h-3 w-3" />}
                    {e.kind === "movie" ? t("common.movies") : t("common.series")}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
      {upcoming.length === 0 && <div className="rounded-2xl glass py-16 text-center text-ink-dim">{t("calendar.empty")}</div>}
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
          <span className="text-xs text-ink-dim">{relativeTime(new Date(movie.addedAt).toISOString())}</span>
          <button
            onClick={() => searchMovie(movie.id)}
            disabled={busy === `m${movie.id}`}
            className="flex h-8 items-center gap-1.5 rounded-lg brand-gradient px-3 text-xs font-bold text-white disabled:opacity-50"
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
            className="flex h-8 items-center gap-1.5 rounded-lg brand-gradient px-3 text-xs font-bold text-white disabled:opacity-50"
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
