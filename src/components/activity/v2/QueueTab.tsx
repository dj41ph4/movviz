"use client";

import { useState, useMemo, memo } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n, useT } from "@/i18n/provider";
import { cn, formatBytes, formatSpeed, formatEta, formatClockTime, formatDateTime } from "@/lib/utils";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import type { QueueItem } from "@/lib/activity/v2/types";
import {
  Film, Tv, Download, Pause, Play, RotateCw, Search, Ban, Check,
  Users, AlertCircle, Loader, List, Clock, Trash2, X, RefreshCw, ArrowUpFromLine,
} from "lucide-react";

const BASE = "/api/engine";

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(path, { ...opts, headers: { "content-type": "application/json", ...opts?.headers } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

const FILTERS = ["all", "downloading", "seeding", "stalled", "completed"] as const;
type Filter = (typeof FILTERS)[number];

export function QueueTab({ active = true }: { active?: boolean }) {
  const t = useT();
  const { locale } = useI18n();
  const router = useRouter();
  const user = useCurrentUser();
  const { data, error, mutate } = useSWR<{ items: QueueItem[] }>(
    "/api/activity/v2?tab=queue", { refreshInterval: 3000, dedupingInterval: 2000 }
  );
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const items = data?.items ?? [];
  const activeItems = useMemo(() => items.filter(item => item.status === "downloading" || item.status === "importing"), [items]);
  const stalledItems = useMemo(() => items.filter(item => item.status === "stalled"), [items]);
  const pausedItems = useMemo(() => items.filter(item => item.status === "paused"), [items]);

  const filtered = useMemo(() => items.filter((item) => {
    if (filter === "downloading") return item.status === "downloading" || item.status === "importing";
    if (filter === "seeding") return item.status === "seeding";
    if (filter === "stalled") return item.status === "stalled";
    if (filter === "completed") return item.status === "completed";
    return true;
  }), [items, filter]);

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
          if (item) {
            const p = new URLSearchParams({ q: item.media.title });
            if (item.media.tmdbId) p.set("tmdbId", String(item.media.tmdbId));
            if (item.media.type) p.set("category", item.media.type);
            router.push(`/search?${p.toString()}`);
          }
          break;
        }
        case "block": {
          const item = items.find(i => i.id === itemId);
          if (item) {
            await api(`/api/blocklist`, {
              method: "POST",
              body: JSON.stringify({
                type: item.media.type,
                tmdbId: item.media.id,
                reason: t("queue.blockedFromQueueReason"),
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

  const remove = async (itemId: string, withData: boolean) => {
    if (!confirm(withData ? t("downloads.confirmRemove") : t("downloads.confirmRemoveKeep"))) return;
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

  const clearAll = async () => {
    if (!confirm(t("downloads.confirmClearAll"))) return;
    setClearingAll(true);
    mutate({ items: [] }, { revalidate: false });
    try {
      await api(`${BASE}/torrents/clear-all`, { method: "POST" });
    } catch (e) {
      console.error(`[queue] clear-all failed:`, e);
    } finally {
      setClearingAll(false);
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
        {user?.role === "admin" && items.length > 0 && (
          <button
            onClick={clearAll}
            disabled={clearingAll}
            title={t("downloads.clearAllHint")}
            className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl glass px-3.5 py-2 text-xs font-semibold text-down transition-colors hover:bg-down/10 disabled:opacity-50"
          >
            {clearingAll ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {t("downloads.clearAll")}
          </button>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl glass p-4 text-center">
          <Download className="mx-auto mb-2 h-5 w-5 text-cyan" />
          <p className="text-sm text-ink-dim">{t("activity.status.downloading")}</p>
          <p className="text-2xl font-bold text-cyan">{activeItems.length}</p>
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
          <List className="mx-auto mb-2 h-5 w-5 text-ink-dim" />
          <p className="text-sm text-ink-dim">{t("common.all")}</p>
          <p className="text-2xl font-bold text-ink">{items.length}</p>
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((item) => (
          <QueueItemRow
            key={item.id}
            item={item}
            isExpanded={expandedItem === item.id}
            actionLoading={actionLoading}
            t={t}
            locale={locale}
            onToggleExpand={toggleExpand}
            onAction={handleAction}
            onRemove={remove}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl glass py-16 text-center">
          <Download className="h-8 w-8 text-brand-glow/50" />
          <p className="font-semibold text-ink">{t("activity.noQueue")}</p>
          <p className="max-w-md text-sm text-ink-dim">{t("activity.noQueueHint")}</p>
        </div>
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
  if (a.download.progress !== b.download.progress) return false;
  if (a.download.downloadSpeed !== b.download.downloadSpeed) return false;
  if (a.download.uploadSpeed !== b.download.uploadSpeed) return false;
  if (a.download.eta !== b.download.eta) return false;
  if (a.download.ratio !== b.download.ratio) return false;
  if (a.download.peers !== b.download.peers) return false;
  if (a.release.seeders !== b.release.seeders) return false;
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
  onRemove: (id: string, withData: boolean) => void;
}

const QueueItemRow = memo(function QueueItemRow({
  item, isExpanded, actionLoading, t, locale,
  onToggleExpand, onAction, onRemove,
}: QueueItemRowProps) {
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
              <Link href={item.media.href} className="truncate font-semibold text-ink hover:text-brand-glow">
                {item.media.title}
                {item.media.packEpisodeCount ? (
                  <span className="text-ink-dim">
                    {" — "}
                    {item.media.season === 0
                      ? t("library.searchCompleteSeries")
                      : t("activity.seasonPack", { season: item.media.season ?? 0, count: item.media.packEpisodeCount ?? 0 })}
                  </span>
                ) : item.media.season && item.media.episode ? (
                  <span className="text-ink-dim">
                    {" — "}
                    {`S${item.media.season}E${String(item.media.episode).padStart(2, "0")}`}
                  </span>
                ) : null}
              </Link>
              <span className="shrink-0 font-mono text-[11px] text-ink-dim" title={formatDateTime(item.addedAt, locale)}>
                {formatClockTime(item.addedAt, locale)}
              </span>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-ink-dim">
              <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold",
                item.status === "downloading" ? "border-cyan/30 bg-cyan/12 text-cyan" :
                item.status === "importing" ? "border-brand/30 bg-brand/12 text-brand-glow" :
                item.status === "paused" ? "border-amber/30 bg-amber/12 text-amber" :
                item.status === "stalled" ? "border-down/30 bg-down/12 text-down" :
                item.status === "seeding" ? "border-ok/30 bg-ok/12 text-ok" :
                item.status === "completed" ? "border-ok/30 bg-ok/12 text-ok" :
                "border-white/10 bg-white/5 text-ink-dim")}>
                {item.status === "stalled" ? t("downloads.states.stalled") : t(`activity.status.${item.status}`)}
              </span>
              <span className="flex items-center gap-1">
                <Download className="h-3 w-3" /> {item.release.indexer}
              </span>
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3" /> {item.release.quality}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" /> {item.release.seeders}↑ {item.release.leechers}↓
              </span>
              <span>{t("search.score")}: {item.release.score}</span>
              <span className="flex items-center gap-1">
                <ArrowUpFromLine className="h-3 w-3" /> Ratio: {item.download.ratio.toFixed(2)}
              </span>
            </div>

            {(item.status === "downloading" || item.status === "importing") && (
              <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                <div className="h-1.5 overflow-hidden rounded-full bg-black/40">
                  <div
                    className="h-full rounded-full brand-gradient transition-[width]"
                    style={{ width: `${Math.round(item.download.progress * 100)}%` }}
                  />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-ink-dim">
                  <span className="font-mono text-ink-soft">{Math.round(item.download.progress * 100)}%</span>
                  <span>
                    {formatBytes(item.download.progress * item.release.size)} / {formatBytes(item.release.size)}
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
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onAction(item.id, "pause"); }}
                disabled={actionLoading !== null}
                title={t("downloads.pause")}
                className="flex h-8 w-8 items-center justify-center rounded-lg glass transition-colors hover:bg-white/10 disabled:opacity-40"
              >
                {actionLoading === `pause_${item.id}` ? <Loader className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onAction(item.id, "search"); }}
                disabled={actionLoading !== null}
                title={t("downloads.manual")}
                className="flex h-8 w-8 items-center justify-center rounded-lg glass transition-colors hover:bg-white/10 disabled:opacity-40"
              >
                <Search className="h-4 w-4" />
              </button>
            </>
          )}
          {item.status === "paused" && (
            <button
              onClick={(e) => { e.stopPropagation(); onAction(item.id, "resume"); }}
              disabled={actionLoading !== null}
              title={t("downloads.resume")}
              className="flex h-8 w-8 items-center justify-center rounded-lg glass transition-colors hover:bg-white/10 disabled:opacity-40"
            >
              {actionLoading === `resume_${item.id}` ? <Loader className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            </button>
          )}
          {item.status === "stalled" && (
            <button
              onClick={(e) => { e.stopPropagation(); onAction(item.id, "restart"); }}
              disabled={actionLoading !== null}
              title={t("downloads.restart")}
              className="flex h-8 w-8 items-center justify-center rounded-lg glass transition-colors hover:bg-white/10 disabled:opacity-40"
            >
              {actionLoading === `restart_${item.id}` ? <Loader className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(item.id, false); }}
            disabled={actionLoading !== null}
            title={t("downloads.remove")}
            className="flex h-8 w-8 items-center justify-center rounded-lg glass transition-colors hover:bg-down/15 hover:text-down disabled:opacity-40"
          >
            {actionLoading === `remove_${item.id}` ? <Loader className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(item.id, true); }}
            disabled={actionLoading !== null}
            title={t("downloads.removeData")}
            className="flex h-8 w-8 items-center justify-center rounded-lg glass transition-colors hover:bg-down/15 hover:text-down disabled:opacity-40"
          >
            {actionLoading === `remove_${item.id}` ? <Loader className="h-4 w-4 animate-spin" /> : <><Trash2 className="h-4 w-4" /> <X className="h-3 w-3 -ml-1" /></>}
          </button>
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
                  <span className="font-mono">{Math.round(item.download.progress * 100)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-black/40">
                  <div className="h-full rounded-full brand-gradient" style={{ width: `${item.download.progress * 100}%` }} />
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
                <div className="flex justify-between">
                  <span className="text-ink-dim">{t("search.release")}</span>
                  <span className="font-mono text-xs">{item.release.releaseTitle}</span>
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