"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/ui/PageHeader";
import { useT, useI18n } from "@/i18n/provider";
import { cn, formatDate } from "@/lib/utils";
import { useShouldReduceMotion } from "@/lib/motion/useReduceMotion";
import type { MetaSearchResult } from "@/lib/metadata/types";
import type { MetaGenre } from "@/lib/metadata/tmdb";
import { GENRE_GRADIENTS } from "@/lib/metadata/curated";
import {
  Search, Plus, Check, Loader2, Star, Film, Tv, KeyRound, X, ChevronRight, Calendar, Clock,
} from "lucide-react";

const SORT_OPTIONS = ["popularity.desc", "vote_average.desc", "primary_release_date.desc"] as const;

interface LogoTile {
  id: number;
  name: string;
  logoPath: string | null;
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={null}>
      <DiscoverPageInner />
    </Suspense>
  );
}

function DiscoverPageInner() {
  const t = useT();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState(() => searchParams.get("q") ?? "");
  const [mediaType, setMediaType] = useState<"movie" | "series">(() => (searchParams.get("type") as "series" | null) ?? "movie");
  const [genre, setGenre] = useState(() => searchParams.get("genre") ?? "");
  const [year, setYear] = useState(() => searchParams.get("year") ?? "");
  const [sort, setSort] = useState<(typeof SORT_OPTIONS)[number]>(() => (searchParams.get("sort") as (typeof SORT_OPTIONS)[number] | null) ?? "popularity.desc");
  const [company, setCompany] = useState<{ id: string; name: string } | null>(() => {
    const id = searchParams.get("company");
    const name = searchParams.get("companyName");
    return id && name ? { id, name } : null;
  });
  const [network, setNetwork] = useState<{ id: string; name: string } | null>(() => {
    const id = searchParams.get("network");
    const name = searchParams.get("networkName");
    return id && name ? { id, name } : null;
  });
  const [rowCategory, setRowCategory] = useState<string | null>(() => searchParams.get("row") ?? null);

  // Browse view — paginated grid, used for search and any active filter/tile selection.
  const [results, setResults] = useState<MetaSearchResult[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const isBrowsing = !!q.trim() || !!genre || !!year || sort !== "popularity.desc" || !!company || !!network || !!rowCategory;
  const sentinelRef = useRef<HTMLDivElement>(null);
  const restoredRef = useRef(false);

  const saveBrowseState = () => {
    if (!isBrowsing || results.length === 0) return;
    sessionStorage.setItem("movviz_browse", JSON.stringify({
      results, page, totalPages, rowCategory, mediaType,
      q, genre, year, sort, company, network,
      scrollY: window.scrollY,
    }));
  };

  // Restore scroll state on mount (back from a title page).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem("movviz_browse");
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved.mediaType !== mediaType) return;
      // Restore filters first so isBrowsing is true and the load trigger fires
      if (saved.q) setQ(saved.q);
      if (saved.genre) setGenre(saved.genre);
      if (saved.year) setYear(saved.year);
      if (saved.sort) setSort(saved.sort);
      if (saved.company?.id) setCompany(saved.company);
      if (saved.network?.id) setNetwork(saved.network);
      if (saved.rowCategory) setRowCategory(saved.rowCategory);
      if (saved.results) setResults(saved.results);
      if (saved.page) setPage(saved.page);
      if (saved.totalPages) setTotalPages(saved.totalPages);
      restoredRef.current = true;
      // Scroll and clear after state settles
      requestAnimationFrame(() => {
        window.scrollTo(0, saved.scrollY ?? 0);
        sessionStorage.removeItem("movviz_browse");
      });
    } catch { /* ignore corrupt state */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save state on unmount (SPA navigation away) and on popstate (back button).
  useEffect(() => {
    saveBrowseState();
    const onPop = () => saveBrowseState();
    window.addEventListener("popstate", onPop);
    return () => {
      saveBrowseState();
      window.removeEventListener("popstate", onPop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, page, totalPages, rowCategory, mediaType, q, genre, year, sort, company, network, isBrowsing]);

  // Save scroll state + set flag before any navigation to a title page
  const saveRef = useRef(saveBrowseState);
  saveRef.current = saveBrowseState;
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest("a");
      if (link?.getAttribute("href")?.startsWith("/title/")) {
        saveRef.current();
        sessionStorage.setItem("movviz_from", "discover");
      }
    };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  // Sync filter states to URL for back-button support (immediate for non-q filters, q cleanup).
  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString());
    if (!q.trim()) p.delete("q");
    if (mediaType !== "movie") p.set("type", mediaType); else p.delete("type");
    if (genre) p.set("genre", genre); else p.delete("genre");
    if (year) p.set("year", year); else p.delete("year");
    if (sort !== "popularity.desc") p.set("sort", sort); else p.delete("sort");
    if (company) { p.set("company", company.id); p.set("companyName", company.name); } else { p.delete("company"); p.delete("companyName"); }
    if (network) { p.set("network", network.id); p.set("networkName", network.name); } else { p.delete("network"); p.delete("networkName"); }
    if (rowCategory) p.set("row", rowCategory); else p.delete("row");
    const qs = p.toString();
    if (qs !== searchParams.toString()) {
      router.push(pathname + (qs ? "?" + qs : ""), { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, mediaType, genre, year, sort, company, network, rowCategory, router, pathname]);

  // Every fetch below is SWR-cached by URL — instant render from whatever was
  // last seen for that key (even by another page, e.g. Bibliothèque already
  // having populated /api/library/movies) instead of a blank home screen on
  // every visit, with a background revalidate keeping it current.
  const { data: keyData, mutate: mutateConfigured } = useSWR<{ configured: boolean }>("/api/metadata/key");
  const configured = keyData?.configured ?? null;

  const { data: moviesData } = useSWR<{ movies: { tmdbId: number; status: string; activeInfoHash: string | null }[] }>(
    configured ? "/api/library/movies" : null
  );
  const { data: seriesData } = useSWR<{ series: { tmdbId: number; seasons: { episodes: { status: string; activeInfoHash: string | null; monitored: boolean }[] }[] }[] }>(
    configured ? "/api/library/series" : null
  );
  const [libStatus, setLibStatus] = useState<Map<string, string>>(new Map());
  const [libLoaded, setLibLoaded] = useState(false);
  useEffect(() => {
    if (!moviesData && !seriesData) return;
    const m = new Map<string, string>();
    if (moviesData) {
      for (const x of moviesData.movies) {
        const st = x.activeInfoHash ? "downloading" : x.status;
        m.set(`movie:${x.tmdbId}`, st);
      }
    }
    if (seriesData) {
      for (const x of seriesData.series) {
        const eps = x.seasons.flatMap((s) => s.episodes);
        const monitored = eps.filter((e) => e.monitored);
        if (monitored.length === 0) { m.set(`series:${x.tmdbId}`, "missing"); continue; }
        const anyBusy = monitored.some((e) => e.status === "downloading" || e.status === "searching" || e.activeInfoHash);
        if (anyBusy) { m.set(`series:${x.tmdbId}`, "downloading"); continue; }
        const allAvailable = monitored.every((e) => e.status === "available");
        m.set(`series:${x.tmdbId}`, allAvailable ? "available" : "missing");
      }
    }
    setLibStatus(m);
    if (!libLoaded) setLibLoaded(true);
  }, [moviesData, seriesData, libLoaded]);

  const { data: watchStatusData } = useSWR<{ movies: number[]; episodes: { tmdbId: number; season: number; episode: number }[] }>(
    configured ? "/api/watch-status" : null
  );
  const watchedSet = new Set(watchStatusData?.movies ?? []);

  const clearFilters = () => {
    setQ("");
    setGenre("");
    setYear("");
    setSort("popularity.desc");
    setCompany(null);
    setNetwork(null);
    setRowCategory(null);
  };

  const seeAllRow = (key: string) => {
    setQ("");
    setGenre("");
    setYear("");
    setSort("popularity.desc");
    setCompany(null);
    setNetwork(null);
    setRowCategory(key);
  };

  // Genres are media-type-specific and reload on every Films/Séries switch.
  const { data: genresData } = useSWR<{ genres: MetaGenre[] }>(
    configured ? `/api/metadata/genres?type=${mediaType}` : null
  );
  const genres = genresData?.genres ?? [];

  // Studio and network tiles are both shown at all times (not tied to the
  // active Films/Séries tab).
  const { data: companyData } = useSWR<{ tiles: LogoTile[] }>(configured ? "/api/metadata/logos?kind=company" : null);
  const { data: networkData } = useSWR<{ tiles: LogoTile[] }>(configured ? "/api/metadata/logos?kind=network" : null);
  const companyTiles = companyData?.tiles ?? [];
  const networkTiles = networkData?.tiles ?? [];

  // Manual Films/Séries switch — start browsing that type from a clean filter state.
  const switchMediaType = (mt: "movie" | "series") => {
    setQ("");
    setGenre("");
    setYear("");
    setSort("popularity.desc");
    setCompany(null);
    setNetwork(null);
    setRowCategory(null);
    setMediaType(mt);
  };

  // Home rows — fetched whenever no filter/search is active.
  const { data: rowsData, isLoading: rowsLoading } = useSWR<{ rows: { key: string; results: MetaSearchResult[]; ranked?: boolean }[] }>(
    configured && !isBrowsing ? `/api/metadata/rows?type=${mediaType}` : null
  );
  const rows = rowsData?.rows ?? [];

  // Browse grid — search (debounced) or any filter/tile/row selection, page 1.
  useEffect(() => {
    if (!configured || !isBrowsing) return;
    const id = setTimeout(() => {
      loadPage(1);
      // Sync q to URL after debounce.
      const p = new URLSearchParams(searchParams.toString());
      if (q.trim()) p.set("q", q.trim()); else p.delete("q");
      const qs = p.toString();
      if (qs !== searchParams.toString()) {
        router.push(pathname + (qs ? "?" + qs : ""), { scroll: false });
      }
    }, q.trim() ? 350 : 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured, isBrowsing, q, mediaType, genre, year, sort, company, network, rowCategory]);

  const loadPage = async (targetPage: number) => {
    if (targetPage === 1) setLoading(true); else setLoadingMore(true);
    try {
      let url: string;
      if (rowCategory) {
        url = `/api/metadata/row-page?type=${mediaType}&key=${rowCategory}&page=${targetPage}`;
      } else if (q.trim()) {
        url = `/api/metadata/search?q=${encodeURIComponent(q)}&page=${targetPage}&type=${mediaType}`;
      } else {
        const params = new URLSearchParams({ type: mediaType, page: String(targetPage) });
        if (genre) params.set("genre", genre);
        if (year) params.set("year", year);
        if (sort) params.set("sort", sort);
        if (company) params.set("company", company.id);
        if (network) params.set("network", network.id);
        url = `/api/metadata/discover?${params.toString()}`;
      }
      const res = await fetch(url, { cache: "no-store" });
      const d = res.ok ? await res.json() : { results: [] };
      const raw: MetaSearchResult[] = Array.isArray(d.results) ? d.results : [];
      const list: MetaSearchResult[] = rowCategory || q.trim() ? raw : raw.map((r: MetaSearchResult) => ({ ...r, type: mediaType }));
      setResults((prev) => (targetPage === 1 ? list : [...prev, ...list]));
      setPage(d.page ?? targetPage);
      setTotalPages(d.totalPages ?? 0);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Infinite scroll for the browse grid.
  useEffect(() => {
    if (!isBrowsing) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loading && !loadingMore && page < totalPages) {
        loadPage(page + 1);
      }
    }, { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBrowsing, loading, loadingMore, page, totalPages]);

  const rowLabel = (key: string) => {
    switch (key) {
      case "recommended": return t("discover.rowRecommended");
      case "trending": return t("discover.trending");
      case "popular": return t("discover.rowPopular");
      case "topRated": return t("discover.rowTopRated");
      case "upcoming": return t("discover.rowUpcoming");
      case "onAir": return t("discover.rowOnAir");
      case "newVod": return t("discover.rowNewVod");
      case "nowPlaying": return t("discover.rowNowPlaying");
      case "boxOffice": return t("discover.rowBoxOffice");
      case "kids": return t("discover.rowKids");
      case "newSeries": return t("discover.rowNewSeries");
      case "renewed": return t("discover.rowRenewed");
      default: return key;
    }
  };

  return (
    <div className="mx-auto max-w-[1500px] space-y-8">
      <PageHeader eyebrow={t("discover.eyebrow")} title={t("discover.title")} description={t("discover.description")}>
        {configured && (
          <div className="flex gap-1.5">
            {(["movie", "series"] as const).map((mt) => (
              <button
                key={mt}
                onClick={() => switchMediaType(mt)}
                className={cn(
                  "rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
                  mediaType === mt ? "brand-gradient text-white" : "glass text-ink-soft hover:text-ink"
                )}
              >
                {mt === "movie" ? t("common.movies") : t("common.series")}
              </button>
            ))}
          </div>
        )}
      </PageHeader>

      {configured === false && (
        <TmdbSetup onSaved={() => mutateConfigured()} />
      )}

      {configured && (
        <>
          <div className="flex items-center gap-3 rounded-2xl glass px-5">
            <Search className="h-5 w-5 text-ink-dim" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("discover.searchPlaceholder")}
              className="h-14 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-dim"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="h-10 rounded-xl glass px-3 text-sm text-ink outline-none"
            >
              <option value="">{t("common.all")}</option>
              {genres.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
            <input
              value={year}
              onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder={t("common.filterTitles")}
              inputMode="numeric"
              className="h-10 w-24 rounded-xl glass px-3 text-sm text-ink outline-none placeholder:text-ink-dim"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="h-10 rounded-xl glass px-3 text-sm text-ink outline-none"
            >
              <option value="popularity.desc">{t("discover.trending")}</option>
              <option value="vote_average.desc">{t("discover.sortTopRated")}</option>
              <option value="primary_release_date.desc">{t("discover.sortNewest")}</option>
            </select>
            {company && (
              <FilterChip label={company.name} onClear={() => setCompany(null)} />
            )}
            {network && (
              <FilterChip label={network.name} onClear={() => setNetwork(null)} />
            )}
            {rowCategory && (
              <FilterChip label={rowLabel(rowCategory)} onClear={() => setRowCategory(null)} />
            )}
            {isBrowsing && (
              <button
                onClick={clearFilters}
                className="flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-ink-dim hover:text-ink"
              >
                <X className="h-3.5 w-3.5" /> {t("common.reset")}
              </button>
            )}
          </div>

          {!isBrowsing && (
            <HomeRows
              rows={rows}
              loading={rowsLoading}
              genres={genres}
              companyTiles={companyTiles}
              networkTiles={networkTiles}
              libStatus={libStatus}
              libLoaded={libLoaded}
              watchedSet={watchedSet}
              onAdded={(key) => setLibStatus((m) => new Map(m).set(key, "missing"))}
              rowLabel={rowLabel}
              onSeeAll={seeAllRow}
              onGenreClick={(g) => setGenre(String(g.id))}
              onCompanyClick={(tile) => {
                setMediaType("movie");
                setCompany({ id: String(tile.id), name: tile.name });
              }}
              onNetworkClick={(tile) => {
                setMediaType("series");
                setNetwork({ id: String(tile.id), name: tile.name });
              }}
            />
          )}

          {isBrowsing && (
            <>
              {loading && page === 1 && (
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

              {!loading && results.length === 0 && (
                <div className="rounded-2xl glass py-16 text-center text-sm text-ink-dim">{t("discover.noResults")}</div>
              )}

              {results.length > 0 && (
                <>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
                    {results.map((r, i) => (
                      <DiscoverCard
                        key={`${r.type}:${r.tmdbId}`}
                        index={i}
                        result={r}
                        status={libLoaded ? (libStatus.get(`${r.type}:${r.tmdbId}`) ?? null) : null}
                        libLoaded={libLoaded}
                        watched={watchedSet.has(r.tmdbId) && r.type === "movie"}
                        onAdded={() => setLibStatus((m) => new Map(m).set(`${r.type}:${r.tmdbId}`, "missing"))}
                      />
                    ))}
                  </div>
                  <div ref={sentinelRef} className="flex items-center justify-center py-8">
                    {loadingMore && <Loader2 className="h-5 w-5 animate-spin text-ink-dim" />}
                    {!loadingMore && page < totalPages && (
                      <button
                        onClick={() => loadPage(page + 1)}
                        className="rounded-xl glass px-5 py-2.5 text-sm font-semibold text-ink-soft hover:text-ink"
                      >
                        {t("discover.loadMore")}
                      </button>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function FilterChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <button
      onClick={onClear}
      className="flex h-10 items-center gap-1.5 rounded-xl brand-gradient px-3 text-sm font-semibold text-white"
    >
      {label} <X className="h-3.5 w-3.5" />
    </button>
  );
}

function HomeRows({
  rows, loading, genres, companyTiles, networkTiles, libStatus, libLoaded, watchedSet, onAdded, rowLabel, onSeeAll, onGenreClick, onCompanyClick, onNetworkClick,
}: {
  rows: { key: string; results: MetaSearchResult[]; ranked?: boolean }[];
  loading: boolean;
  genres: MetaGenre[];
  companyTiles: LogoTile[];
  networkTiles: LogoTile[];
  libStatus: Map<string, string>;
  libLoaded: boolean;
  watchedSet: Set<number>;
  onAdded: (key: string) => void;
  rowLabel: (key: string) => string;
  onSeeAll: (key: string) => void;
  onGenreClick: (g: MetaGenre) => void;
  onCompanyClick: (tile: LogoTile) => void;
  onNetworkClick: (tile: LogoTile) => void;
}) {
  const t = useT();

  if (loading && rows.length === 0) {
    return (
      <div className="space-y-9">
        {[...Array(4)].map((_, i) => (
          <section key={i} className="space-y-3">
            <div className="h-6 w-48 animate-pulse rounded-lg bg-white/8" />
            <div className="flex gap-4 overflow-hidden">
              {[...Array(6)].map((_, j) => (
                <div key={j} className="w-[150px] shrink-0 sm:w-[170px]">
                  <div className="aspect-[2/3] animate-pulse rounded-2xl bg-white/6" />
                  <div className="mt-2.5 h-3 w-24 animate-pulse rounded bg-white/8" />
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-9">
      {rows.map((row) =>
        row.ranked ? (
          <RankedList
            key={row.key}
            title={rowLabel(row.key)}
            results={row.results}
            libStatus={libStatus}
            libLoaded={libLoaded}
            watchedSet={watchedSet}
            onAdded={onAdded}
            onSeeAll={() => onSeeAll(row.key)}
          />
        ) : (
          <PosterRow
            key={row.key}
            title={rowLabel(row.key)}
            results={row.results}
            libStatus={libStatus}
            libLoaded={libLoaded}
            watchedSet={watchedSet}
            onAdded={onAdded}
            onSeeAll={() => onSeeAll(row.key)}
          />
        )
      )}

      {genres.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold tracking-tight text-ink">{t("discover.genres")}</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {genres.map((g, i) => (
              <button
                key={g.id}
                onClick={() => onGenreClick(g)}
                className={cn(
                  "flex h-24 w-48 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br px-4 text-center text-lg font-black text-white shadow-lg transition-transform hover:scale-[1.03]",
                  GENRE_GRADIENTS[i % GENRE_GRADIENTS.length]
                )}
              >
                {g.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {companyTiles.length > 0 && (
        <LogoRow title={t("discover.studios")} tiles={companyTiles} onClick={onCompanyClick} />
      )}

      {networkTiles.length > 0 && (
        <LogoRow title={t("discover.networks")} tiles={networkTiles} onClick={onNetworkClick} />
      )}
    </div>
  );
}

function LogoRow({ title, tiles, onClick }: { title: string; tiles: LogoTile[]; onClick: (tile: LogoTile) => void }) {
  return (
    <section className="space-y-3">
      <h2 className="text-base sm:text-lg font-bold tracking-tight text-ink">{title}</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {tiles.map((tile) => (
          <button
            key={tile.id}
            onClick={() => onClick(tile)}
            className="flex h-24 w-48 shrink-0 items-center justify-center rounded-2xl glass p-4 transition-transform hover:scale-[1.03] hover:border-brand/40"
          >
            {tile.logoPath ? (
              <div className="flex h-full w-full items-center justify-center rounded-xl bg-white/95 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://image.tmdb.org/t/p/w300${tile.logoPath}`}
                  alt={tile.name}
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <span className="text-center text-sm font-bold text-ink">{tile.name}</span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

function PosterRow({
  title, results, libStatus, libLoaded, watchedSet, onAdded, onSeeAll,
}: {
  title: string;
  results: MetaSearchResult[];
  libStatus: Map<string, string>;
  libLoaded: boolean;
  watchedSet: Set<number>;
  onAdded: (key: string) => void;
  onSeeAll: () => void;
}) {
  const t = useT();
  if (results.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base sm:text-lg font-bold tracking-tight text-ink">{title}</h2>
        <button onClick={onSeeAll} className="flex items-center gap-1 text-sm font-semibold text-brand-glow hover:text-brand-2 transition-colors">
          {t("discover.seeAll")} <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {results.map((r, i) => (
          <div key={`${r.type}:${r.tmdbId}`} className="w-[150px] shrink-0 sm:w-[170px]">
            <DiscoverCard
              index={i}
              result={r}
              status={libLoaded ? (libStatus.get(`${r.type}:${r.tmdbId}`) ?? null) : null}
              libLoaded={libLoaded}
              watched={watchedSet.has(r.tmdbId) && r.type === "movie"}
              onAdded={() => onAdded(`${r.type}:${r.tmdbId}`)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function TmdbSetup({ onSaved }: { onSaved: () => void }) {
  const t = useT();
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!key.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/metadata/key", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: key.trim() }),
      });
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 rounded-2xl glass py-16 text-center">
      <KeyRound className="h-8 w-8 text-brand-glow" />
      <p className="font-semibold text-ink">{t("discover.tmdbSetupTitle")}</p>
      <p className="max-w-md text-sm text-ink-dim">{t("discover.tmdbSetupHint")}</p>
      <div className="flex flex-col sm:flex-row w-full max-w-sm gap-2">
        <input
          value={key}
          onChange={(e) => setKey(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
          placeholder={t("discover.tmdbKeyPlaceholder")}
          className="h-11 flex-1 rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40"
        />
        <button
          onClick={save}
          disabled={saving || !key.trim()}
          className="flex h-11 items-center justify-center gap-2 rounded-xl brand-gradient px-5 text-sm font-bold text-white disabled:opacity-40 whitespace-nowrap"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("discover.saveKey")}
        </button>
      </div>
    </div>
  );
}

/** Allociné-style "Top de la semaine" — a numbered ranked list instead of a poster carousel. */
function RankedList({
  title, results, libStatus, libLoaded, watchedSet, onAdded, onSeeAll,
}: {
  title: string;
  results: MetaSearchResult[];
  libStatus: Map<string, string>;
  libLoaded: boolean;
  watchedSet: Set<number>;
  onAdded: (key: string) => void;
  onSeeAll: () => void;
}) {
  const t = useT();
  if (results.length === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base sm:text-lg font-bold tracking-tight text-ink">{title}</h2>
        <button onClick={onSeeAll} className="flex items-center gap-1 text-sm font-semibold text-brand-glow hover:text-brand-2 transition-colors">
          {t("discover.seeAll")} <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {results.map((r, i) => (
          <RankedRow
            key={`${r.type}:${r.tmdbId}`}
            rank={i + 1}
            result={r}
            status={libLoaded ? (libStatus.get(`${r.type}:${r.tmdbId}`) ?? null) : null}
            libLoaded={libLoaded}
            watched={watchedSet.has(r.tmdbId) && r.type === "movie"}
            onAdded={() => onAdded(`${r.type}:${r.tmdbId}`)}
          />
        ))}
      </div>
    </section>
  );
}

function RankedRow({ rank, result, status, libLoaded, watched, onAdded }: { rank: number; result: MetaSearchResult; status: string | null; libLoaded: boolean; watched: boolean; onAdded: () => void }) {
  const t = useT();
  const [adding, setAdding] = useState(false);
  const poster = result.posterPath ? `https://image.tmdb.org/t/p/w92${result.posterPath}` : null;
  const inLib = !!status;

  const StatusIcon = status === "available" ? Check : status === "downloading" ? Loader2 : status === "missing" ? Clock : null;
  const isBusy = status === "downloading";

  const add = async (e: React.MouseEvent) => {
    e.preventDefault();
    setAdding(true);
    try {
      const endpoint = result.type === "movie" ? "/api/library/movies" : "/api/library/series";
      await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tmdbId: result.tmdbId }) });
      onAdded();
    } finally {
      setAdding(false);
    }
  };

  return (
    <Link href={`/title/${result.type}/${result.tmdbId}`} className="flex items-center gap-3 rounded-xl glass px-3 py-2 transition-colors hover:bg-white/5">
      <span className="w-6 shrink-0 text-center text-lg font-black text-ink-dim">{rank}</span>
      <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded-lg bg-surface">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt={result.title} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            {result.type === "movie" ? <Film className="h-4 w-4 text-ink-soft/50" /> : <Tv className="h-4 w-4 text-ink-soft/50" />}
          </div>
        )}
        {watched && (
          <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 text-center text-[9px] font-bold text-white leading-4">Vu</div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">{result.title}</p>
        <span className="flex items-center gap-1 text-xs text-amber"><Star className="h-3 w-3 fill-amber" /> {result.rating.toFixed(1)}</span>
      </div>
      <button
        onClick={add}
        disabled={adding || inLib}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold",
          inLib ? "bg-ok/20 text-ok" : "brand-gradient text-white"
        )}
        title={inLib ? t("discover.added") : t("discover.addToLibrary")}
      >
        {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : StatusIcon ? <StatusIcon className={cn("h-3.5 w-3.5", isBusy && "animate-spin")} /> : <Plus className="h-3.5 w-3.5" />}
      </button>
    </Link>
  );
}

function DiscoverCard({
  result, status, libLoaded, watched, onAdded, index = 0,
}: {
  result: MetaSearchResult;
  status: string | null;
  libLoaded: boolean;
  watched: boolean;
  onAdded: () => void;
  index?: number;
}) {
  const { t, locale } = useI18n();
  const reduceMotion = useShouldReduceMotion();
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  const add = async () => {
    setAdding(true);
    setFeedback(t("discover.searchingRelease"));
    try {
      const endpoint = result.type === "movie" ? "/api/library/movies" : "/api/library/series";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tmdbId: result.tmdbId }),
      });
      const data = await res.json();
      if (data.blocked) { setFeedback(t("blocklist.blockedMessage")); return; }
      if (data.duplicateRequest) { setFeedback(t("requests.alreadyPending")); return; }
      onAdded();
      if (data.searchResult?.ok) setFeedback(null);
      else if (data.searchResult?.error) setFeedback(t("discover.noRelease"));
      else setFeedback(null);
    } finally {
      setAdding(false);
    }
  };

  const poster = result.posterPath ? `https://image.tmdb.org/t/p/w500${result.posterPath}` : null;

  const cascadeAnim = reduceMotion ? {} : {
    initial: { opacity: 0, y: 20, scale: 0.95 },
    animate: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: 0.3, delay: Math.min(index * 0.05, 0.5) },
    whileHover: { scale: 1.03, y: -2, boxShadow: "0 0 25px rgba(168, 130, 255, 0.15)" },
    whileTap: { scale: 0.98 },
    style: { willChange: "transform" } as React.CSSProperties,
  };
  const btnSpring = reduceMotion ? {} : {
    whileTap: { scale: 0.95 },
    transition: { type: "spring" as const, stiffness: 400, damping: 17 },
  };

  return (
    <motion.article className="group w-full" {...cascadeAnim}>
      <Link href={`/title/${result.type}/${result.tmdbId}`} className="relative block aspect-[2/3] overflow-hidden rounded-2xl border border-white/5 bg-surface">
        {poster ? (
          <motion.img
            src={poster}
            alt={result.title}
            loading="lazy"
            className="h-full w-full object-cover"
            initial={reduceMotion ? undefined : { opacity: 0 }}
            animate={reduceMotion ? undefined : { opacity: imgLoaded ? 1 : 0 }}
            transition={{ duration: 0.4 }}
            onLoad={() => setImgLoaded(true)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center">
            {result.type === "movie" ? <Film className="h-7 w-7 text-ink-soft/70" /> : <Tv className="h-7 w-7 text-ink-soft/70" />}
            <span className="line-clamp-3 text-sm font-semibold text-ink/90">{result.title}</span>
          </div>
        )}
        <div className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[11px] font-bold backdrop-blur">
          {watched ? <Check className="h-3 w-3 text-ok" /> : <Star className="h-3 w-3 fill-amber text-amber" />}
          {watched ? (<span className="text-ok">Vu</span>) : result.rating.toFixed(1)}
        </div>
        {status === "downloading" && (
          <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-full bg-purple-500/90 px-2 py-1 text-[11px] font-bold text-white backdrop-blur">
            <Loader2 className="h-3 w-3 animate-spin" />
          </div>
        )}
        {status === "available" && libLoaded && (
          <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-full bg-ok/90 px-2 py-1 text-[11px] font-bold text-white backdrop-blur">
            <Check className="h-3 w-3" />
          </div>
        )}
        {status === "missing" && libLoaded && (
          <div className="pointer-events-none absolute right-2 top-2 flex items-center gap-1 rounded-full bg-amber/80 px-2 py-1 text-[11px] font-bold text-white backdrop-blur">
            <Clock className="h-3 w-3" />
          </div>
        )}
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/10 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <motion.button
            {...btnSpring}
            onClick={(e) => { e.preventDefault(); add(); }}
            disabled={adding || !!status}
            className={cn(
              "flex h-9 items-center justify-center gap-1.5 rounded-xl text-xs font-bold",
              status ? "bg-ok/20 text-ok" : "brand-gradient text-white"
            )}
          >
            {adding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : status ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {status ? t("discover.added") : adding ? t("discover.adding") : t("discover.addToLibrary")}
          </motion.button>
        </div>
      </Link>
      <div className="mt-2.5 px-0.5">
        <Link href={`/title/${result.type}/${result.tmdbId}`} className="block truncate text-sm font-semibold text-ink transition-all duration-200 hover:text-brand-glow">{result.title}</Link>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-dim">
          {formatDate(result.releaseDate, locale) ? (
            <span className="flex items-center gap-1">
              <Calendar className="h-2.5 w-2.5" /> {formatDate(result.releaseDate, locale)}
            </span>
          ) : (
            <span>{result.year ?? "—"}</span>
          )}
          {feedback && <span className="truncate text-amber">{feedback}</span>}
        </div>
      </div>
    </motion.article>
  );
}
