"use client";

import { useState, useMemo, memo, useRef, useEffect } from "react";
import useSWR, { mutate as globalMutate } from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n, useT } from "@/i18n/provider";
import { cn, formatBytes, formatSpeed, formatEta, formatDateTime } from "@/lib/utils";
import { useSmoothProgress } from "@/lib/media/useSmoothProgress";
import { useShouldReduceMotion } from "@/lib/motion/useReduceMotion";
import { useInterfaceDataMode } from "@/lib/settings/useInterfaceDataMode";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { encodeLibraryRef } from "@/lib/library/types";
import type { QueueItem } from "@/lib/activity/v2/types";
import { ManualSearchModal } from "@/components/search/ManualSearchModal";
import { parseRelease } from "@/lib/naming/parser";
import { buildMediaBadgeItems } from "@/components/library/MediaBadges";
import type { IndexerRelease } from "@/lib/indexers/types";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import {
  Film, Tv, Download, Pause, Play, PauseCircle, PlayCircle, RotateCw, Search, Ban, Check,
  Users, AlertCircle, Loader, List, Clock, Trash2, X, RefreshCw, ArrowUpFromLine, Gauge, Wand2,
  CheckCircle2, Share2,
} from "lucide-react";

/** Builds the libraryRef the manual-search grab needs from a queue item's
 *  media info — mirrors the encoding TitleContent.tsx uses when opening
 *  manual search from a title page, since QueueItem only carries the raw
 *  season/episode/packEpisodeCount fields, not a pre-encoded ref. */
function queueItemLibraryRef(media: QueueItem["media"]): string {
  if (media.type === "movie") return encodeLibraryRef({ kind: "movie", movieId: media.id });
  if (media.packEpisodeCount && media.season === 0) return encodeLibraryRef({ kind: "series", seriesId: media.id });
  if (media.packEpisodeCount && media.season != null) return encodeLibraryRef({ kind: "season", seriesId: media.id, season: media.season });
  if (media.season != null && media.episode != null) return encodeLibraryRef({ kind: "episode", seriesId: media.id, season: media.season, episode: media.episode });
  return encodeLibraryRef({ kind: "series", seriesId: media.id });
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Search query for a queue item's manual-search/replace popup — must match
 *  exactly what the original grab searched for (title + season/episode),
 *  not just the bare series/movie title, or the replacement search finds
 *  completely different (often wrong-season) releases. Mirrors the query
 *  conventions from TitleContent's openManualSearch{,Season,Episode}. */
function queueItemSearchQuery(media: QueueItem["media"]): string {
  if (media.type === "movie") return media.title;
  if (media.packEpisodeCount && media.season === 0) return media.title; // full series pack
  if (media.packEpisodeCount && media.season != null) return `${media.title} S${pad(media.season)}`;
  if (media.season != null && media.episode != null) return `${media.title} S${pad(media.season)}E${pad(media.episode)}`;
  return media.title;
}

function queueItemSearchTitle(media: QueueItem["media"]): string {
  if (media.type === "movie") return media.title;
  if (media.packEpisodeCount && media.season === 0) return media.title;
  if (media.packEpisodeCount && media.season != null) return `${media.title} — S${pad(media.season)}`;
  if (media.season != null && media.episode != null) return `${media.title} — ${media.season}x${pad(media.episode)}`;
  return media.title;
}

const BASE = "/api/engine";

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(path, { ...opts, headers: { "content-type": "application/json", ...opts?.headers } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const FILTERS = ["all", "downloading", "seeding", "stalled", "completed"] as const;
type Filter = (typeof FILTERS)[number];

const RENDER_BATCH_INITIAL = 50;
const RENDER_BATCH_STEP = 100;

export function QueueTab({ active = true }: { active?: boolean }) {
  const t = useT();
  const { locale } = useI18n();
  const router = useRouter();
  const user = useCurrentUser();
  const reduceMotion = useShouldReduceMotion();
  const { optimized } = useInterfaceDataMode();
  const btnSpring = reduceMotion ? {} : {
    whileTap: { scale: 0.95 },
    transition: { type: "spring" as const, stiffness: 400, damping: 17 },
  };
  const [clearingAll, setClearingAll] = useState(false);
  const SWR_KEY = "/api/activity/v2?tab=queue";
  const { data, error, mutate } = useSWR<{ items: QueueItem[] }>(
    clearingAll || !active ? null : SWR_KEY,
    {
      refreshInterval: optimized
        ? (latest) => (latest?.items.some((item) => item.status === "downloading" || item.status === "importing") ? 1_000 : 10_000)
        : 500,
      dedupingInterval: optimized ? 750 : 250,
      revalidateOnFocus: !optimized,
    }
  );
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [manualSearchItem, setManualSearchItem] = useState<QueueItem | null>(null);
  const [bulkReplacing, setBulkReplacing] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [bulkPausing, setBulkPausing] = useState(false);

  const items = data?.items ?? [];
  const activeItems = useMemo(() => items.filter(item => item.status === "downloading" || item.status === "importing"), [items]);
  const queuedItems = useMemo(() => items.filter(item => item.status === "queued"), [items]);
  const stalledItems = useMemo(() => items.filter(item => item.status === "stalled"), [items]);
  const pausedItems = useMemo(() => items.filter(item => item.status === "paused"), [items]);
  const completedItems = useMemo(() => items.filter(item => item.status === "completed" || item.status === "seeding"), [items]);
  // Anything currently pausable (downloading/queued/stalled) — while any of
  // these exist the button reads "pause all" and targets them. Once none are
  // left (everything pausable has been paused), it flips to "resume all" and
  // targets the paused set instead — a single toggle rather than two buttons.
  const pausableItems = useMemo(() => items.filter(item => item.status === "downloading" || item.status === "queued" || item.status === "stalled"), [items]);
  const resumeAllMode = pausableItems.length === 0 && pausedItems.length > 0;

  const statusPriority = (s: string): number => {
    if (s === "downloading" || s === "importing" || s === "verifying") return 0;
    if (s === "queued") return 1;
    if (s === "stalled") return 2;
    if (s === "paused") return 3;
    if (s === "seeding") return 4;
    if (s === "completed") return 5;
    return 6;
  };

  const filtered = useMemo(() => items
    .filter((item) => {
      if (filter === "downloading") return item.status === "downloading" || item.status === "importing" || item.status === "verifying";
      if (filter === "seeding") return item.status === "seeding";
      if (filter === "stalled") return item.status === "stalled";
      if (filter === "completed") return item.status === "completed";
      return true;
    })
    .sort((a, b) => {
      const pa = statusPriority(a.status);
      const pb = statusPriority(b.status);
      if (pa !== pb) return pa - pb;
      return new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime();
    }), [items, filter]);

  // Visual sections: active downloads first, then WAITING (queued — the
  // user can force-start them), then stalled/paused, completed last.
  const sectionOf = (s: string): "active" | "waiting" | "blocked" | "paused" | "done" => {
    if (s === "downloading" || s === "importing" || s === "verifying") return "active";
    if (s === "queued") return "waiting";
    if (s === "stalled") return "blocked";
    if (s === "paused") return "paused";
    return "done";
  };
  const sectionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of filtered) {
      const section = sectionOf(item.status);
      counts[section] = (counts[section] ?? 0) + 1;
    }
    return counts;
  }, [filtered]);

  // Progressive rendering — a queue with hundreds of completed/seeding items
  // crashed the tab when every row was painted on every 500ms poll. Paint the
  // first batch immediately (active/importing items sort first, so the live
  // part of the queue is always visible), grow the rest in idle time.
  const [visibleCount, setVisibleCount] = useState(RENDER_BATCH_INITIAL);
  useEffect(() => {
    setVisibleCount(RENDER_BATCH_INITIAL);
  }, [filter]);
  useEffect(() => {
    if (visibleCount >= filtered.length) return;
    const grow = () => setVisibleCount((c) => c + RENDER_BATCH_STEP);
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(grow);
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(grow, 50);
    return () => window.clearTimeout(id);
  }, [visibleCount, filtered.length]);
  const visibleItems = filtered.slice(0, visibleCount);

  const toggleExpand = (id: string) => {
    setExpandedItem(expandedItem === id ? null : id);
  };

  const poll = () => mutate();

  /** Flip an item's status in the local SWR cache immediately, before the
   *  request even lands — pause/resume otherwise felt laggy waiting on a
   *  full round-trip just to see the icon change. Revalidates right after so
   *  a failed request self-corrects instead of leaving a lie on screen. */
  const patchLocal = (itemId: string, patch: (item: QueueItem) => QueueItem) => {
    mutate(
      (current) => current ? { items: current.items.map((i) => (i.id === itemId ? patch(i) : i)) } : current,
      { revalidate: false }
    );
  };

  const setPriority = async (itemId: string, priority: "high" | "medium" | "low") => {
    patchLocal(itemId, (i) => ({ ...i, priority }));
    try {
      await api(`${BASE}/torrents/${itemId}/priority`, {
        method: "POST",
        body: JSON.stringify({ priority }),
      });
    } catch (e) {
      console.error(`[queue] setPriority failed:`, e);
    } finally {
      await mutate();
    }
  };

  const handleAction = async (itemId: string, action: "pause" | "resume" | "restart" | "retry" | "search" | "block") => {
    setActionLoading(`${action}_${itemId}`);
    if (action === "pause") patchLocal(itemId, (i) => ({ ...i, status: "paused" }));
    if (action === "resume") patchLocal(itemId, (i) => ({ ...i, status: "downloading" }));
    try {
      switch (action) {
        case "pause":
          await api(`${BASE}/torrents/${itemId}/pause`, { method: "POST" });
          break;
        case "resume":
          await api(`${BASE}/torrents/${itemId}/resume`, { method: "POST" });
          break;
        case "restart":
          await api(`${BASE}/torrents/${itemId}/restart`, { method: "POST" });
          break;
        case "retry": {
          await api(`${BASE}/torrents/${itemId}`, { method: "DELETE" });
          const item = items.find(i => i.id === itemId);
          if (item && item.media.href && item.media.href !== "#") {
            const p = new URLSearchParams({ q: item.media.title });
            if (item.media.tmdbId) p.set("tmdbId", String(item.media.tmdbId));
            if (item.media.type) p.set("category", item.media.type);
            router.push(`/search?${p.toString()}`);
          }
          break;
        }
        case "search": {
          const item = items.find(i => i.id === itemId);
          if (item) setManualSearchItem(item);
          break;
        }
        case "block": {
          const item = items.find(i => i.id === itemId);
          if (item) {
            if (!(await confirmDialog(t("blockedTorrents.confirmBlock")))) break;
            await api(`/api/blocked-releases`, {
              method: "POST",
              body: JSON.stringify({
                infoHash: item.download.infoHash ?? item.id,
                releaseTitle: item.release.releaseTitle,
                mediaTitle: item.media.title,
                indexer: item.release.indexer,
              }),
            });
            await api(`${BASE}/torrents/${itemId}?deleteData=1`, { method: "DELETE" });
          }
          break;
        }
      }
    } catch (e) {
      console.error(`[queue] action ${action} failed:`, e);
    } finally {
      setActionLoading(null);
      await mutate();
    }
  };

  /** Post-completion manual seed toggle — a fully separate action from
   *  pause/resume above (those target an active download; this targets an
   *  already-completed, already-imported item's continued upload activity).
   *  Only ever called for item.status === "completed". */
  const toggleSeed = async (itemId: string, turnOn: boolean) => {
    setActionLoading(`seed_${itemId}`);
    patchLocal(itemId, (i) => ({ ...i, seeding: turnOn }));
    try {
      await api(`${BASE}/torrents/${itemId}/seed`, { method: "POST", body: JSON.stringify({ on: turnOn }) });
    } catch (e) {
      console.error(`[queue] seed toggle failed:`, e);
    } finally {
      setActionLoading(null);
      await mutate();
    }
  };

  const remove = async (itemId: string, withData: boolean) => {
    if (!(await confirmDialog(withData ? t("downloads.confirmRemove") : t("downloads.confirmRemoveKeep")))) return;
    setActionLoading(`remove_${itemId}`);
    // Drop it from view right away rather than leaving it sitting there
    // until the delete round-trip and next poll confirm it's gone.
    mutate((current) => current ? { items: current.items.filter((i) => i.id !== itemId) } : current, { revalidate: false });
    try {
      await api(`${BASE}/torrents/${itemId}?deleteData=${withData ? 1 : 0}`, { method: "DELETE" });
    } catch (e) {
      console.error(`[queue] remove failed:`, e);
    } finally {
      setActionLoading(null);
      await mutate();
    }
  };

  /** Single toggle button: pauses everything pausable, or — once nothing
   *  pausable is left — resumes everything paused. Concurrent, not paced
   *  like the indexer-search bulk actions below: pause/resume only ever hit
   *  the LOCAL engine (127.0.0.1), never an external indexer, so there's no
   *  rate limit to protect against here. */
  const toggleAll = async () => {
    const targets = resumeAllMode ? pausedItems : pausableItems;
    if (targets.length === 0) return;
    const action = resumeAllMode ? "resume" : "pause";
    const newStatus = action === "pause" ? "paused" : "downloading";
    setBulkPausing(true);
    const ids = new Set(targets.map((i) => i.id));
    mutate(
      (current) => current ? { items: current.items.map((i) => (ids.has(i.id) ? { ...i, status: newStatus } : i)) } : current,
      { revalidate: false }
    );
    try {
      await Promise.all(
        targets.map((item) =>
          api(`${BASE}/torrents/${item.id}/${action}`, { method: "POST" }).catch((e) => {
            console.error(`[queue] bulk ${action} failed for ${item.id}:`, e);
          })
        )
      );
    } finally {
      setBulkPausing(false);
      await mutate();
    }
  };


  const clearAll = async () => {
    if (!(await confirmDialog(t("downloads.confirmClearAll")))) return;
    setClearingAll(true);
    try {
      await api(`${BASE}/torrents/clear-all`, { method: "POST" });
    } catch (e) {
      console.error(`[queue] clear-all failed:`, e);
    } finally {
      globalMutate(SWR_KEY, { items: [] }, { revalidate: false });
      setClearingAll(false);
    }
  };

  /**
   * Bulk counterpart to the per-item red magnifying glass on a stalled
   * download — same exact flow (search → grab the best release → delete the
   * stuck torrent, tied via replacingInfoHash so claimed episodes aren't
   * briefly dropped to "missing"), just automatic (top-scored release, no
   * picker) and run for every currently stalled item instead of one at a
   * time. Deliberately sequential (one item fully done before the next
   * starts), not Promise.all — each item's own search already makes its own
   * indexer round-trip(s); running several of those concurrently would
   * multiply the request burst hitting the same indexers at once.
   */
  const replaceAllStalled = async () => {
    const targets = stalledItems;
    if (targets.length === 0) return;
    if (!(await confirmDialog(t("downloads.confirmReplaceBlocked", { count: targets.length })))) return;
    setBulkReplacing(true);
    setBulkProgress({ current: 0, total: targets.length });
    let replaced = 0;
    try {
      for (let i = 0; i < targets.length; i++) {
        const item = targets[i];
        try {
          const p = new URLSearchParams({ q: queueItemSearchQuery(item.media), category: item.media.type });
          p.set("refTitle", item.media.title);
          if (item.media.tmdbId) p.set("tmdbId", String(item.media.tmdbId));
          const searchData = await api(`/api/indexers/search?${p.toString()}`);
          const best: IndexerRelease | undefined = (searchData.releases ?? [])[0];
          if (best) {
            const quality = parseRelease(best.title).resolution ?? "Inconnue";
            const grabRes = await fetch("/api/indexers/grab", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                magnetUrl: best.magnetUrl,
                downloadUrl: best.downloadUrl,
                indexerId: best.indexerId,
                category: item.media.type,
                libraryRef: queueItemLibraryRef(item.media),
                title: item.media.title,
                indexerName: best.indexer,
                quality,
                score: best.score,
                size: best.size,
                protocol: best.protocol,
                seeders: best.seeders,
                leechers: best.leechers,
                replacingInfoHash: item.id,
              }),
            });
            if (grabRes.ok) {
              await api(`${BASE}/torrents/${item.id}?deleteData=1`, { method: "DELETE" });
              replaced++;
            }
          }
        } catch (e) {
          console.error(`[queue] bulk replace failed for ${item.id}:`, e);
        }
        setBulkProgress({ current: i + 1, total: targets.length });
        // Same pacing discipline as every other sequential multi-item search
        // path in the app (autoGrabSeries.ts's ITEM_DELAY_MS) — never fire
        // back-to-back item searches with zero gap.
        if (i < targets.length - 1) await new Promise((r) => setTimeout(r, 1500));
      }
    } finally {
      setBulkReplacing(false);
      setBulkProgress(null);
      await mutate();
    }
  };

  if (error) return <div className="rounded-2xl glass py-12 text-center text-sm text-down">{t("activity.loadError")}</div>;
  if (!data) return <div className="flex items-center justify-center gap-2 py-16 text-ink-dim"><Download className="h-5 w-5 animate-pulse" /> {t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 overflow-x-auto rounded-xl glass p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                filter === f ? "brand-gradient text-white shadow" : "text-ink-dim hover:text-ink"
              )}
            >
              {t(`downloads.filter.${f}`)}
              {f === "stalled" && stalledItems.length > 0 && (
                <span className="ml-1.5 rounded-full bg-down/20 px-1.5 py-0.5 text-[10px] text-down">
                  {stalledItems.length}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {user?.role === "admin" && (pausableItems.length > 0 || pausedItems.length > 0) && (
            <motion.button
              {...btnSpring}
              onClick={toggleAll}
              disabled={bulkPausing || bulkReplacing || clearingAll}
              title={resumeAllMode ? t("downloads.resumeAllHint") : t("downloads.pauseAllHint")}
              className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl glass px-3.5 py-2 text-xs font-semibold text-ink-soft transition-colors hover:bg-white/10 disabled:opacity-50"
            >
              {bulkPausing ? (
                <Loader className="h-3.5 w-3.5 animate-spin" />
              ) : resumeAllMode ? (
                <PlayCircle className="h-3.5 w-3.5" />
              ) : (
                <PauseCircle className="h-3.5 w-3.5" />
              )}
              {resumeAllMode ? t("downloads.resumeAll") : t("downloads.pauseAll")}
            </motion.button>
          )}
          {user?.role === "admin" && stalledItems.length > 0 && (
            <motion.button
              {...btnSpring}
              onClick={replaceAllStalled}
              disabled={bulkReplacing || clearingAll}
              title={t("downloads.replaceBlockedHint")}
              className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl glass px-3.5 py-2 text-xs font-semibold text-down transition-colors hover:bg-down/10 disabled:opacity-50"
            >
              {bulkReplacing ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              {bulkReplacing && bulkProgress ? `${t("downloads.replaceBlocked")} (${bulkProgress.current}/${bulkProgress.total})` : t("downloads.replaceBlocked")}
            </motion.button>
          )}
          {user?.role === "admin" && items.length > 0 && (
            <motion.button
              {...btnSpring}
              onClick={clearAll}
              disabled={clearingAll || bulkReplacing}
              title={t("downloads.clearAllHint")}
              className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl glass px-3.5 py-2 text-xs font-semibold text-down transition-colors hover:bg-down/10 disabled:opacity-50"
            >
              {clearingAll ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              {t("downloads.clearAll")}
            </motion.button>
          )}
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-xl glass p-4 text-center">
          <Download className="mx-auto mb-2 h-5 w-5 text-cyan" />
          <p className="text-sm text-ink-dim">{t("activity.status.downloading")}</p>
          <p className="text-2xl font-bold text-cyan">{activeItems.length}</p>
        </div>
        <div className="rounded-xl glass p-4 text-center">
          <Clock className="mx-auto mb-2 h-5 w-5 text-brand-glow" />
          <p className="text-sm text-ink-dim">{t("activity.status.queued")}</p>
          <p className="text-2xl font-bold text-brand-glow">{queuedItems.length}</p>
        </div>
        <div className="rounded-xl glass p-4 text-center">
          <Pause className="mx-auto mb-2 h-5 w-5 text-amber" />
          <p className="text-sm text-ink-dim">{t("activity.status.paused")}</p>
          <p className="text-2xl font-bold text-amber">{pausedItems.length}</p>
        </div>
        <div className="rounded-xl glass p-4 text-center">
          <AlertCircle className="mx-auto mb-2 h-5 w-5 text-down" />
          <p className="text-sm text-ink-dim">{t("downloads.states.stalled")}</p>
          <p className="text-2xl font-bold text-down">{stalledItems.length}</p>
        </div>
        <div className="rounded-xl glass p-4 text-center">
          <CheckCircle2 className="mx-auto mb-2 h-5 w-5 text-ok" />
          <p className="text-sm text-ink-dim">{t("activity.status.completed")}</p>
          <p className="text-2xl font-bold text-ok">{completedItems.length}</p>
        </div>
        <div className="col-span-2 rounded-xl glass p-4 text-center sm:col-span-3 lg:col-span-1">
          <List className="mx-auto mb-2 h-5 w-5 text-ink-dim" />
          <p className="text-sm text-ink-dim">{t("common.all")}</p>
          <p className="text-2xl font-bold text-ink">{items.length}</p>
        </div>
      </div>

      <div className="space-y-3">
        {(() => {
          let lastSection: string | null = null;
          const rows: React.ReactNode[] = [];
          for (const item of visibleItems) {
            const section = sectionOf(item.status);
            if (section !== lastSection) {
              rows.push(
                <div key={`section-${section}`} className="flex items-center gap-2 pt-2 first:pt-0">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-ink-dim">
                    {t(`activity.section.${section}`)}
                  </h3>
                  <span className="rounded-full bg-white/8 px-1.5 py-0.5 text-[10px] font-bold text-ink-dim">
                    {sectionCounts[section] ?? 0}
                  </span>
                </div>
              );
              lastSection = section;
            }
            rows.push(
              <QueueItemRow
                key={item.id}
                item={item}
                isExpanded={expandedItem === item.id}
                actionLoading={actionLoading}
                t={t}
                locale={locale}
                onToggleExpand={toggleExpand}
                onAction={handleAction}
                onSetPriority={setPriority}
                onToggleSeed={toggleSeed}
                onRemove={remove}
                canManage={user?.role === "admin"}
              />
            );
          }
          return rows;
        })()}
      </div>

      {filtered.length > visibleItems.length && (
        <button
          onClick={() => setVisibleCount((c) => c + RENDER_BATCH_STEP)}
          className="mx-auto flex h-11 items-center gap-2 rounded-xl bg-white/5 px-4 text-sm font-semibold text-ink-soft transition-colors hover:bg-white/10"
        >
          <List className="h-4 w-4" />
          {t("activity.showMore", { n: filtered.length - visibleItems.length })}
        </button>
      )}

      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl glass py-16 text-center">
          <Download className="h-8 w-8 text-brand-glow/50" />
          <p className="font-semibold text-ink">{t("activity.noQueue")}</p>
          <p className="max-w-md text-sm text-ink-dim">{t("activity.noQueueHint")}</p>
        </div>
      )}

      {manualSearchItem && (
        <ManualSearchModal
          open={!!manualSearchItem}
          onClose={() => setManualSearchItem(null)}
          libraryRef={queueItemLibraryRef(manualSearchItem.media)}
          query={queueItemSearchQuery(manualSearchItem.media)}
          category={manualSearchItem.media.type}
          refTitle={manualSearchItem.media.title}
          tmdbId={manualSearchItem.media.tmdbId}
          title={queueItemSearchTitle(manualSearchItem.media)}
          replaceItemId={manualSearchItem.status === "stalled" ? manualSearchItem.id : undefined}
          onReplaced={() => {
            setManualSearchItem(null);
            mutate((current) => current ? { items: current.items.filter((i) => i.id !== manualSearchItem.id) } : current, { revalidate: false });
            mutate();
          }}
        />
      )}
    </div>
  );
}

/** Compares only the data fields that actually change on every 3s poll so
 *  React.memo can skip re-render for items whose progress/speed/status are
 *  identical to the previous poll. Without this every item re-renders every
 *  3s — ~300 lines of JSX per item × 20+ items adds up to real CPU time. */
const areItemEqual = (prev: QueueItemRowProps, next: QueueItemRowProps) => {
  if (prev.item.id !== next.item.id) return false;
  if (prev.isExpanded !== next.isExpanded) return false;
  if (prev.actionLoading !== next.actionLoading) return false;
  const a = prev.item;
  const b = next.item;
  if (a.status !== b.status) return false;
  if (a.seeding !== b.seeding) return false;
  if (a.download.progress !== b.download.progress) return false;
  if (a.download.downloadSpeed !== b.download.downloadSpeed) return false;
  if (a.download.uploadSpeed !== b.download.uploadSpeed) return false;
  if (a.download.eta !== b.download.eta) return false;
  if (a.download.ratio !== b.download.ratio) return false;
  if (a.download.peers !== b.download.peers) return false;
  if (a.release.seeders !== b.release.seeders) return false;
  if (a.priority !== b.priority) return false;
  return true;
};

interface QueueItemRowProps {
  item: QueueItem;
  isExpanded: boolean;
  actionLoading: string | null;
  t: (k: string, params?: Record<string, string | number>) => string;
  locale: string;
  onToggleExpand: (id: string) => void;
  onAction: (id: string, action: "pause" | "resume" | "restart" | "retry" | "search" | "block") => void;
  onSetPriority: (id: string, priority: "high" | "medium" | "low") => void;
  onToggleSeed: (id: string, turnOn: boolean) => void;
  onRemove: (id: string, withData: boolean) => void;
  canManage: boolean;
}

const PRIORITY_ORDER = ["high", "medium", "low"] as const;

const QueueItemRow = memo(function QueueItemRow({
  item, isExpanded, actionLoading, t, locale,
  onToggleExpand, onAction, onSetPriority, onToggleSeed, onRemove, canManage,
}: QueueItemRowProps) {
  const reduceMotion = useShouldReduceMotion();
  const displayProgress = useSmoothProgress(item.download.progress, item.release.size, item.download.downloadSpeed);
  const [priorityOpen, setPriorityOpen] = useState(false);
  const priorityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!priorityOpen) return;
    const onClick = (e: MouseEvent) => {
      if (priorityRef.current && !priorityRef.current.contains(e.target as Node)) setPriorityOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [priorityOpen]);

  const btnSpring = reduceMotion ? {} : {
    whileTap: { scale: 0.95 },
    transition: { type: "spring" as const, stiffness: 400, damping: 17 },
  };

  const isActive = item.status === "downloading" || item.status === "importing" || item.status === "verifying";
  const parsed = parseRelease(item.release.releaseTitle);
  const badgeItems = buildMediaBadgeItems(
    { resolution: parsed.resolution, videoCodec: parsed.videoCodec, audioCodec: parsed.audioCodec, hdr: parsed.hdr, source: parsed.source, language: parsed.language },
    "surface",
  );

  return (
    <div className="rounded-2xl glass overflow-hidden">
      <div
        className="p-4 cursor-pointer hover:bg-white/5"
        onClick={() => onToggleExpand(item.id)}
      >
        <div className="flex items-start gap-3">
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            item.media.type === "movie" ? "bg-brand/12 text-brand-glow" : "bg-cyan/12 text-cyan")}>
            {item.media.type === "movie" ? <Film className="h-5 w-5" /> : <Tv className="h-5 w-5" />}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              {item.media.linked === false ? (
                <span className="truncate font-semibold text-ink" title={t("activity.queueUnlinkedHint")}>
                  {item.media.title}
                  {item.media.season != null && (
                    <span className="text-ink-dim">
                      {" — "}
                      {item.media.episode != null
                        ? `S${item.media.season}E${String(item.media.episode).padStart(2, "0")}`
                        : `S${item.media.season}`}
                    </span>
                  )}
                </span>
              ) : (
                <Link href={item.media?.href ?? "#"} className="truncate font-semibold text-ink hover:text-brand-glow">
                  {item.media.title}
                  {item.media.packEpisodeCount ? (
                    <span className="text-ink-dim">
                      {" — "}
                      {item.media.season === 0
                        ? item.media.seasonCount && item.media.seasonCount > 1
                          ? t("activity.completeSeriesPackSeason", { count: item.media.packEpisodeCount ?? 0, seasons: item.media.seasonCount })
                          : t("activity.completeSeriesPack", { count: item.media.packEpisodeCount ?? 0 })
                        : t("activity.seasonPack", { season: item.media.season ?? 0, count: item.media.packEpisodeCount ?? 0 })}
                    </span>
                  ) : item.media.season && item.media.episode ? (
                    <span className="text-ink-dim">
                      {" — "}
                      {`S${item.media.season}E${String(item.media.episode).padStart(2, "0")}`}
                    </span>
                  ) : null}
                </Link>
              )}
              <span className="shrink-0 whitespace-nowrap font-mono text-[11px] text-ink-dim">{formatDateTime(item.addedAt, locale)}</span>
            </div>
            {item.media.linked === false && (
              <span className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-amber/25 bg-amber/12 px-2 py-0.5 text-[10px] font-bold text-amber">
                <AlertCircle className="h-2.5 w-2.5" /> {t("activity.queueUnlinkedBadge")}
              </span>
            )}

            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-ink-dim">
              <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold",
                item.status === "downloading" ? "border-cyan/30 bg-cyan/12 text-cyan" :
                item.status === "importing" ? "border-brand/30 bg-brand/12 text-brand-glow" :
                item.status === "verifying" ? "border-magenta/30 bg-magenta/12 text-magenta" :
                item.status === "paused" ? "border-amber/30 bg-amber/12 text-amber" :
                item.status === "stalled" ? "border-down/30 bg-down/12 text-down" :
                item.status === "seeding" ? "border-ok/30 bg-ok/12 text-ok" :
                item.status === "completed" ? "border-ok/30 bg-ok/12 text-ok" :
                item.status === "queued" ? "border-white/20 bg-white/10 text-ink-soft" :
                "border-white/10 bg-white/5 text-ink-dim")}>
                {item.status === "stalled" ? t("downloads.states.stalled") : t(`activity.status.${item.status}`)}
              </span>
              <span className="flex items-center gap-1">
                <Download className="h-3 w-3" /> {item.release.indexer}
              </span>
              {badgeItems.length > 0 ? (
                <span className="flex flex-wrap items-center gap-1">{badgeItems}</span>
              ) : (
                <span className="flex items-center gap-1">
                  <Check className="h-3 w-3" /> {item.release.quality}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" /> {item.release.seeders}↑ {item.release.leechers}↓
              </span>
              <span>{t("search.score")}: {item.release.score}</span>
              <span className="flex items-center gap-1">
                <ArrowUpFromLine className="h-3 w-3" /> Ratio: {item.download.ratio.toFixed(2)}
              </span>
            </div>

            {isActive && (
              <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                <div className="h-1.5 overflow-hidden rounded-full bg-black/40">
                  <motion.div
                    className={cn(
                      "h-full rounded-full",
                      "brand-gradient",
                      !reduceMotion && "animate-shimmer-progress bg-[linear-gradient(90deg,var(--color-brand)_0%,var(--color-brand-glow)_25%,var(--color-brand-2)_50%,var(--color-brand-glow)_75%,var(--color-brand)_100%)]"
                    )}
                    animate={{ width: `${Math.round(displayProgress * 100)}%` }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                  />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-dim">
                  <span className="font-mono text-ink-soft">{Math.round(displayProgress * 100)}%</span>
                  <span>
                    {formatBytes(displayProgress * item.release.size)} / {formatBytes(item.release.size)}
                  </span>
                  {item.download.eta > 0 && (
                    <span>{t("downloads.eta")}: {formatEta(Math.round(item.download.eta / 60))}</span>
                  )}
                  {item.download.downloadSpeed > 0 && (
                    <span>↓{formatSpeed(item.download.downloadSpeed)}</span>
                  )}
                  {item.download.uploadSpeed > 0 && (
                    <span>↑{formatSpeed(item.download.uploadSpeed)}</span>
                  )}
                </div>
              </div>
            )}

            {item.status === "seeding" && item.download.uploadSpeed > 0 && (
              <div className="mt-2 text-[11px] text-ink-dim">
                <span>↑{formatSpeed(item.download.uploadSpeed)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-3 flex shrink-0 justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          {item.status === "downloading" && (
            <motion.button
              {...btnSpring}
              onClick={(e) => { e.stopPropagation(); onAction(item.id, "pause"); }}
              disabled={actionLoading !== null}
              title={t("downloads.pause")}
              className="flex h-11 w-11 items-center justify-center rounded-lg glass transition-colors hover:bg-white/10 disabled:opacity-40"
            >
              {actionLoading === `pause_${item.id}` ? <Loader className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
            </motion.button>
          )}
          {item.status === "paused" && (
            <motion.button
              {...btnSpring}
              onClick={(e) => { e.stopPropagation(); onAction(item.id, "resume"); }}
              disabled={actionLoading !== null}
              title={t("downloads.resume")}
              className="flex h-11 w-11 items-center justify-center rounded-lg glass transition-colors hover:bg-white/10 disabled:opacity-40"
            >
              {actionLoading === `resume_${item.id}` ? <Loader className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            </motion.button>
          )}
          {item.status === "queued" && (
            <motion.button
              {...btnSpring}
              onClick={(e) => { e.stopPropagation(); onAction(item.id, "resume"); }}
              disabled={actionLoading !== null}
              title={t("downloads.startNow")}
              className="flex h-11 w-11 items-center justify-center rounded-lg glass transition-colors hover:bg-white/10 disabled:opacity-40"
            >
              {actionLoading === `resume_${item.id}` ? <Loader className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            </motion.button>
          )}
          {item.status === "stalled" && (
            <motion.button
              {...btnSpring}
              onClick={(e) => { e.stopPropagation(); onAction(item.id, "restart"); }}
              disabled={actionLoading !== null}
              title={t("downloads.restart")}
              className="flex h-11 w-11 items-center justify-center rounded-lg glass transition-colors hover:bg-white/10 disabled:opacity-40"
            >
              {actionLoading === `restart_${item.id}` ? <Loader className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </motion.button>
          )}
          {(item.status === "downloading" || item.status === "paused" || item.status === "stalled" || item.status === "queued") && (
            <div ref={priorityRef} className="relative">
              <motion.button
                {...btnSpring}
                onClick={(e) => { e.stopPropagation(); setPriorityOpen((o) => !o); }}
                disabled={actionLoading !== null}
                title={t(`downloads.priority.${item.priority ?? "medium"}`)}
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-lg glass transition-colors hover:bg-white/10 disabled:opacity-40",
                  item.priority === "high" ? "text-brand-glow" : item.priority === "low" ? "text-ink-dim" : ""
                )}
              >
                <Gauge className="h-4 w-4" />
              </motion.button>
              {priorityOpen && (
                <div className="absolute right-0 top-12 z-20 w-36 overflow-hidden rounded-xl border border-white/10 bg-void shadow-2xl">
                  {PRIORITY_ORDER.map((p) => (
                    <button
                      key={p}
                      onClick={(e) => {
                        e.stopPropagation();
                        onSetPriority(item.id, p);
                        setPriorityOpen(false);
                      }}
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-2.5 text-left text-xs font-semibold transition-colors hover:bg-white/10",
                        (item.priority ?? "medium") === p ? "text-brand-glow" : "text-ink-soft"
                      )}
                    >
                      {t(`downloads.priority.${p}`)}
                      {(item.priority ?? "medium") === p && <Check className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {(item.status === "downloading" || item.status === "paused" || item.status === "stalled") && (
            <motion.button
              {...btnSpring}
              onClick={(e) => { e.stopPropagation(); onAction(item.id, "search"); }}
              disabled={actionLoading !== null}
              title={item.status === "stalled" ? t("downloads.replace") : t("downloads.manual")}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-lg glass transition-colors hover:bg-white/10 disabled:opacity-40",
                item.status === "stalled" && "text-down hover:bg-down/15"
              )}
            >
              <Search className="h-4 w-4" />
            </motion.button>
          )}
          {item.status === "completed" && (
            <motion.button
              {...btnSpring}
              onClick={(e) => { e.stopPropagation(); onToggleSeed(item.id, !item.seeding); }}
              disabled={actionLoading !== null}
              title={item.seeding ? t("downloads.unseed") : t("downloads.seed")}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-lg glass transition-colors hover:bg-white/10 disabled:opacity-40",
                item.seeding && "text-ok"
              )}
            >
              {actionLoading === `seed_${item.id}` ? <Loader className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
            </motion.button>
          )}
          {canManage && (
            <motion.button
              {...btnSpring}
              onClick={(e) => { e.stopPropagation(); onAction(item.id, "block"); }}
              disabled={actionLoading !== null}
              title={t("blockedTorrents.block")}
              className="flex h-11 w-11 items-center justify-center rounded-lg glass text-down transition-colors hover:bg-down/15 disabled:opacity-40"
            >
              {actionLoading === `block_${item.id}` ? <Loader className="h-4 w-4 animate-spin" /> : <Ban className="h-4 w-4" />}
            </motion.button>
          )}
          <motion.button
            {...btnSpring}
            onClick={(e) => { e.stopPropagation(); onRemove(item.id, false); }}
            disabled={actionLoading !== null}
            title={t("downloads.remove")}
            className="flex h-11 w-11 items-center justify-center rounded-lg glass transition-colors hover:bg-down/15 hover:text-down disabled:opacity-40"
          >
            {actionLoading === `remove_${item.id}` ? <Loader className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </motion.button>
          <motion.button
            {...btnSpring}
            onClick={(e) => { e.stopPropagation(); onRemove(item.id, true); }}
            disabled={actionLoading !== null}
            title={t("downloads.removeData")}
            className="flex h-11 w-11 items-center justify-center rounded-lg glass transition-colors hover:bg-down/15 hover:text-down disabled:opacity-40"
          >
            {actionLoading === `remove_${item.id}` ? <Loader className="h-4 w-4 animate-spin" /> : <><Trash2 className="h-4 w-4" /> <X className="h-3 w-3 -ml-1" /></>}
          </motion.button>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-white/10 bg-surface/30 p-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <h4 className="mb-2 font-semibold text-ink">{t("downloads.title")}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-dim">{t("common.loading")}</span>
                  <span className="font-mono">{Math.round(displayProgress * 100)}%</span>
                </div>
                  <div className="h-2 overflow-hidden rounded-full bg-black/40">
                    <motion.div
                      className={cn(
                        "h-full rounded-full",
                        "brand-gradient",
                        isActive && !reduceMotion && "animate-shimmer-progress bg-[linear-gradient(90deg,var(--color-brand)_0%,var(--color-brand-glow)_25%,var(--color-brand-2)_50%,var(--color-brand-glow)_75%,var(--color-brand)_100%)]"
                      )}
                      animate={{ width: `${displayProgress * 100}%` }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                    />
                  </div>
                <div className="flex justify-between">
                  <span className="text-ink-dim">{t("downloads.down")}</span>
                  <span>{formatSpeed(item.download.downloadSpeed)} ↓ / {formatSpeed(item.download.uploadSpeed)} ↑</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-dim">{t("downloads.eta")}</span>
                  <span>{item.download.eta > 0 ? formatEta(Math.round(item.download.eta / 60)) : "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-dim">{t("downloads.ratio")}</span>
                  <span>{item.download.ratio.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-dim">{t("downloads.peers")}</span>
                  <span>{item.download.peers}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-dim">{t("activity.addedAt")}</span>
                  <span>{formatDateTime(item.addedAt, locale)}</span>
                </div>
              </div>
            </div>

            <div>
              <h4 className="mb-2 font-semibold text-ink">{t("search.release")}</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="shrink-0 text-ink-dim">{t("search.release")}</span>
                  <span className="min-w-0 truncate font-mono text-xs" title={item.release.releaseTitle}>{item.release.releaseTitle}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-dim">{t("search.size")}</span>
                  <span>{formatBytes(item.release.size)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-dim">{t("filters.quality")}</span>
                  <span>{item.release.quality}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-dim">{t("search.indexer")}</span>
                  <span>{item.release.indexer}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-ink-dim">{t("customFormats.title")}</span>
                  <span>{item.release.customFormats.join(", ") || "—"}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}, areItemEqual);
