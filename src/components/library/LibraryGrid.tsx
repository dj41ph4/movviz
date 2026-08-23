"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { LibraryMovieCard } from "@/components/library/LibraryMovieCard";
import { LibrarySeriesCard } from "@/components/library/LibrarySeriesCard";
import { SearchAndReplacePanel } from "@/components/library/SearchAndReplacePanel";
import { useT, useI18n } from "@/i18n/provider";
import { useTitleArtworkBatch, type TitleArtworkRef } from "@/components/media/useTitleArtworkBatch";
import { cn } from "@/lib/utils";
import type { LibraryMovie, LibrarySeries, LibraryStatus } from "@/lib/library/types";
import type { EngineTorrent } from "@/lib/types";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { motion, AnimatePresence } from "framer-motion";
import { Film, ScanSearch, Loader2, SearchCheck, RefreshCw, X } from "lucide-react";

export const RENDER_BATCH_INITIAL = 100;
export const RENDER_BATCH_STEP = 150;

interface RescanIssue {
  kind: "missing" | "untracked" | "duplicate";
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
  { id: "missing", key: "status.missing" },
];
const TYPES: { id: "all" | "movie" | "series"; key: string; href: string }[] = [
  { id: "all", key: "common.all", href: "/library" },
  { id: "movie", key: "common.movies", href: "/movies" },
  { id: "series", key: "common.series", href: "/series" },
];
const SORTS: { id: "title" | "recent" | "rating"; key: string }[] = [
  { id: "title", key: "library.sortTitle" },
  { id: "recent", key: "library.sortRecent" },
  { id: "rating", key: "library.sortRating" },
];

/**
 * The library grid, shared by three fixed pages: /library (Tout, mixes both
 * types and keeps the type chips as links to the dedicated pages), /movies
 * (movies only) and /series (series only). On the fixed pages the type is
 * baked in — no type chips, no `type` URL param.
 */
export function LibraryGrid({ fixedType }: { fixedType: "all" | "movie" | "series" }) {
  return (
    <Suspense fallback={null}>
      <LibraryGridInner fixedType={fixedType} />
    </Suspense>
  );
}

function LibraryGridInner({ fixedType }: { fixedType: "all" | "movie" | "series" }) {
  const t = useT();
  const { locale } = useI18n();
  const user = useCurrentUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>(
    () => (FILTERS.find((f) => f.id === searchParams.get("filter"))?.id ?? "all") as (typeof FILTERS)[number]["id"]
  );
  const [sort, setSort] = useState<(typeof SORTS)[number]["id"]>(
    () => (SORTS.find((s) => s.id === searchParams.get("sort"))?.id ?? "title") as (typeof SORTS)[number]["id"]
  );
  const [tagFilter, setTagFilter] = useState(() => searchParams.get("tag") ?? "");
  const [rescanning, setRescanning] = useState(false);
  const [issues, setIssues] = useState<RescanIssue[] | null>(null);
  const [searchAndReplaceOpen, setSearchAndReplaceOpen] = useState(false);
  const [starting, setStarting] = useState(false);

  // The "Tout" page keeps accepting legacy ?type=movie|series links (old
  // sidebar/bookmarks) — redirect them to the dedicated fixed pages.
  const typeParam = searchParams.get("type");
  useEffect(() => {
    if (fixedType !== "all") return;
    if (typeParam === "movie") router.replace("/movies");
    else if (typeParam === "series") router.replace("/series");
  }, [typeParam, fixedType, router]);

  const type = fixedType;

  // Sync library filters to URL for back-button support.
  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString());
    if (filter !== "all") p.set("filter", filter); else p.delete("filter");
    if (sort !== "title") p.set("sort", sort); else p.delete("sort");
    if (tagFilter) p.set("tag", tagFilter); else p.delete("tag");
    const qs = p.toString();
    if (qs !== searchParams.toString()) {
      router.push(pathname + (qs ? "?" + qs : ""), { scroll: false });
    }
  }, [filter, sort, tagFilter, searchParams, router, pathname]);
  const { data: tagsData } = useSWR<{ tags: string[] }>("/api/tags");
  // "plex" is auto-applied to every title synced from Plex (librarySync.ts)
  // — on a Plex-backed library nearly everything carries it, making it
  // useless as a filter dimension, so it's excluded from this picker.
  const allTags = (tagsData?.tags ?? []).filter((tag) => tag !== "plex");

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

  const movieItems = useMemo(
    () => (type === "series" ? [] : movies.filter((m) => (filter === "all" || m.status === filter) && (!tagFilter || (m.tags ?? []).includes(tagFilter)))),
    [movies, filter, type, tagFilter]
  );
  const seriesStatus = (s: LibrarySeries): LibraryStatus => {
    const monitored = s.seasons.flatMap((se) => se.episodes).filter((e) => e.monitored);
    if (monitored.length > 0 && monitored.every((e) => e.status === "upcoming")) return "upcoming";
    if (monitored.some((e) => e.status === "downloading")) return "downloading";
    if (monitored.some((e) => e.status === "searching")) return "searching";
    // "Complete" when everything left is only scheduled (TBA/future dates).
    if (monitored.length > 0 && monitored.every((e) => e.status === "available" || e.status === "upcoming")) return "available";
    return "missing";
  };
  const seriesItems = useMemo(
    () => (type === "movie" ? [] : series.filter((s) => (filter === "all" || seriesStatus(s) === filter) && (!tagFilter || (s.tags ?? []).includes(tagFilter)))),
    [series, filter, type, tagFilter]
  );

  // When "Tout" mixes movies and series, they must be sorted TOGETHER — every
  // sort mode, not just alphabetical — instead of each type being sorted on
  // its own and simply concatenated (which always put every movie before
  // every series, alphabetical order or not; sorting separately then
  // stitching the two lists together can never interleave them).
  type CombinedItem = { kind: "movie"; movie: LibraryMovie } | { kind: "series"; series: LibrarySeries };
  const combinedItems = useMemo(() => {
    const combined: CombinedItem[] = [
      ...movieItems.map((movie): CombinedItem => ({ kind: "movie", movie })),
      ...seriesItems.map((series): CombinedItem => ({ kind: "series", series })),
    ];
    const titleOf = (c: CombinedItem) => (c.kind === "movie" ? c.movie.title : c.series.title);
    const addedAtOf = (c: CombinedItem) => (c.kind === "movie" ? c.movie.addedAt : c.series.addedAt);
    const ratingOf = (c: CombinedItem) => (c.kind === "movie" ? c.movie.rating : c.series.rating);
    return sort === "recent"
      ? combined.sort((a, b) => addedAtOf(b) - addedAtOf(a))
      : sort === "rating"
        ? combined.sort((a, b) => ratingOf(b) - ratingOf(a))
        : combined.sort((a, b) => titleOf(a).localeCompare(titleOf(b)));
  }, [movieItems, seriesItems, sort]);

  const total = combinedItems.length;

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

  const visibleItems = combinedItems.slice(0, visibleCount);

  // One batch call for every card currently rendered — never per-card (see
  // useTitleArtworkBatch's own docs) — same 16:9 backdrop + logo resolution
  // Découverte/Tableau de bord use, so library cards share their exact look.
  const artworkRefs = useMemo<TitleArtworkRef[]>(
    () => visibleItems.map((entry) => entry.kind === "movie"
      ? { type: "movie" as const, tmdbId: entry.movie.tmdbId }
      : { type: "series" as const, tmdbId: entry.series.tmdbId }),
    [visibleItems]
  );
  const artworkByKey = useTitleArtworkBatch(artworkRefs, locale);

  const progressFor = (movie: LibraryMovie) =>
    movie.activeInfoHash ? torrents.find((t) => t.infoHash === movie.activeInfoHash) : null;

  return (
    <div>
      <div className="mb-4 space-y-3 rounded-2xl glass p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-ink">
            <Film className="h-4 w-4 text-brand-glow" />
            <span className="text-sm font-semibold">{total} {t("common.titles")}</span>
          </div>
          {user?.role === "admin" && (
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={searchMissing}
                disabled={searchingMissing}
                title={
                  searchMissingJob?.status === "queued"
                    ? t("library.searchMissingWaiting")
                    : searchingMissing && searchMissingJob && searchMissingJob.total > 1
                      ? `${searchMissingLabel} — ${searchMissingJob.current} / ${searchMissingJob.total}`
                      : searchMissingLabel
                }
                className="relative flex h-9 w-9 items-center justify-center rounded-lg glass-strong text-ink-soft transition-colors hover:text-ink disabled:opacity-50"
              >
                {searchingMissing ? <Loader2 className="h-4 w-4 animate-spin" /> : <SearchCheck className="h-4 w-4" />}
                {searchingMissing && searchMissingJob && searchMissingJob.total > 1 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full brand-gradient px-1 text-[9px] font-bold text-white">
                    {searchMissingJob.current}/{searchMissingJob.total}
                  </span>
                )}
              </button>
              <button
                onClick={rescan}
                disabled={rescanning}
                title={t("library.rescan")}
                className="flex h-9 w-9 items-center justify-center rounded-lg glass-strong text-ink-soft transition-colors hover:text-ink disabled:opacity-50"
              >
                {rescanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanSearch className="h-4 w-4" />}
              </button>
              <button
                onClick={() => setSearchAndReplaceOpen(true)}
                title={t("library.searchAndReplace")}
                className="flex h-9 w-9 items-center justify-center rounded-lg glass-strong text-ink-soft transition-colors hover:text-ink"
              >
                <RefreshCw className="h-4 w-4" />
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
                    <span className={cn("shrink-0 rounded-full px-2 py-0.5 font-semibold", issue.kind === "missing" ? "bg-down/12 text-down" : issue.kind === "duplicate" ? "bg-cyan/12 text-cyan" : "bg-amber/12 text-amber")}>
                      {issue.kind === "missing" ? t("library.fileMissing") : issue.kind === "duplicate" ? t("library.duplicateMerged") : t("library.untrackedFile")}
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
          {fixedType === "all" ? (
            <div className="flex flex-wrap gap-1.5">
              {TYPES.map((tp) => {
                const active = tp.id === "all" ? pathname === "/library" : pathname.startsWith(tp.href);
                return (
                  <Link
                    key={tp.id}
                    href={tp.href}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                      active ? "brand-gradient text-white shadow-lg" : "glass-strong text-ink-soft hover:text-ink"
                    )}
                  >
                    {t(tp.key)}
                  </Link>
                );
              })}
            </div>
          ) : (
            <div />
          )}
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
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
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

      <AnimatePresence mode="sync">
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {visibleItems.map((entry, i) => {
            const art = entry.kind === "movie" ? artworkByKey[`movie:${entry.movie.tmdbId}`] : artworkByKey[`series:${entry.series.tmdbId}`];
            return entry.kind === "movie" ? (
              <LibraryMovieCard
                key={entry.movie.id}
                index={i}
                movie={entry.movie}
                torrent={progressFor(entry.movie)}
                watched={watchedMovies.has(entry.movie.tmdbId)}
                onChange={refresh}
                backdropPath={art?.backdropPath}
                logoPath={art?.logoPath}
                titleEmbedded={art?.titleEmbedded}
              />
            ) : (
              <LibrarySeriesCard
                key={entry.series.id}
                index={i}
                series={entry.series}
                onChange={refresh}
                backdropPath={art?.backdropPath}
                logoPath={art?.logoPath}
                titleEmbedded={art?.titleEmbedded}
              />
            );
          })}
        </div>
      </AnimatePresence>

      {visibleCount < total && <div ref={sentinelRef} className="h-1" />}

      {loading && total === 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {[...Array(12)].map((_, i) => (
            <div key={i}>
              <div className="aspect-video animate-pulse rounded-2xl bg-white/6" />
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