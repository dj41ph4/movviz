"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/ui/PageHeader";
import { useT, useI18n } from "@/i18n/provider";
import { cn, formatDate } from "@/lib/utils";
import { useShouldReduceMotion } from "@/lib/motion/useReduceMotion";
import { useInterfaceDataMode } from "@/lib/settings/useInterfaceDataMode";
import { useTitlePanel } from "@/components/title/useTitlePanel";
import { PosterRow as SharedPosterRow } from "@/components/media/PosterRow";
import { TitleMark } from "@/components/media/TitleMark";
import { useTitleArtworkBatch, type TitleArtworkByKey } from "@/components/media/useTitleArtworkBatch";
import { DashboardPosterCard } from "@/components/dashboard/DashboardPosterCard";
import { TmdbImage } from "@/components/media/TmdbImage";
import type { MetaSearchResult, MetaPersonSearchResult } from "@/lib/metadata/types";
import { daysUntil } from "@/lib/library/releaseSchedule";
import type { MetaGenre } from "@/lib/metadata/tmdb";
import { ANIME_GENRE_ID, TEEN_GENRE_ID } from "@/lib/metadata/genreTaxonomy";
import type { DashboardLayout } from "@/lib/dashboard/types";
import {
  Search, Plus, Check, Loader2, Star, Film, Tv, KeyRound, X, ChevronRight, ChevronDown, Calendar, Clock, CalendarCheck, Info,
} from "lucide-react";

const SORT_OPTIONS = ["popularity.desc", "vote_average.desc", "primary_release_date.desc"] as const;

interface LogoTile {
  id: number;
  name: string;
  logoPath: string | null;
}

/** Carried by a "becauseYouWatched:{id}" row so its label can be interpolated
 *  client-side — the API stays locale-agnostic, see becauseYouWatched.ts. */
interface RowMeta {
  anchorTmdbId: number;
  anchorTitle: string;
  verb: "watched" | "liked";
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
  const { locale } = useI18n();
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
  const [rowCategory, setRowCategory] = useState<string | null>(() => searchParams.get("row") ?? null);
  // Only meaningful when rowCategory is a "becauseYouWatched:*" key — filled
  // either from the clicked row's own `meta` (seeAllRow) or, when the page
  // loads directly on a `?row=becauseYouWatched:...` URL with no click ever
  // happening, from the first row-page response's `meta` (see loadPage).
  const [rowCategoryMeta, setRowCategoryMeta] = useState<RowMeta | undefined>(undefined);
  // Unlike company, a TMDb watch-provider id is valid for BOTH movies and
  // series — this filter survives a Films/Séries tab switch instead of
  // being cleared with the rest. (The old "Diffuseurs"/TV-network filter —
  // literally the same streaming brands, series-only — was removed as a
  // pure duplicate of this once watchProvider existed.)
  const [watchProvider, setWatchProvider] = useState<{ id: string; name: string } | null>(() => {
    const id = searchParams.get("watchProvider");
    const name = searchParams.get("watchProviderName");
    return id && name ? { id, name } : null;
  });
  const [genreMenuOpen, setGenreMenuOpen] = useState(false);
  const genreMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!genreMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (genreMenuRef.current && !genreMenuRef.current.contains(e.target as Node)) setGenreMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setGenreMenuOpen(false); };
    document.addEventListener("mousedown", onClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [genreMenuOpen]);

  // Browse view — paginated grid, used for search and any active filter/tile selection.
  const [results, setResults] = useState<MetaSearchResult[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filtre post-search Tout/Films/Séries + tri connu/récent
  const [searchFilter, setSearchFilter] = useState<"all" | "movie" | "series">("all");
  const [searchSort, setSearchSort] = useState<"relevance" | "popularity" | "recent" | "rating">("relevance");

  // Acteurs/réalisateurs — only meaningful for a real text search (q), never
  // for genre/year/company/etc. filters, and shown as its own row above the
  // movie/series grid rather than mixed into it (a person doesn't fit
  // DiscoverCard's "add to library" shape at all).
  const [personResults, setPersonResults] = useState<MetaPersonSearchResult[]>([]);

  const isBrowsing = !!q.trim() || !!genre || !!year || sort !== "popularity.desc" || !!company || !!watchProvider || !!rowCategory;
  const sentinelRef = useRef<HTMLDivElement>(null);

  // Panel titre coulissant (remplace la navigation vers /title/...) — partagé
  // avec Bibliothèque/Collection/Calendrier via useTitlePanel().
  const { titlePanel } = useTitlePanel();

  // Sync filter states to URL for back-button support (immediate for non-q filters, q cleanup).
  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString());
    if (!q.trim()) p.delete("q");
    if (mediaType !== "movie") p.set("type", mediaType); else p.delete("type");
    if (genre) p.set("genre", genre); else p.delete("genre");
    if (year) p.set("year", year); else p.delete("year");
    if (sort !== "popularity.desc") p.set("sort", sort); else p.delete("sort");
    if (company) { p.set("company", company.id); p.set("companyName", company.name); } else { p.delete("company"); p.delete("companyName"); }
    if (watchProvider) { p.set("watchProvider", watchProvider.id); p.set("watchProviderName", watchProvider.name); } else { p.delete("watchProvider"); p.delete("watchProviderName"); }
    if (rowCategory) p.set("row", rowCategory); else p.delete("row");
    const qs = p.toString();
    if (qs !== searchParams.toString()) {
      router.push(pathname + (qs ? "?" + qs : ""), { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, mediaType, genre, year, sort, company, watchProvider, rowCategory, router, pathname]);

  // The search box now lives in the nav rail (Sidebar), not on this page —
  // typing there pushes a new `?q=` while this page is already mounted
  // (same route, so the `useState(() => searchParams.get("q") ?? "")`
  // above only ever ran once and would otherwise go stale). Mirrors the URL
  // back into local state; safe against the effect above re-firing since it
  // only pushes when `qs !== searchParams.toString()`, which is already
  // false once this effect has caught local state up to the URL.
  useEffect(() => {
    const urlQ = searchParams.get("q") ?? "";
    if (urlQ !== q) setQ(urlQ);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Every fetch below is SWR-cached by URL — instant render from whatever was
  // last seen for that key (even by another page, e.g. Bibliothèque already
  // having populated /api/library/movies) instead of a blank home screen on
  // every visit, with a background revalidate keeping it current.
  const { data: keyData, mutate: mutateConfigured } = useSWR<{ configured: boolean }>("/api/metadata/key");
  const configured = keyData?.configured ?? null;
  const { optimized: optimizedInterface, ready: interfaceModeReady } = useInterfaceDataMode();

  const { data: optimizedStatusData } = useSWR<{
    movies: { tmdbId: number; status: string }[];
    series: { tmdbId: number; status: string }[];
  }>(configured && interfaceModeReady && optimizedInterface ? "/api/interface/library-status" : null);

  const { data: moviesData } = useSWR<{ movies: { tmdbId: number; status: string; activeInfoHash: string | null }[] }>(
    configured && interfaceModeReady && !optimizedInterface ? "/api/library/movies" : null
  );
  const { data: seriesData } = useSWR<{ series: { tmdbId: number; seasons: { episodes: { status: string; activeInfoHash: string | null; monitored: boolean }[] }[] }[] }>(
    configured && interfaceModeReady && !optimizedInterface ? "/api/library/series" : null
  );
  const [libStatus, setLibStatus] = useState<Map<string, string>>(new Map());
  const [libLoaded, setLibLoaded] = useState(false);
  useEffect(() => {
    if (!optimizedStatusData && !moviesData && !seriesData) return;
    const m = new Map<string, string>();
    if (optimizedStatusData) {
      for (const movie of optimizedStatusData.movies) m.set(`movie:${movie.tmdbId}`, movie.status);
      for (const series of optimizedStatusData.series) m.set(`series:${series.tmdbId}`, series.status);
    }
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
        if (monitored.every((e) => e.status === "upcoming")) { m.set(`series:${x.tmdbId}`, "upcoming"); continue; }
        // "Complete" when everything left is only scheduled (TBA/future dates).
        const allAvailable = monitored.every((e) => e.status === "available" || e.status === "upcoming");
        m.set(`series:${x.tmdbId}`, allAvailable ? "available" : "missing");
      }
    }
    setLibStatus(m);
    if (!libLoaded) setLibLoaded(true);
  }, [optimizedStatusData, moviesData, seriesData, libLoaded]);

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
    setWatchProvider(null);
    setRowCategory(null);
    setRowCategoryMeta(undefined);
  };

  const seeAllRow = (key: string, meta?: RowMeta) => {
    setQ("");
    setGenre("");
    setYear("");
    setSort("popularity.desc");
    setCompany(null);
    setWatchProvider(null);
    setRowCategory(key);
    setRowCategoryMeta(meta);
  };

  // Genres are media-type-specific and reload on every Films/Séries switch.
  const { data: genresData } = useSWR<{ genres: MetaGenre[] }>(
    configured ? `/api/metadata/genres?type=${mediaType}` : null
  );
  const genres = genresData?.genres ?? [];

  // Studio and platform tiles are both shown at all times (not tied to the
  // active Films/Séries tab).
  const { data: companyData } = useSWR<{ tiles: LogoTile[] }>(configured ? "/api/metadata/logos?kind=company" : null);
  const { data: watchProviderData } = useSWR<{ tiles: LogoTile[] }>(configured ? "/api/metadata/logos?kind=watchProvider" : null);
  const companyTiles = companyData?.tiles ?? [];
  const watchProviderTiles = watchProviderData?.tiles ?? [];

  // Manual Films/Séries switch — start browsing that type from a clean filter
  // state, EXCEPT watchProvider: a streaming service (Netflix, Prime Video…)
  // uses the same TMDb id for movies and series, so it stays active across
  // the tab switch instead of being silently dropped.
  const switchMediaType = (mt: "movie" | "series") => {
    setQ("");
    setGenre("");
    setYear("");
    setSort("popularity.desc");
    setCompany(null);
    setRowCategory(null);
    setRowCategoryMeta(undefined);
    setGenreMenuOpen(false);
    setMediaType(mt);
  };

  // Home rows — fetched whenever no filter/search is active.
  const { data: rowsData, isLoading: rowsLoading } = useSWR<{ rows: { key: string; results: MetaSearchResult[]; ranked?: boolean; meta?: RowMeta }[] }>(
    configured && !isBrowsing ? `/api/metadata/rows?type=${mediaType}` : null
  );
  const rows = rowsData?.rows ?? [];

  // C411 front-page lists (populaire / uploads récents / sorties du jour) —
  // only present when the C411 indexer has lists enabled with site credentials.
  const { data: c411Data } = useSWR<{ configured: boolean; rows: { key: string; results: MetaSearchResult[] }[] }>(
    configured && !isBrowsing ? "/api/metadata/c411-rows" : null
  );
  const c411Rows = c411Data?.rows ?? [];

  // "Année minimale des carrousels" (Réglages → Expérience dashboard) — the
  // same layout.hero.minYear the dashboard's rows honor. Applied to the
  // home carousels AND the "see all" row pages (they show the same content),
  // never to an explicit search (q) — a user searching for a 1931 title
  // means exactly that.
  const { data: layoutData } = useSWR<{ layout: DashboardLayout }>("/api/dashboard/layout");
  const minYear = layoutData?.layout?.hero?.minYear ?? null;
  const afterMinYear = (r: { year?: number | null }) => (minYear ? (r.year ?? 0) >= minYear : true);

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
  }, [configured, isBrowsing, q, mediaType, genre, year, sort, company, watchProvider, rowCategory]);

  // Same debounce as the browse grid above, kept as its own request since
  // people aren't paginated/filtered the same way movies and series are.
  useEffect(() => {
    if (!configured || !q.trim()) { setPersonResults([]); return; }
    const query = q.trim();
    const id = setTimeout(() => {
      fetch(`/api/metadata/search?q=${encodeURIComponent(query)}&type=person`, { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { results?: MetaPersonSearchResult[] } | null) => setPersonResults(d?.results?.slice(0, 8) ?? []))
        .catch(() => setPersonResults([]));
    }, 350);
    return () => clearTimeout(id);
  }, [configured, q]);

  // When the query is clearly a real person's exact name, replace the
  // generic movie/series grid with their REAL filmography instead — live-
  // verified this mattered: searching "Christopher Nolan" via the plain
  // text search only ever surfaced documentaries whose title happens to
  // mention his name, never Inception or Oppenheimer, because TMDb's
  // /search/multi does literal text matching, not "find what this person
  // made". Réalisateur credits (getPerson's isDirector) sort first, so a
  // director's own films lead over titles they merely appeared/cameoed in.
  useEffect(() => {
    if (!q.trim() || personResults.length === 0) return;
    const exactMatch = personResults.find(
      (p) => p.name.toLowerCase() === q.trim().toLowerCase() && (p.popularity ?? 0) > 5 && !!p.knownForDepartment
    );
    if (!exactMatch) return;
    // Ne hijack pas un vrai titre : si searchMulti a déjà un titre très populaire avec même nom, garde la recherche titre
    // (ex: "yellowstone" → série 73586 3298 votes vs personne "Yellowstone" acteur 3 votes)
    // On laisse le useEffect searchMulti décider, pas la filmo personne
    const qLower = q.trim().toLowerCase();
    // Heuristique simple : si q est un seul mot et correspond à un docu peu voté, on préfère le titre populaire — on vérifie via un fetch synchrone rapide si besoin, sinon on skip la filmo
    // Ici on skip juste le cas mono-mot peu populaire qui masquerait un titre culte
    if (qLower.split(/\s+/).length === 1 && (exactMatch.popularity ?? 0) < 10) return;
    fetch(`/api/metadata/person?id=${exactMatch.tmdbId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { credits?: (MetaSearchResult & { isDirector?: boolean })[] } | null) => {
        if (!d?.credits) return;
        const sorted = [...d.credits].sort(
          (a, b) => Number(!!b.isDirector) - Number(!!a.isDirector) || b.rating - a.rating
        );
        setResults(sorted);
        setPage(1);
        setTotalPages(1);
        setLoading(false);
      })
      .catch(() => {});
  }, [q, personResults]);

  const loadPage = async (targetPage: number) => {
    if (targetPage === 1) setLoading(true); else setLoadingMore(true);
    try {
      let url: string;
      if (rowCategory) {
        url = `/api/metadata/row-page?type=${mediaType}&key=${encodeURIComponent(rowCategory)}&page=${targetPage}`;
      } else if (q.trim()) {
        // No `type=` filter here on purpose — confirmed live the user wants
        // films et séries mêlés (merged in one grid) for a text search,
        // unlike the Films/Séries tab toggle which still scopes browsing
        // (genre/year/sort) below. searchMulti (the API's unfiltered branch)
        // returns both, each already tagged with its own real type.
        url = `/api/metadata/search?q=${encodeURIComponent(q)}&page=${targetPage}`;
      } else {
        const params = new URLSearchParams({ type: mediaType, page: String(targetPage) });
        if (genre) params.set("genre", genre);
        if (year) params.set("year", year);
        if (sort) params.set("sort", sort);
        if (company) params.set("company", company.id);
        if (watchProvider) params.set("watchProvider", watchProvider.id);
        url = `/api/metadata/discover?${params.toString()}`;
      }
      const res = await fetch(url, { cache: "no-store" });
      const d = res.ok ? await res.json() : { results: [] };
      const raw: MetaSearchResult[] = Array.isArray(d.results) ? d.results : [];
      // "See all" of a home carousel (rowCategory) shows the exact same
      // content as the carousel — honor minYear there too. Explicit searches
      // (q) and manual filters (genre/year/sort) stay untouched.
      const filtered: MetaSearchResult[] = rowCategory && !q.trim() ? raw.filter(afterMinYear) : raw;
      const list: MetaSearchResult[] = rowCategory || q.trim() ? filtered : filtered.map((r: MetaSearchResult) => ({ ...r, type: mediaType }));
      setResults((prev) => (targetPage === 1 ? list : [...prev, ...list]));
      setPage(d.page ?? targetPage);
      setTotalPages(d.totalPages ?? 0);
      // Direct/bookmarked "?row=becauseYouWatched:..." load — no click ever
      // set rowCategoryMeta, so the "voir tout" label recovers it here.
      if (targetPage === 1 && d.meta) setRowCategoryMeta(d.meta);
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

  const rowLabel = (key: string, meta?: RowMeta) => {
    if (key.startsWith("becauseYouWatched:") && meta) {
      return meta.verb === "liked"
        ? t("discover.rowBecauseYouLiked", { title: meta.anchorTitle })
        : t("discover.rowBecauseYouWatched", { title: meta.anchorTitle });
    }
    switch (key) {
      case "recommendedTop": return t("discover.rowRecommendedTop");
      case "trendingPopular": return t("discover.rowTrendingPopular");
      case "nowPlayingBoxOffice": return t("discover.rowNowPlayingBoxOffice");
      case "upcomingVod": return t("discover.rowUpcomingVod");
      case "newSeriesRenewed": return t("discover.rowNewSeriesRenewed");
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
      case "c411Popular": return t("discover.c411Popular");
      case "c411Recent": return t("discover.c411Recent");
      case "c411Today": return t("discover.c411Today");
      case "acclaimed": return t("discover.rowAcclaimed");
      case "anime": return t("discover.rowAnime");
      case "teen": return t("discover.rowTeen");
      case "shortFormat": return t("discover.rowShortFormat");
      case "genreAction": return t("discover.rowGenreAction");
      case "genreComedy": return t("discover.rowGenreComedy");
      case "genreHorror": return t("discover.rowGenreHorror");
      case "genreSciFi": return t("discover.rowGenreSciFi");
      default: return key;
    }
  };

  const homeRows = useMemo(
    () => [
      ...rows.map((row) => ({ ...row, results: row.results.filter(afterMinYear) })),
      ...c411Rows
        .map((row) => ({ ...row, results: row.results.filter((item) => item.type === mediaType).filter(afterMinYear) }))
        .filter((row) => row.results.length > 0),
    ],
    [rows, c411Rows, mediaType, minYear]
  );
  const catalogHero = homeRows.find((row) => row.key === "recommendedTop")?.results[0] ?? homeRows[0]?.results[0] ?? null;
  const homeArtworkRefs = useMemo(
    () => homeRows.flatMap((row) => row.results.map((result) => ({ tmdbId: result.tmdbId, type: result.type }))),
    [homeRows]
  );
  const browseArtworkRefs = useMemo(
    () => results.map((result) => ({ tmdbId: result.tmdbId, type: result.type })),
    [results]
  );
  const titleArtwork = useTitleArtworkBatch(isBrowsing ? browseArtworkRefs : homeArtworkRefs, locale);
  // Two genres TMDb has no id for at all (genreTaxonomy.ts) — rendered as
  // extra entries in the same dropdown, string ids never colliding with a
  // TMDb numeric one.
  const synthGenres = [
    { id: ANIME_GENRE_ID, name: t("discover.genreAnime") },
    { id: TEEN_GENRE_ID, name: t("discover.genreTeen") },
  ];
  const selectedGenreName = genres.find((item) => String(item.id) === genre)?.name ?? synthGenres.find((item) => item.id === genre)?.name ?? null;
  // A genre is an editorial destination, not merely a grid filter: feature
  // its strongest resolved result in the same cinematic hero as Films/Séries.
  // Wait for the new page before rendering so a previous genre never flashes.
  const genreHero = genre && !q.trim() && !loading ? results[0] ?? null : null;

  return (
    <div className="mx-auto max-w-[1500px] space-y-8">
      <PageHeader
        eyebrow={t("discover.eyebrow")}
        title={mediaType === "movie" ? t("common.movies") : t("common.series")}
        description={t("discover.description")}
      >
        {configured && (
          <div className="flex flex-wrap items-center gap-1.5">
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
            <div className="relative" ref={genreMenuRef}>
              <button
                type="button"
                onClick={() => setGenreMenuOpen((open) => !open)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors",
                  genre ? "brand-gradient text-white" : "glass text-ink-soft hover:text-ink"
                )}
              >
                {selectedGenreName ?? t("discover.genres")} <ChevronDown className="h-3.5 w-3.5" />
              </button>
              {genreMenuOpen && (
                <div className="absolute right-0 top-full z-30 mt-2 max-h-80 w-56 overflow-y-auto rounded-xl border border-white/10 bg-[#171522]/98 p-1.5 shadow-2xl backdrop-blur-xl">
                  <button
                    type="button"
                    onClick={() => { setGenre(""); setGenreMenuOpen(false); }}
                    className={cn("w-full rounded-lg px-3 py-2 text-left text-sm", !genre ? "bg-white/10 text-ink" : "text-ink-soft hover:bg-white/5 hover:text-ink")}
                  >
                    {t("common.all")}
                  </button>
                  {synthGenres.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => { setGenre(item.id); setGenreMenuOpen(false); }}
                      className={cn("w-full rounded-lg px-3 py-2 text-left text-sm", genre === item.id ? "bg-white/10 text-ink" : "text-ink-soft hover:bg-white/5 hover:text-ink")}
                    >
                      {item.name}
                    </button>
                  ))}
                  <div className="my-1 border-t border-white/8" />
                  {genres.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => { setGenre(String(item.id)); setGenreMenuOpen(false); }}
                      className={cn("w-full rounded-lg px-3 py-2 text-left text-sm", genre === String(item.id) ? "bg-white/10 text-ink" : "text-ink-soft hover:bg-white/5 hover:text-ink")}
                    >
                      {item.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </PageHeader>

      {configured === false && (
        <TmdbSetup onSaved={() => mutateConfigured()} />
      )}

      {configured && (
        <>
          {!isBrowsing && catalogHero && <CatalogHero result={catalogHero} />}
          {genreHero && <CatalogHero result={genreHero} label={selectedGenreName ?? undefined} />}

          <div className="flex flex-wrap items-center gap-2">
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
            {watchProvider && (
              <FilterChip label={watchProvider.name} onClear={() => setWatchProvider(null)} />
            )}
            {rowCategory && (
              <FilterChip label={rowLabel(rowCategory, rowCategoryMeta)} onClear={() => { setRowCategory(null); setRowCategoryMeta(undefined); }} />
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
              rows={homeRows}
              artwork={titleArtwork}
              loading={rowsLoading}
              companyTiles={companyTiles}
              watchProviderTiles={watchProviderTiles}
              libStatus={libStatus}
              libLoaded={libLoaded}
              watchedSet={watchedSet}
              onAdded={(key) => setLibStatus((m) => new Map(m).set(key, "missing"))}
              rowLabel={rowLabel}
              onSeeAll={seeAllRow}
              onCompanyClick={(tile) => {
                setMediaType("movie");
                setCompany({ id: String(tile.id), name: tile.name });
              }}
              onWatchProviderClick={(tile) => {
                // No forced media-type switch — the same provider id works
                // for movies and series, so it stays valid whichever tab
                // the user is already on.
                setWatchProvider({ id: String(tile.id), name: tile.name });
              }}
            />
          )}

          {isBrowsing && (
            <>
              {loading && page === 1 && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                  {[...Array(12)].map((_, i) => (
                    <div key={i}>
                      <div className="aspect-video animate-pulse rounded-2xl bg-white/6" />
                      <div className="mt-1.5 h-2.5 w-1/2 animate-pulse rounded bg-white/6" />
                    </div>
                  ))}
                </div>
              )}

              {q.trim() && personResults.length > 0 && (
                <PersonRow title={t("discover.peopleTitle")} results={personResults} />
              )}

              {!loading && results.length === 0 && personResults.length === 0 && (
                <div className="rounded-2xl glass py-16 text-center text-sm text-ink-dim">{t("discover.noResults")}</div>
              )}

              {results.length > 0 && (
                <>
                  {q.trim() && (
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex rounded-xl glass p-1">
                        {(["all", "movie", "series"] as const).map((f) => (
                          <button
                            key={f}
                            onClick={() => setSearchFilter(f)}
                            className={cn("rounded-lg px-3 py-1.5 text-xs font-bold transition-colors", searchFilter === f ? "bg-white text-black" : "text-ink-soft hover:text-ink")}
                          >
                            {f === "all" ? t("common.all") : f === "movie" ? t("common.movies") : t("common.series")}
                          </button>
                        ))}
                      </div>
                      <select value={searchSort} onChange={(e) => setSearchSort(e.target.value as typeof searchSort)} className="h-9 rounded-xl glass px-3 text-xs font-semibold text-ink outline-none">
                        <option value="relevance">Pertinence</option>
                        <option value="popularity">Populaire</option>
                        <option value="recent">Récent</option>
                        <option value="rating">Notes</option>
                      </select>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
                    {(() => {
                      const filteredByType = searchFilter === "all" ? results : results.filter((r) => r.type === searchFilter);
                      const displayResults = [...filteredByType].sort((a, b) => {
                        if (searchSort === "popularity") return (b.voteCount ?? 0) - (a.voteCount ?? 0);
                        if (searchSort === "recent") return (b.year ?? 0) - (a.year ?? 0);
                        if (searchSort === "rating") return b.rating - a.rating;
                        // relevance : connu/récent d'abord sans oublier le reste (voteCount + year)
                        const score = (r: typeof a) => (r.voteCount ?? 0) * 0.6 + (r.year ?? 0) * 0.4;
                        return score(b) - score(a);
                      });
                      return displayResults.map((r, i) => (
                      <DiscoverCard
                        key={`${r.type}:${r.tmdbId}`}
                        index={i}
                        result={r}
                        status={libLoaded ? (libStatus.get(`${r.type}:${r.tmdbId}`) ?? null) : null}
                        watched={watchedSet.has(r.tmdbId) && r.type === "movie"}
                        backdropPath={titleArtwork[`${r.type}:${r.tmdbId}`]?.backdropPath ?? r.backdropPath}
                        logoPath={titleArtwork[`${r.type}:${r.tmdbId}`]?.logoPath ?? null}
                        onAdded={() => setLibStatus((m) => new Map(m).set(`${r.type}:${r.tmdbId}`, "missing"))}
                      />
                    ));
                    })()}
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

      {titlePanel}
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

/** A type-specific editorial entry point for Films and Series. It is only a
 * visual invitation; its Link is caught by useTitlePanel, preserving the one
 * floating Movviz detail implementation and the caller's scroll position. */
function CatalogHero({ result, label }: { result: MetaSearchResult; label?: string }) {
  const { t, locale } = useI18n();
  return (
    <Link
      href={`/title/${result.type}/${result.tmdbId}`}
      className="group relative block min-h-[320px] overflow-hidden rounded-3xl border border-white/10 bg-[#12111c] sm:min-h-[420px] lg:h-[clamp(28rem,42vw,40rem)] lg:min-h-[28rem]"
    >
      {result.backdropPath ? (
        <TmdbImage path={result.backdropPath} size="w1280" alt={result.title} className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.02]" />
      ) : result.posterPath ? (
        <>
          <TmdbImage path={result.posterPath} size="w500" alt="" className="absolute inset-0 h-full w-full scale-125 object-cover opacity-45 blur-2xl" />
          <TmdbImage path={result.posterPath} size="w500" alt={result.title} className="absolute right-[10%] top-0 h-full max-w-[42%] object-contain drop-shadow-2xl" />
        </>
      ) : null}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-black/95 via-black/55 to-transparent" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
      <div className="relative z-10 flex min-h-[320px] max-w-xl flex-col justify-end gap-3 p-5 sm:min-h-[420px] sm:p-8 lg:h-full lg:min-h-[28rem] lg:p-8 xl:p-10">
        <span className="w-fit rounded-full border border-white/15 bg-black/35 px-3 py-1 text-xs font-semibold text-white/85 backdrop-blur">
          {label ?? (result.type === "movie" ? t("common.movies") : t("common.series"))}
        </span>
        <TitleMark
          key={`${result.type}:${result.tmdbId}`}
          tmdbId={result.tmdbId}
          type={result.type}
          title={result.title}
          locale={locale}
          className="min-h-11 text-2xl sm:min-h-16 sm:text-3xl"
          logoClassName="max-h-14 max-w-[60vw] sm:max-h-16 sm:max-w-sm"
        />
        <div className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-white/85">
          {result.year && <span>{result.year}</span>}
          {result.rating > 0 && <><span className="text-white/45">•</span><span className="text-amber">★ {result.rating.toFixed(1)}</span></>}
        </div>
        {result.overview && <p className="line-clamp-2 text-sm text-white/75 sm:line-clamp-3">{result.overview}</p>}
        <span className="mt-1 flex w-fit items-center gap-1.5 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-black shadow-lg transition-transform group-hover:scale-105">
          <Info className="h-4 w-4" /> {t("dashboard.hero.moreInfo")}
        </span>
      </div>
    </Link>
  );
}

function HomeRows({
  rows, artwork, loading, companyTiles, watchProviderTiles, libStatus, libLoaded, watchedSet, onAdded, rowLabel, onSeeAll, onCompanyClick, onWatchProviderClick,
}: {
  rows: { key: string; results: MetaSearchResult[]; ranked?: boolean; meta?: RowMeta }[];
  artwork: TitleArtworkByKey;
  loading: boolean;
  companyTiles: LogoTile[];
  watchProviderTiles: LogoTile[];
  libStatus: Map<string, string>;
  libLoaded: boolean;
  watchedSet: Set<number>;
  onAdded: (key: string) => void;
  rowLabel: (key: string, meta?: RowMeta) => string;
  onSeeAll: (key: string, meta?: RowMeta) => void;
  onCompanyClick: (tile: LogoTile) => void;
  onWatchProviderClick: (tile: LogoTile) => void;
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
                <div key={j} className="w-[300px] shrink-0 lg:w-[320px] xl:w-[340px] 2xl:w-[360px]">
                  <div className="aspect-video animate-pulse rounded-2xl bg-white/6" />
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
            title={rowLabel(row.key, row.meta)}
            results={row.results}
            libStatus={libStatus}
            libLoaded={libLoaded}
            watchedSet={watchedSet}
            onAdded={onAdded}
            onSeeAll={() => onSeeAll(row.key, row.meta)}
          />
        ) : (
          <PosterRow
            key={row.key}
            title={rowLabel(row.key, row.meta)}
            results={row.results}
            libStatus={libStatus}
            libLoaded={libLoaded}
            watchedSet={watchedSet}
            artwork={artwork}
            onAdded={onAdded}
            onSeeAll={() => onSeeAll(row.key, row.meta)}
          />
        )
      )}

      {watchProviderTiles.length > 0 && (
        <LogoRow title={t("discover.watchProviders")} tiles={watchProviderTiles} onClick={onWatchProviderClick} />
      )}

      {companyTiles.length > 0 && (
        <LogoRow title={t("discover.studios")} tiles={companyTiles} onClick={onCompanyClick} />
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
            title={tile.name}
            // Round icon on phones (a wide oval reads as a broken card at
            // that width) — reverts to the wider rounded rectangle from sm:
            // up, where there's room for it to look intentional.
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full glass p-2.5 transition-transform hover:scale-[1.03] hover:border-brand/40 sm:h-24 sm:w-48 sm:rounded-2xl sm:p-4"
          >
            {tile.logoPath ? (
              <div className="flex h-full w-full items-center justify-center rounded-full bg-white/95 p-2 sm:rounded-xl sm:p-3">
                <TmdbImage
                  path={tile.logoPath}
                  size="w500"
                  alt={tile.name}
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <span className="line-clamp-2 text-center text-[9px] font-bold leading-tight text-ink sm:text-sm sm:leading-normal">{tile.name}</span>
            )}
          </button>
        ))}
      </div>
    </section>
  );
}

/** Acteurs/réalisateurs trouvés pour la recherche en cours — une carte
 *  personne n'a ni "ajouter à la bibliothèque" ni année/note, donc son
 *  propre composant plutôt qu'un DiscoverCard détourné de son usage. */
function PersonRow({ title, results }: { title: string; results: MetaPersonSearchResult[] }) {
  const t = useT();
  return (
    <section className="space-y-3">
      <h2 className="text-base sm:text-lg font-bold tracking-tight text-ink">{title}</h2>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {results.map((p) => (
          <Link
            key={p.tmdbId}
            href={`/person/${p.tmdbId}`}
            className="group flex w-24 shrink-0 flex-col items-center gap-2 text-center sm:w-28"
          >
            <div className="h-24 w-24 overflow-hidden rounded-full bg-surface ring-1 ring-white/10 transition-transform group-hover:scale-105 sm:h-28 sm:w-28">
              {p.profilePath ? (
                <TmdbImage path={p.profilePath} size="w185" alt={p.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-ink-dim">
                  <Search className="h-6 w-6 opacity-40" />
                </div>
              )}
            </div>
            <div>
              <p className="line-clamp-2 text-xs font-semibold text-ink">{p.name}</p>
              {p.knownForDepartment && (
                <span className="text-[11px] text-ink-dim">
                  {p.knownForDepartment === "Directing" ? t("discover.personDirector") : p.knownForDepartment === "Acting" ? t("discover.personActor") : t("discover.personGeneric")}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function PosterRow({
  title, results, artwork, libStatus, libLoaded, watchedSet, onAdded, onSeeAll,
}: {
  title: string;
  results: MetaSearchResult[];
  artwork: TitleArtworkByKey;
  libStatus: Map<string, string>;
  libLoaded: boolean;
  watchedSet: Set<number>;
  onAdded: (key: string) => void;
  onSeeAll: () => void;
}) {
  if (results.length === 0) return null;
  return (
    <SharedPosterRow title={title} onSeeAll={onSeeAll}>
      {results.map((r, i) => (
        <div key={`${r.type}:${r.tmdbId}`} className="w-[300px] shrink-0 lg:w-[320px] xl:w-[340px] 2xl:w-[360px]">
          <DiscoverCard
            index={i}
            result={r}
            status={libLoaded ? (libStatus.get(`${r.type}:${r.tmdbId}`) ?? null) : null}
            watched={watchedSet.has(r.tmdbId) && r.type === "movie"}
            backdropPath={artwork[`${r.type}:${r.tmdbId}`]?.backdropPath ?? r.backdropPath}
            logoPath={artwork[`${r.type}:${r.tmdbId}`]?.logoPath ?? null}
            onAdded={() => onAdded(`${r.type}:${r.tmdbId}`)}
          />
        </div>
      ))}
    </SharedPosterRow>
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
        {result.posterPath ? (
          <TmdbImage path={result.posterPath} size="w92" alt={result.title} loading="lazy" className="h-full w-full object-cover" />
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
  result, status, watched, backdropPath, logoPath, onAdded, index = 0,
}: {
  result: MetaSearchResult;
  status: string | null;
  watched: boolean;
  backdropPath: string | null;
  logoPath: string | null;
  onAdded: () => void;
  index?: number;
}) {
  const { t, locale } = useI18n();
  const reduceMotion = useShouldReduceMotion();
  const [adding, setAdding] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

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

  const daysToRelease = result.type === "movie" ? daysUntil(result.releaseDate) : null;

  const cascadeAnim = reduceMotion ? {} : {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, delay: Math.min(index * 0.05, 0.5) },
    whileTap: { scale: 0.98 },
    style: { willChange: "transform" } as React.CSSProperties,
  };

  const isBusy = adding || status === "downloading" || status === "searching";
  const ActionIcon = isBusy ? Loader2 : status === "available" ? Check : status === "missing" ? Clock : status === "upcoming" ? CalendarCheck : Plus;
  const buttonTone = status === "available"
    ? "bg-ok/95 text-white"
    : status === "missing"
      ? "bg-amber/95 text-black"
      : status === "upcoming"
        ? "bg-black/70 text-brand-glow ring-1 ring-white/15"
        : status
          ? "bg-purple-500/95 text-white"
          : "brand-gradient text-white";
  const cardBadge = watched
    ? t("watch.watched")
    : status === "upcoming" && daysToRelease != null
      ? daysToRelease <= 1 ? t("dashboard.hero.inOneDay") : t("dashboard.hero.inDays", { n: daysToRelease })
      : undefined;

  return (
    <motion.article className="w-full" {...cascadeAnim}>
      <div className="relative">
        <DashboardPosterCard
          layout="fill"
          reserveBottomRight
          tmdbId={result.tmdbId}
          type={result.type}
          title={result.title}
          posterPath={result.posterPath}
          backdropPath={backdropPath}
          logoPath={logoPath}
          rating={result.rating}
          badge={cardBadge}
          year={result.year}
          inLibrary={!!status}
        />
        <button
          type="button"
          onClick={(event) => { event.preventDefault(); event.stopPropagation(); void add(); }}
          disabled={adding || !!status}
          title={status ? t("discover.added") : t("discover.addToLibrary")}
          className={cn("absolute bottom-3 right-3 z-20 flex h-9 w-9 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 disabled:cursor-default disabled:opacity-100", buttonTone)}
        >
          <ActionIcon className={cn("h-4 w-4", isBusy && "animate-spin")} />
        </button>
      </div>
      <div className="mt-1.5 flex items-center gap-2 px-0.5 text-xs text-ink-dim">
        {formatDate(result.releaseDate, locale) ? (
          <span className="flex items-center gap-1"><Calendar className="h-2.5 w-2.5" /> {formatDate(result.releaseDate, locale)}</span>
        ) : (
          <span>{result.year ?? "—"}</span>
        )}
        {feedback && <span className="truncate text-amber">{feedback}</span>}
      </div>
    </motion.article>
  );
}
