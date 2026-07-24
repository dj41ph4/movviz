"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/ui/PageHeader";
import { SortableColumnHeader } from "@/components/ui/SortableColumnHeader";
import { cn, formatBytes, relativeTime } from "@/lib/utils";
import { useT } from "@/i18n/provider";
import { useShouldReduceMotion } from "@/lib/motion/useReduceMotion";
import type { IndexerRelease } from "@/lib/indexers/types";
import type { MediaType } from "@/lib/types";
import { TitleTargetPicker } from "@/components/activity/v2/TitleTargetPicker";
import {
  Search, Zap, Magnet, Server, Download, Loader2, Settings, Film, Tv, Check, ListFilter, X, AlertTriangle, RotateCw,
} from "lucide-react";

/** Extract the season number from a search query (e.g. "South Park S29" → 29, "South Park Season 29" → 29). */
function extractSearchSeason(query: string): number | null {
  const m = query.match(/\bS(?:eason)?\.?\s*(\d{1,3})\b/i);
  return m ? parseInt(m[1], 10) : null;
}

/** Regex matching season references in release titles: S01, S01-S13, Saison 1, Seasons 1-13, etc. */
const SEASON_REF_RE = /\bS(?:easons?|aison)?\.?\s?0?(\d{1,3})(?:\s*[-–toà]+\s*S?(?:aison)?\.?\s?0?(\d{1,3}))?\b/gi;

/**
 * Render a release title with season references highlighted.
 * - Matching season → green highlight
 * - Non-matching season → amber highlight
 * - No season in query → no highlighting
 */
function HighlightSeasonTitle({ title, targetSeason }: { title: string; targetSeason: number | null }) {
  if (targetSeason == null) {
    return <>{title}</>;
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;

  SEASON_REF_RE.lastIndex = 0;
  while ((m = SEASON_REF_RE.exec(title)) !== null) {
    if (m.index > lastIndex) {
      parts.push(<span key={`t-${lastIndex}`}>{title.slice(lastIndex, m.index)}</span>);
    }
    const lo = parseInt(m[1], 10);
    const hi = m[2] ? parseInt(m[2], 10) : lo;
    const covers = targetSeason >= lo && targetSeason <= hi;
    const isExact = lo === hi && lo === targetSeason;
    const cls = isExact
      ? "font-bold text-ok bg-ok/15 rounded px-0.5"
      : covers
        ? "font-bold text-ok/80 bg-ok/10 rounded px-0.5"
        : "font-bold text-amber bg-amber/15 rounded px-0.5";
    parts.push(<span key={`s-${m.index}`} className={cls}>{m[0]}</span>);
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < title.length) {
    parts.push(<span key={`e-${lastIndex}`}>{title.slice(lastIndex)}</span>);
  }
  return <>{parts}</>;
}

export default function SearchPage() {
  return (
    <Suspense fallback={null}>
      <SearchPageInner />
    </Suspense>
  );
}

function SearchPageInner() {
  const t = useT();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const reduceMotion = useShouldReduceMotion();
  const libraryRef = params.get("libraryRef");
  const manualTitle = params.get("title");
  const [q, setQ] = useState(params.get("q") ?? "");
  const [category, setCategory] = useState<MediaType>(params.get("category") === "series" ? "series" : "movie");
  const [releases, setReleases] = useState<IndexerRelease[]>([]);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [searched, setSearched] = useState(false);
  const [grabbing, setGrabbing] = useState<string | null>(null);
  const [grabbed, setGrabbed] = useState<Set<string>>(new Set());
  const [recentLoading, setRecentLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [sortKey, setSortKey] = useState<string>("score");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [indexerErrors, setIndexerErrors] = useState<{ indexer: string; detail: string }[]>([]);
  const [pendingTarget, setPendingTarget] = useState<IndexerRelease | null>(null);

  const btnSpring = reduceMotion ? {} : {
    whileTap: { scale: 0.95 },
    transition: { type: "spring" as const, stiffness: 400, damping: 17 },
  };

  const sorted = useMemo(() => {
    const arr = [...releases];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "title": cmp = a.title.localeCompare(b.title); break;
        case "indexer": cmp = a.indexer.localeCompare(b.indexer); break;
        case "size": cmp = a.size - b.size; break;
        case "peers": cmp = (a.seeders ?? 0) - (b.seeders ?? 0); break;
        case "age": cmp = (a.publishDate ? new Date(a.publishDate).getTime() : 0) - (b.publishDate ? new Date(b.publishDate).getTime() : 0); break;
        case "score": cmp = a.score - b.score; break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });
    return arr;
  }, [releases, sortKey, sortDir]);

  const toggleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir(key === "title" || key === "indexer" ? "asc" : "desc");
    }
  };

  // Manual pick from a library card lands here pre-filled — launch the search right away.
  useEffect(() => {
    if (q.trim() && !searched) run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // No query → load recent releases automatically, scoped to the active
  // Films/Séries toggle, and reload whenever that toggle changes.
  useEffect(() => {
    if (libraryRef || searched) return; // manual pick or an active search — leave it alone
    loadRecent(category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const loadRecent = async (cat: MediaType) => {
    if (recentLoading) return;
    setRecentLoading(true);
    setFetchError(false);
    try {
      const res = await fetch(`/api/indexers/search?recent=1&category=${cat}`, { cache: "no-store" });
      const data = await res.json();
      if (data.configured) {
        setConfigured(true);
        setReleases(data.releases ?? []);
      } else {
        setConfigured(false);
      }
    } catch {
      setFetchError(true);
    } finally {
      setRecentLoading(false);
    }
  };

  const run = async () => {
    if (!q.trim()) return;
    const p = new URLSearchParams(params.toString());
    p.set("q", q.trim());
    p.set("category", category);
    router.push(pathname + "?" + p.toString(), { scroll: false });
    setLoading(true);
    setSearched(true);
    setFetchError(false);
    try {
      const paramsQ = new URLSearchParams({ q: q.trim() });
      const refTitle = params.get("refTitle");
      const year = params.get("year");
      const tmdbId = params.get("tmdbId");
      if (refTitle) paramsQ.set("refTitle", refTitle);
      if (year) paramsQ.set("year", year);
      if (category) paramsQ.set("category", category);
      if (tmdbId) paramsQ.set("tmdbId", tmdbId);
      const res = await fetch(`/api/indexers/search?${paramsQ.toString()}`, { cache: "no-store" });
      const data = await res.json();
      setConfigured(data.configured);
      setReleases(data.releases ?? []);
      setIndexerErrors(data.errors ?? []);
    } catch {
      setFetchError(true);
      setConfigured(false);
      setReleases([]);
      setIndexerErrors([]);
    } finally {
      setLoading(false);
    }
  };

  const grab = async (r: IndexerRelease, resolvedLibraryRef: string | null = libraryRef) => {
    setGrabbing(r.guid);
    const quality = (r.title.match(/\b(4320p|2160p|1080p|720p|480p)\b/i)?.[0]?.toLowerCase() ?? "Inconnue");
    try {
      const res = await fetch("/api/indexers/grab", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          magnetUrl: r.magnetUrl,
          downloadUrl: r.downloadUrl,
          indexerId: r.indexerId,
          category,
          libraryRef: resolvedLibraryRef,
          title: params.get("refTitle"),
          year: params.get("year") ? Number(params.get("year")) : null,
          indexerName: r.indexer,
          quality,
          score: r.score,
          size: r.size,
          protocol: r.protocol,
          seeders: r.seeders,
          leechers: r.leechers,
        }),
      });
      if (res.ok) setGrabbed((s) => new Set(s).add(r.guid));
    } finally {
      setGrabbing(null);
    }
  };

  // A blind search (no libraryRef — reached directly, not "Sélection
  // manuelle" from a title page) used to grab straight into an untracked
  // torrent with no way to ever mark a library item available from it.
  // Asking which title/season/episode it belongs to BEFORE grabbing lets the
  // normal import pipeline (already able to fan a multi-file pack out across
  // the right episodes) place it correctly once it lands.
  const onGrabClick = (r: IndexerRelease) => {
    if (libraryRef) {
      grab(r);
      return;
    }
    setPendingTarget(r);
  };

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader title={t("search.title")} description={t("search.description")} />

      {libraryRef && manualTitle && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-brand/25 bg-brand/10 px-4 py-2.5 text-sm font-semibold text-brand-glow">
          <ListFilter className="h-4 w-4 shrink-0" />
          <span className="flex-1">{t("search.manualFor", { title: manualTitle })}</span>
          <Link href="/search" className="flex h-6 w-6 items-center justify-center rounded-lg text-ink-dim hover:text-ink">
            <X className="h-3.5 w-3.5" />
          </Link>
        </div>
      )}

      {/* Search bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 items-center gap-3 rounded-2xl glass px-5 focus-within:border-brand/40">
          <Search className="h-5 w-5 text-ink-dim" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && run()}
            placeholder={t("search.placeholder")}
            className="h-14 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-dim"
          />
        </div>
        <div className="flex items-center gap-1 rounded-2xl glass p-1">
          {(["movie", "series"] as const).map((c) => (
            <button key={c} onClick={() => { setCategory(c); const p = new URLSearchParams(params.toString()); p.set("category", c); if (q.trim()) p.set("q", q.trim()); router.push(pathname + "?" + p.toString(), { scroll: false }); }} className={cn("flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors", category === c ? "brand-gradient text-white" : "text-ink-soft hover:text-ink")}>
              {c === "movie" ? <Film className="h-4 w-4" /> : <Tv className="h-4 w-4" />}
              {c === "movie" ? t("common.movies") : t("common.series")}
            </button>
          ))}
        </div>
        <motion.button {...btnSpring} onClick={run} disabled={loading || !q.trim()} className="flex h-14 items-center justify-center gap-2 rounded-2xl brand-gradient px-8 text-sm font-bold text-white shadow-xl transition-transform hover:scale-105 active:scale-95 disabled:opacity-40">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4 fill-white" />} {t("search.launch")}
        </motion.button>
      </div>

      {/* Per-indexer errors — an indexer rejecting the request (bad key, rate
          limit, malformed query) otherwise looks identical to "found
          nothing", so surface it instead of leaving the user guessing. */}
      {indexerErrors.length > 0 && (
        <div className="mb-4 flex flex-col gap-1.5 rounded-xl border border-down/20 bg-down/8 px-4 py-2.5 text-sm text-down">
          {indexerErrors.map((e) => (
            <div key={e.indexer} className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span><strong>{e.indexer}</strong> — {e.detail}</span>
            </div>
          ))}
        </div>
      )}

      {/* Fetch error */}
      {fetchError && (
        <div className="flex flex-col items-center gap-3 rounded-2xl glass py-16 text-center">
          <AlertTriangle className="h-8 w-8 text-down" />
          <p className="font-semibold text-ink">{t("error.title")}</p>
          <p className="max-w-md text-sm text-ink-dim">{t("error.description")}</p>
          <motion.button
            {...btnSpring}
            onClick={() => (searched ? run() : loadRecent(category))}
            className="mt-2 inline-flex items-center gap-2 rounded-xl brand-gradient px-5 py-2.5 text-sm font-bold text-white"
          >
            <RotateCw className="h-4 w-4" /> {t("common.retry")}
          </motion.button>
        </div>
      )}

      {/* Not configured */}
      {configured === false && !fetchError && (
        <div className="flex flex-col items-center gap-3 rounded-2xl glass py-16 text-center">
          <Settings className="h-8 w-8 text-brand-glow" />
          <p className="font-semibold text-ink">{t("search.noIndexers")}</p>
          <p className="max-w-md text-sm text-ink-dim">{t("search.noIndexersHint")}</p>
          <Link href="/settings" className="mt-2 rounded-xl brand-gradient px-5 py-2.5 text-sm font-bold text-white">
            {t("search.goToSettings")}
          </Link>
        </div>
      )}

      {/* Loading recent */}
      {recentLoading && (
        <div className="overflow-hidden rounded-2xl glass">
          <div className="hidden grid-cols-[1fr_110px_65px_75px_65px_100px] gap-4 border-b border-white/8 px-5 py-3 text-xs font-bold uppercase tracking-wider md:grid">
            <span className="h-3 w-24 animate-pulse rounded bg-white/8" />
            <span className="h-3 w-16 animate-pulse rounded bg-white/8" />
            <span className="h-3 w-10 animate-pulse rounded bg-white/8" />
            <span className="h-3 w-12 animate-pulse rounded bg-white/8" />
            <span className="h-3 w-10 animate-pulse rounded bg-white/8" />
            <span className="h-3 w-14 animate-pulse rounded bg-white/8" />
          </div>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 border-b border-white/5 px-5 py-4 last:border-0 md:grid-cols-[1fr_110px_65px_75px_65px_100px] md:items-center md:gap-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-white/8" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-3/4 animate-pulse rounded bg-white/8" />
                  <div className="h-2.5 w-1/4 animate-pulse rounded bg-white/6" />
                </div>
              </div>
              <div className="h-3 w-20 animate-pulse rounded bg-white/8" />
              <div className="h-3 w-12 animate-pulse rounded bg-white/8" />
              <div className="h-3 w-14 animate-pulse rounded bg-white/8" />
              <div className="h-3 w-10 animate-pulse rounded bg-white/8" />
              <div className="h-7 w-16 animate-pulse rounded-lg bg-white/8 md:ml-auto" />
            </div>
          ))}
        </div>
      )}

      {/* Loading search */}
      {loading && (
        <div className="overflow-hidden rounded-2xl glass">
          <div className="hidden grid-cols-[1fr_110px_65px_75px_65px_100px] gap-4 border-b border-white/8 px-5 py-3 text-xs font-bold uppercase tracking-wider md:grid">
            <span className="h-3 w-24 animate-pulse rounded bg-white/8" />
            <span className="h-3 w-16 animate-pulse rounded bg-white/8" />
            <span className="h-3 w-10 animate-pulse rounded bg-white/8" />
            <span className="h-3 w-12 animate-pulse rounded bg-white/8" />
            <span className="h-3 w-10 animate-pulse rounded bg-white/8" />
            <span className="h-3 w-14 animate-pulse rounded bg-white/8" />
          </div>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="grid grid-cols-1 gap-2 border-b border-white/5 px-5 py-4 last:border-0 md:grid-cols-[1fr_110px_65px_75px_65px_100px] md:items-center md:gap-4">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 shrink-0 animate-pulse rounded-lg bg-white/8" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-3/4 animate-pulse rounded bg-white/8" />
                  <div className="h-2.5 w-1/4 animate-pulse rounded bg-white/6" />
                </div>
              </div>
              <div className="h-3 w-20 animate-pulse rounded bg-white/8" />
              <div className="h-3 w-12 animate-pulse rounded bg-white/8" />
              <div className="h-3 w-14 animate-pulse rounded bg-white/8" />
              <div className="h-3 w-10 animate-pulse rounded bg-white/8" />
              <div className="h-7 w-16 animate-pulse rounded-lg bg-white/8 md:ml-auto" />
            </div>
          ))}
        </div>
      )}

      {/* Results */}
      {!loading && !recentLoading && configured !== false && releases.length > 0 && (
        <>
          {!searched && !q.trim() && (
            <p className="mb-3 text-sm font-semibold text-ink-soft">{t("search.recentReleases")}</p>
          )}
          <div className="overflow-hidden rounded-2xl glass">
          <div className="hidden grid-cols-[1fr_110px_65px_75px_65px_100px] gap-4 border-b border-white/8 px-5 py-3 text-xs font-bold uppercase tracking-wider md:grid">
            <SortableColumnHeader label={t("search.release")} column="title" activeColumn={sortKey} direction={sortDir} onSort={toggleSort} />
            <SortableColumnHeader label={t("search.indexer")} column="indexer" activeColumn={sortKey} direction={sortDir} onSort={toggleSort} />
            <SortableColumnHeader label={t("search.age")} column="age" activeColumn={sortKey} direction={sortDir} onSort={toggleSort} />
            <SortableColumnHeader label={t("search.size")} column="size" activeColumn={sortKey} direction={sortDir} onSort={toggleSort} />
            <SortableColumnHeader label={t("search.peers")} column="peers" activeColumn={sortKey} direction={sortDir} onSort={toggleSort} />
            <span className="text-right text-ink-dim">{t("search.action")}</span>
          </div>
          {sorted.map((r) => (
            <div key={r.guid} className="grid grid-cols-1 gap-2 border-b border-white/5 px-5 py-4 transition-colors last:border-0 hover:bg-white/[0.03] md:grid-cols-[1fr_110px_65px_75px_65px_100px] md:items-center md:gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", r.protocol === "torrent" ? "bg-cyan/12 text-cyan" : "bg-brand/12 text-brand-glow")}>
                  {r.protocol === "torrent" ? <Magnet className="h-4 w-4" /> : <Server className="h-4 w-4" />}
                </span>
                <div className="min-w-0">
                  <p className="font-mono text-sm text-ink sm:truncate"><HighlightSeasonTitle title={r.title} targetSeason={extractSearchSeason(q)} /></p>
                  <p className="text-[11px] text-ink-dim">
                    {t("search.score").toLowerCase()}{" "}
                    <span className={cn("font-bold", r.score >= 90 ? "text-ok" : r.score >= 75 ? "text-amber" : "text-ink-soft")}>{r.score}</span>
                  </p>
                </div>
              </div>
              <span className="truncate text-sm text-ink-soft">{r.indexer}</span>
              <span className="text-sm text-ink-soft">{r.publishDate ? relativeTime(r.publishDate) : "—"}</span>
              <span className="text-sm text-ink-soft">{formatBytes(r.size)}</span>
              <span className={cn("text-sm font-semibold", r.seeders == null ? "text-ink-dim" : r.seeders > 20 ? "text-ok" : "text-amber")}>
                {r.seeders == null ? "—" : `${r.seeders} ↑`}
              </span>
              <div className="md:text-right">
                <motion.button
                  {...btnSpring}
                  onClick={() => onGrabClick(r)}
                  disabled={grabbing === r.guid || grabbed.has(r.guid)}
                  className={cn("inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold disabled:opacity-60", grabbed.has(r.guid) ? "bg-ok/15 text-ok" : "brand-gradient text-white")}
                >
                  {grabbing === r.guid ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : grabbed.has(r.guid) ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                  {grabbed.has(r.guid) ? t("search.grabbed") : t("common.grab")}
                </motion.button>
              </div>
            </div>
          ))}
        </div>
        </>
      )}

      {/* No results */}
      {!loading && configured && searched && releases.length === 0 && (
        <div className="rounded-2xl glass py-16 text-center text-sm text-ink-dim">{t("search.noResults")}</div>
      )}

      {pendingTarget && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-[12vh] backdrop-blur-sm p-4" onClick={() => setPendingTarget(null)}>
          <div className="w-full max-w-lg rounded-2xl glass-strong p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-ink">{t("activity.linkBeforeGrab")}</h2>
                <p className="mt-1 truncate text-xs font-mono text-ink-dim">{pendingTarget.title}</p>
              </div>
              <button onClick={() => setPendingTarget(null)} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg glass text-ink-dim hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>
            <TitleTargetPicker
              initialQuery={pendingTarget.title}
              onPick={(resolvedRef) => {
                const r = pendingTarget;
                setPendingTarget(null);
                grab(r, resolvedRef);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
