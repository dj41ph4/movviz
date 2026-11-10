"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { LibraryGrid, RENDER_BATCH_INITIAL, RENDER_BATCH_STEP } from "@/components/library/LibraryGrid";
import { useT, useI18n } from "@/i18n/provider";
import { cn, relativeTime, formatDate } from "@/lib/utils";
import { TmdbImage } from "@/components/media/TmdbImage";
import type { LibraryMovie, LibrarySeries } from "@/lib/library/types";
import { decodeLibraryRef } from "@/lib/library/types";
import type { Collection } from "@/lib/collections/types";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { canCompleteMissing } from "@/lib/auth/permissions";
import { useTitlePanel } from "@/components/title/useTitlePanel";
import {
  Film, Tv, ListChecks, Library as LibraryIcon, LibraryBig, RotateCw, Calendar, Download,
  Layers, Grid2x2, Grid3x3, List, Check, RefreshCw, Loader2, Search,
} from "lucide-react";
import { mapWithConcurrency } from "@/lib/concurrency";

const TABS = [
  { id: "library", labelKey: "nav.library", icon: LibraryIcon },
  { id: "collection", labelKey: "nav.collections", icon: LibraryBig },
  { id: "wanted", labelKey: "nav.wanted", icon: ListChecks },
] as const;

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
  const tab = TABS.find((tb) => tb.id === params.get("tab"))?.id ?? "library";
  // Mounted once at the page level (not per-tab) so the panel survives tab
  // switches, and every <Link href="/title/..."> rendered by any tab (movie/
  // series cards, collection posters) opens it instead of navigating away.
  const { titlePanel } = useTitlePanel();

  const pushTab = (id: (typeof TABS)[number]["id"]) => {
    const p = new URLSearchParams(params.toString());
    if (id === "library") p.delete("tab");
    else p.set("tab", id);
    router.push(pathname + (p.toString() ? "?" + p.toString() : ""), { scroll: false });
  };

  return (
    <div className="nx-library-page mx-auto w-full max-w-[2000px]">
      <PageHeader title={t("library.title")} compact />

      <div className="no-scrollbar mb-4 flex w-max max-w-full gap-0.5 overflow-x-auto rounded-full bg-black/30 p-1 shadow-[inset_0_1px_3px_rgba(0,0,0,.45)]">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            onClick={() => pushTab(tb.id)}
            className={cn(
              "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-colors lg:min-h-9",
              tab === tb.id ? "brand-gradient text-white shadow-lg" : "text-ink-soft hover:text-ink"
            )}
          >
            <tb.icon className="h-4 w-4" />
            {t(tb.labelKey)}
          </button>
        ))}
      </div>

      {tab === "library" && <LibraryGrid fixedType="all" />}
      {tab === "collection" && <CollectionTab />}
      {tab === "wanted" && <WantedTab />}

      {titlePanel}
    </div>
  );
}

type ViewMode = "large" | "small" | "list";

function useViewMode(storageKey: string): [ViewMode, (v: ViewMode) => void] {
  const [view, setView] = useState<ViewMode>("large");
  useEffect(() => {
    const stored = localStorage.getItem(storageKey) as ViewMode | null;
    if (stored === "large" || stored === "small" || stored === "list") setView(stored);

    // Account-level preference wins once it loads — confirmed live: this was
    // device-only, resetting on every new browser/device. Silently ignored
    // when logged out or offline.
    fetch("/api/settings/preferences", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const mode = d?.prefs?.libraryViewMode as ViewMode | undefined;
        if (mode === "large" || mode === "small" || mode === "list") {
          localStorage.setItem(storageKey, mode);
          setView(mode);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const update = (v: ViewMode) => {
    setView(v);
    localStorage.setItem(storageKey, v);
    fetch("/api/settings/preferences", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ libraryViewMode: v }),
    }).catch(() => {});
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
    <div className="flex items-center gap-0.5 rounded-full bg-black/30 p-1 shadow-[inset_0_1px_3px_rgba(0,0,0,.45)]">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          title={t(o.labelKey)}
          aria-label={t(o.labelKey)}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full transition-colors lg:h-8 lg:w-8",
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

/** "James Bond 007 - Saga" → "James Bond 007" : le suffixe est répété sur chaque carte et mange la place du titre. */
function sagaDisplayName(name: string): string {
  return name.replace(/\s*[-–]\s*(Saga|Collection)\s*$/i, "");
}

type SagaFilter = "all" | "incomplete" | "complete";
type SagaSort = "most" | "nearly";

const BAR_SEG = "no-scrollbar flex shrink-0 gap-0.5 overflow-x-auto rounded-full bg-black/30 p-1 shadow-[inset_0_1px_3px_rgba(0,0,0,.45)]";
const barSegBtn = (active: boolean) => cn(
  "inline-flex min-h-10 shrink-0 items-center whitespace-nowrap rounded-full px-3.5 text-sm font-semibold transition-colors lg:min-h-8",
  active ? "brand-gradient text-white shadow-lg" : "text-ink-soft hover:text-ink"
);
const BAR_WRAP = "mb-4 flex flex-wrap items-center gap-2 rounded-[26px] border border-white/10 bg-gradient-to-b from-white/[.07] to-white/[.03] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,.1),0_16px_34px_-14px_rgba(0,0,0,.65)] backdrop-blur-xl lg:sticky lg:top-[calc(var(--nx-topbar-h,3.5rem)+0.5rem)] lg:z-20";

function BarSearch({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="flex h-11 min-w-0 flex-1 basis-48 items-center gap-2 rounded-full bg-black/30 px-3.5 shadow-[inset_0_1px_3px_rgba(0,0,0,.45)] lg:h-10">
      <Search aria-hidden className="h-4 w-4 shrink-0 text-ink-dim" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-dim"
      />
    </label>
  );
}

function SagasSection() {
  const t = useT();
  const user = useCurrentUser();
  const [sagas, setSagas] = useState<SagaSummary[] | null>(null);
  const [scanning, setScanning] = useState(false);
  const [view, setView] = useViewMode("movviz-sagas-view");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SagaFilter>("all");
  const [sortMode, setSortMode] = useState<SagaSort>("most");
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

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (sagas ?? []).filter((s) => {
      const complete = s.ownedCount >= s.totalCount;
      if (filter === "complete" && !complete) return false;
      if (filter === "incomplete" && complete) return false;
      return !q || sagaDisplayName(s.name).toLowerCase().includes(q);
    });
    if (sortMode === "nearly") {
      // Closest to completion first: fewest missing titles, finished sagas last.
      const gap = (s: SagaSummary) => (s.ownedCount >= s.totalCount ? Infinity : s.totalCount - s.ownedCount);
      list.sort((a, b) => gap(a) - gap(b));
    }
    return list;
  }, [sagas, query, filter, sortMode]);

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
      <div className="mb-3">
        <h2 className="text-lg font-bold text-ink">{t("collections.sagasTitle")}</h2>
        <p className="hidden text-sm text-ink-dim sm:block">{t("collections.sagasHint")}</p>
      </div>

      <div className={BAR_WRAP}>
        <BarSearch value={query} onChange={setQuery} placeholder={t("collections.searchSagas")} />
        <div className="no-scrollbar flex max-w-full items-center gap-2 overflow-x-auto">
          <div className={BAR_SEG}>
            {([["all", "collections.filterAll"], ["incomplete", "collections.filterIncomplete"], ["complete", "collections.filterComplete"]] as const).map(([id, key]) => (
              <button key={id} type="button" aria-pressed={filter === id} onClick={() => setFilter(id)} className={barSegBtn(filter === id)}>{t(key)}</button>
            ))}
          </div>
          <div className={BAR_SEG}>
            {([["most", "collections.sortMost"], ["nearly", "collections.sortNearly"]] as const).map(([id, key]) => (
              <button key={id} type="button" aria-pressed={sortMode === id} onClick={() => setSortMode(id)} className={barSegBtn(sortMode === id)}>{t(key)}</button>
            ))}
          </div>
        </div>
        <span className="shrink-0 whitespace-nowrap px-1.5 text-sm font-semibold text-ink-dim">
          <b className="text-ink">{shown.length}</b> {t("collections.sagasCount")}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <ViewModeToggle view={view} onChange={setView} />
          {user?.role === "admin" && (
            <button
              onClick={startScan}
              disabled={scanning}
              className="flex h-11 items-center gap-2 rounded-full border border-white/10 bg-white/[.05] px-4 text-xs font-semibold text-ink-soft transition-colors hover:bg-white/10 hover:text-ink disabled:opacity-50 lg:h-9"
            >
              {scanning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{scanning ? t("collections.scanning") : t("collections.scanLibrary")}</span>
            </button>
          )}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="rounded-2xl glass p-5 text-sm text-ink-dim">{t("collections.sagasEmpty")}</p>
      ) : view === "list" ? (
        <div className="space-y-2">
          {shown.map((s) => {
            const pct = Math.min(100, Math.round((s.ownedCount / s.totalCount) * 100));
            return (
              <Link
                key={s.collectionId}
                href={`/collection/${s.collectionId}`}
                className="group flex items-center gap-3.5 overflow-hidden rounded-2xl border border-white/8 bg-white/[.03] p-2 transition hover:border-brand/35 hover:bg-white/[.07]"
              >
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-brand-glow/20 to-purple/20">
                  {s.posterPath ? (
                    <TmdbImage path={s.posterPath} size="w185" alt={s.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center"><Layers className="h-5 w-5 text-ink-soft/60" /></div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{sagaDisplayName(s.name)}</p>
                  <div className="mt-1.5 h-1.5 w-full max-w-40 overflow-hidden rounded-full bg-white/8">
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
          {shown.map((s) => {
            const pct = Math.min(100, Math.round((s.ownedCount / s.totalCount) * 100));
            return (
              <Link
                key={s.collectionId}
                href={`/collection/${s.collectionId}`}
                className="group relative overflow-hidden rounded-[22px] border border-white/8 bg-surface shadow-[0_18px_36px_-18px_#000] transition duration-200 hover:-translate-y-1 hover:border-brand/55"
              >
                <div className="aspect-[2/3]">
                  {s.posterPath ? (
                    <TmdbImage path={s.posterPath} size="w342" alt={s.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-brand/20 to-purple/20">
                      <Layers className="h-8 w-8 text-ink-soft/60" />
                    </div>
                  )}
                </div>
                <div className="absolute inset-x-2.5 bottom-2 h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div className={cn("h-full rounded-full", pct >= 100 ? "bg-ok" : "brand-gradient")} style={{ width: `${pct}%` }} />
                </div>
                <div className="absolute inset-0 flex flex-col justify-end gap-1.5 bg-gradient-to-t from-black/90 via-black/25 to-transparent p-3 pb-5">
                  <p className={cn("line-clamp-2 font-bold leading-tight text-white", view === "small" ? "text-[10px]" : "text-[13px]")}>{sagaDisplayName(s.name)}</p>
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
                          <TmdbImage path={item.posterPath} size="w154" alt={item.title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
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
  // Relancer la recherche d'un manquant : admins et utilisateurs en acceptation automatique (le serveur le refuse aux autres).
  const canComplete = canCompleteMissing(useCurrentUser());
  const [busy, setBusy] = useState<string | null>(null);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [allProgress, setAllProgress] = useState<{ current: number; total: number } | null>(null);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "movie" | "series">("all");
  const [confirming, setConfirming] = useState(false);

  // Same SWR keys as the library tab/dashboard — SSE-driven revalidation.
  const { data: moviesData, mutate: mutateMovies } = useSWR<{ movies: LibraryMovie[] }>(
    "/api/library/movies"
  );
  const { data: seriesData, mutate: mutateSeries } = useSWR<{ series: LibrarySeries[] }>(
    "/api/library/series"
  );
  const allMovies = useMemo(
    () => (moviesData?.movies ?? []).filter((x) => x.monitored && x.status === "missing"),
    [moviesData]
  );
  const allEpisodes = useMemo(() => {
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

  // Search + kind filter. The list can hold tens of thousands of rows, so the
  // text filter is what makes it usable; "retry" then acts on what is shown.
  const q = query.trim().toLowerCase();
  const movies = useMemo(
    () => (kind === "series" ? [] : allMovies.filter((m) => !q || m.title.toLowerCase().includes(q))),
    [allMovies, kind, q]
  );
  const episodes = useMemo(
    () => (kind === "movie" ? [] : allEpisodes.filter((e) => !q || e.series.title.toLowerCase().includes(q) || e.title.toLowerCase().includes(q))),
    [allEpisodes, kind, q]
  );
  const grandTotal = allMovies.length + allEpisodes.length;
  const filtering = q !== "" || kind !== "all";
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
    setConfirming(false);
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
  // Relancer des milliers de recherches d'un clic mérite une confirmation.
  const CONFIRM_ABOVE = 50;
  const onRetryClick = () => {
    if (total > CONFIRM_ABOVE) setConfirming(true);
    else downloadAll();
  };

  // Rendering is driven by scroll, not by idle time: the list can hold
  // thousands of rows, and mounting them all (the old idle-time growth) put
  // ~4,000 nodes in the page. A sentinel after the last row loads the next
  // batch only when it is actually approached.
  // The batch size is tied to the active filter, so changing the filter
  // starts again from the first batch without an effect-driven reset.
  const filterKey = `${kind}|${q}`;
  const [grown, setGrown] = useState({ key: filterKey, count: RENDER_BATCH_INITIAL });
  const visibleCount = grown.key === filterKey ? grown.count : RENDER_BATCH_INITIAL;
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || visibleCount >= total) return;
    const io = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setGrown({ key: filterKey, count: visibleCount + RENDER_BATCH_STEP }); },
      { rootMargin: "800px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visibleCount, total, filterKey]);
  const visibleMovies = movies.slice(0, visibleCount);
  const visibleEpisodes = episodes.slice(0, Math.max(0, visibleCount - movies.length));

  const rowClass = "flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[.03] py-2.5 pl-3 pr-2.5 transition-colors hover:border-brand/35 hover:bg-white/[.07]";
  const iconTile = "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[.06] text-brand-glow";
  const dateChip = "hidden shrink-0 items-center gap-1 rounded-full bg-white/[.05] px-2.5 py-1 text-xs text-ink-dim sm:flex";
  const retryBtn = "flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/[.06] text-brand-glow transition-colors hover:bg-brand/30 hover:text-white disabled:opacity-50 lg:h-10 lg:w-10";

  return (
    <div className="mx-auto max-w-[1100px]">
      {grandTotal > 0 && (
        <div className={BAR_WRAP}>
          <BarSearch value={query} onChange={setQuery} placeholder={t("wanted.search")} />
          <div className={BAR_SEG}>
            {([["all", "common.all"], ["movie", "common.movies"], ["series", "common.series"]] as const).map(([id, key]) => (
              <button key={id} type="button" aria-pressed={kind === id} onClick={() => setKind(id)} className={barSegBtn(kind === id)}>{t(key)}</button>
            ))}
          </div>
          <span className="shrink-0 whitespace-nowrap px-1.5 text-sm font-semibold text-ink-dim">
            <b className="text-ink">{total}</b>{filtering ? ` ${t("wanted.shownOf")} ${grandTotal}` : ` ${t("common.titles")}`}
          </span>
          {canComplete && <div className="ml-auto flex items-center gap-2">
            {confirming ? (
              <>
                <span className="text-sm font-semibold text-ink">{t("wanted.confirmRetry", { n: total })}</span>
                <button type="button" onClick={downloadAll} className="flex h-11 items-center rounded-full brand-gradient px-4 text-sm font-bold text-white lg:h-10">
                  {t("wanted.confirmYes")}
                </button>
                <button type="button" onClick={() => setConfirming(false)} className="flex h-11 items-center rounded-full border border-white/10 bg-white/[.05] px-4 text-sm font-semibold text-ink-soft hover:text-ink lg:h-10">
                  {t("common.cancel")}
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={onRetryClick}
                disabled={downloadingAll || total === 0}
                className="flex h-11 items-center gap-2 rounded-full brand-gradient px-5 text-sm font-bold text-white shadow-[0_8px_20px_-6px_rgba(124,92,255,.7)] disabled:opacity-50 lg:h-10"
              >
                {downloadingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {downloadingAll && allProgress ? `${allProgress.current} / ${allProgress.total}` : filtering ? t("wanted.retrySelection") : t("wanted.downloadAll")}
              </button>
            )}
          </div>}
        </div>
      )}
      <div className="space-y-2">
      {visibleMovies.map((movie) => (
        <div key={movie.id} className={rowClass}>
          <span className={iconTile}><Film className="h-4 w-4" /></span>
          <Link href={`/title/movie/${movie.tmdbId}`} className="min-w-0 flex-1 truncate text-sm font-semibold text-ink hover:text-brand-glow">
            {movie.title} {movie.year ? `(${movie.year})` : ""}
          </Link>
          {formatDate(movie.releaseDate, locale) && (
            <span className={dateChip}>
              <Calendar className="h-3 w-3" /> {formatDate(movie.releaseDate, locale)}
            </span>
          )}
          <span className="hidden shrink-0 text-xs text-ink-dim md:inline">{relativeTime(new Date(movie.addedAt).toISOString(), locale)}</span>
          {canComplete && <button
            onClick={() => searchMovie(movie.id)}
            disabled={busy === `m${movie.id}`}
            title={t("calendar.quickSearch")}
            aria-label={t("calendar.quickSearch")}
            className={retryBtn}
          >
            {busy === `m${movie.id}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
          </button>}
        </div>
      ))}
      {visibleEpisodes.map((e) => (
        <div key={`${e.series.id}-${e.season}-${e.episode}`} className={rowClass}>
          <span className={iconTile}><Tv className="h-4 w-4" /></span>
          <Link href={`/title/series/${e.series.tmdbId}`} className="min-w-0 flex-1 truncate text-sm font-semibold text-ink hover:text-brand-glow">
            {e.series.title} — {e.season}x{String(e.episode).padStart(2, "0")} {e.title}
          </Link>
          {formatDate(e.airDate, locale) && (
            <span className={dateChip}>
              <Calendar className="h-3 w-3" /> {formatDate(e.airDate, locale)}
            </span>
          )}
          {canComplete && <button
            onClick={() => searchEpisode(e.series.id, e.season, e.episode)}
            disabled={busy === `e${e.series.id}.${e.season}.${e.episode}`}
            title={t("calendar.quickSearch")}
            aria-label={t("calendar.quickSearch")}
            className={retryBtn}
          >
            {busy === `e${e.series.id}.${e.season}.${e.episode}` ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
          </button>}
        </div>
      ))}
      </div>
      {visibleCount < total && <div ref={sentinelRef} className="h-10" />}
      {grandTotal === 0 && <div className="rounded-2xl glass py-16 text-center text-ink-dim">{t("wanted.empty")}</div>}
      {grandTotal > 0 && total === 0 && <div className="rounded-2xl glass py-12 text-center text-sm text-ink-dim">{t("common.noResults")}</div>}
    </div>
  );
}
