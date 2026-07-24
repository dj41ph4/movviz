"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useI18n, useT } from "@/i18n/provider";
import { cn, formatDateTime } from "@/lib/utils";
import { useQualityUpgradesEnabled } from "@/lib/settings/useQualityUpgradesEnabled";
import { isOnCooldown, markSearched, getRemainingCooldown } from "@/lib/activity/v2/searchCache";
import { useJobRunning } from "@/lib/jobs/useJobRunning";
import type { WantedItem } from "@/lib/activity/v2/types";
import { Film, Tv, Search, RotateCw, Calendar, Check, X, AlertCircle, Users, Loader, Clock } from "lucide-react";

const RENDER_BATCH_INITIAL = 100;
const RENDER_BATCH_STEP = 150;

async function api(path: string, opts?: RequestInit) {
  const res = await fetch(path, { ...opts, headers: { "content-type": "application/json", ...opts?.headers } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export function WantedTab({ active = true }: { active?: boolean }) {
  const t = useT();
  const { locale } = useI18n();
  const router = useRouter();
  const { enabled: upgradesEnabled } = useQualityUpgradesEnabled();
  const { data, error, mutate } = useSWR<{ missing: WantedItem[]; cutoffUnmet: WantedItem[] }>(
    "/api/activity/v2?tab=wanted"
  );
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "date">("name");
  const [filterType, setFilterType] = useState<"all" | "movie" | "series">("all");

  const missing = data?.missing ?? [];
  const cutoffUnmet = upgradesEnabled ? (data?.cutoffUnmet ?? []) : [];
  const allItems = [...missing, ...cutoffUnmet]
    .filter((item) => filterType === "all" || item.media.type === filterType)
    .sort((a, b) => {
      if (sortBy === "name") return a.media.title.localeCompare(b.media.title);
      const dateA = a.releaseDate ? new Date(a.releaseDate).getTime() : 0;
      const dateB = b.releaseDate ? new Date(b.releaseDate).getTime() : 0;
      return dateB - dateA;
    });

  // Progressive rendering: a large library can have thousands of missing
  // items — rendering them all in one pass froze the tab on every SWR poll.
  // Paint the first batch immediately, mount the rest in idle time.
  const [visibleCount, setVisibleCount] = useState(RENDER_BATCH_INITIAL);
  useEffect(() => {
    setVisibleCount(RENDER_BATCH_INITIAL);
  }, [filterType, sortBy]);
  useEffect(() => {
    if (visibleCount >= allItems.length) return;
    const grow = () => setVisibleCount((c) => c + RENDER_BATCH_STEP);
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(grow);
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(grow, 50);
    return () => window.clearTimeout(id);
  }, [visibleCount, allItems.length]);
  const visibleItems = allItems.slice(0, visibleCount);

  const toggleSelectItem = (id: string) => {
    setSelectedItems(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    const newSelectAll = !selectAll;
    setSelectAll(newSelectAll);
    setSelectedItems(newSelectAll ? allItems.map(item => item.media.id) : []);
  };

  const triggerSearch = async (item: WantedItem) => {
    markSearched(item.media.id);
    if (item.media.type === "movie") {
      await api(`/api/library/movies/${item.media.id}/search`, { method: "POST" });
    } else if (item.media.season != null && item.media.episode != null) {
      await api(`/api/library/series/${item.media.id}/episode/${item.media.season}/${item.media.episode}/search`, { method: "POST" });
    } else if (item.media.season != null) {
      await api(`/api/library/series/${item.media.id}/season/${item.media.season}/search`, { method: "POST" });
    }
  };

  const setMonitored = async (item: WantedItem, monitored: boolean) => {
    if (item.media.type === "movie") {
      await api(`/api/library/movies/${item.media.id}`, {
        method: "PATCH",
        body: JSON.stringify({ monitored }),
      });
    } else {
      await api(`/api/library/series/${item.media.id}`, {
        method: "PATCH",
        body: JSON.stringify({ monitored }),
      });
    }
  };

  /** A wanted item only shows up while monitored (or cutoff-unmet) — toggling
   *  monitored always makes it disappear from this list one way or another,
   *  so drop it from the local cache immediately instead of leaving it
   *  sitting there until the next poll confirms the change. */
  const dropLocally = (ids: string[]) => {
    const idSet = new Set(ids);
    mutate(
      (current) =>
        current
          ? {
              missing: current.missing.filter((i) => !idSet.has(i.media.id)),
              cutoffUnmet: current.cutoffUnmet.filter((i) => !idSet.has(i.media.id)),
            }
          : current,
      { revalidate: false }
    );
  };

  const handleBulkAction = async (action: "search" | "monitor" | "unmonitor") => {
    setActionLoading(`bulk_${action}`);
    const selectedItemsList = allItems.filter(item => selectedItems.includes(item.media.id));
    if (action !== "search") dropLocally(selectedItemsList.map((i) => i.media.id));
    try {
      await Promise.all(
        selectedItemsList.map(async (item) => {
          if (action === "search") await triggerSearch(item);
          else await setMonitored(item, action === "monitor");
        })
      );
    } catch (e) {
      console.error(`[wanted] bulk ${action} failed:`, e);
    } finally {
      setActionLoading(null);
      setSelectedItems([]);
      setSelectAll(false);
      await mutate();
    }
  };

  const handleSingleAction = async (item: WantedItem, action: "search" | "monitor" | "unmonitor") => {
    setActionLoading(`${action}_${item.media.id}`);
    if (action !== "search") dropLocally([item.media.id]);
    try {
      if (action === "search") await triggerSearch(item);
      else await setMonitored(item, action === "monitor");
    } catch (e) {
      console.error(`[wanted] ${action} failed:`, e);
    } finally {
      setActionLoading(null);
      await mutate();
    }
  };

  if (error) return <div className="rounded-2xl glass py-12 text-center text-sm text-down">{t("activity.loadError")}</div>;
  if (!data) return <div className="flex items-center justify-center gap-2 py-16 text-ink-dim"><Search className="h-5 w-5 animate-pulse" /> {t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      {/* Actions groupées */}
      {allItems.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl glass p-4">
          <button
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 text-sm text-ink-dim hover:text-ink"
          >
            {selectAll ? <X className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {selectAll ? t("activity.deselectAll") : t("activity.selectAll")}
          </button>
          {selectedItems.length > 0 && (
            <>
              <span className="text-sm text-ink-dim">{t("activity.selectedCount", { n: selectedItems.length })}</span>
              <div className="ml-auto flex gap-2">
                <button
                  onClick={() => handleBulkAction("search")}
                  disabled={actionLoading !== null}
                  className="flex items-center gap-1.5 rounded-lg brand-gradient px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                >
                  {actionLoading === "bulk_search" ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />} {t("activity.status.missing")}
                </button>
                <button
                  onClick={() => handleBulkAction("monitor")}
                  disabled={actionLoading !== null}
                  className="flex items-center gap-1.5 rounded-lg glass px-3 py-1.5 text-xs font-bold text-ink-soft disabled:opacity-50"
                >
                  {actionLoading === "bulk_monitor" ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} {t("activity.monitor")}
                </button>
                <button
                  onClick={() => handleBulkAction("unmonitor")}
                  disabled={actionLoading !== null}
                  className="flex items-center gap-1.5 rounded-lg glass px-3 py-1.5 text-xs font-bold text-ink-soft disabled:opacity-50"
                >
                  {actionLoading === "bulk_unmonitor" ? <Loader className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />} {t("activity.unmonitor")}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Filtre par type + Tri */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-1 rounded-xl glass p-1">
          {(["all", "movie", "series"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={cn("flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition",
                filterType === type ? "brand-gradient text-white" : "text-ink-soft hover:text-ink")}
            >
              {type === "movie" ? <Film className="h-3.5 w-3.5" /> : type === "series" ? <Tv className="h-3.5 w-3.5" /> : null}
              {t(type === "all" ? "activity.all" : type === "movie" ? "common.movies" : "common.series")}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-ink-dim">{t("activity.sortBy")}:</span>
          <button
            onClick={() => setSortBy("name")}
            className={cn("rounded-lg px-3 py-1 text-xs font-bold transition", sortBy === "name" ? "brand-gradient text-white" : "glass text-ink-soft hover:text-ink")}
          >
            {t("activity.sortName")}
          </button>
          <button
            onClick={() => setSortBy("date")}
            className={cn("rounded-lg px-3 py-1 text-xs font-bold transition", sortBy === "date" ? "brand-gradient text-white" : "glass text-ink-soft hover:text-ink")}
          >
            {t("activity.sortDate")}
          </button>
        </div>
      </div>

      {/* Liste triée */}
      <div className="space-y-2">
        {visibleItems.map((item) => (
          <WantedItemRow
            key={`${item.media.id}-${item.media.season ?? 0}-${item.media.episode ?? 0}`}
            item={item}
            isSelected={selectedItems.includes(item.media.id)}
            onSelect={toggleSelectItem}
            onAction={handleSingleAction}
            showUpgrade={item.status === "cutoff_unmet"}
            actionLoading={actionLoading}
            active={active}
            locale={locale}
          />
        ))}
      </div>

      {allItems.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl glass py-16 text-center">
          <Check className="h-8 w-8 text-ok" />
          <p className="font-semibold text-ink">{t("activity.noWanted")}</p>
          <p className="max-w-md text-sm text-ink-dim">{t("activity.noWantedHint")}</p>
        </div>
      )}
    </div>
  );
}

function WantedItemRow({
  item,
  isSelected,
  onSelect,
  onAction,
  showUpgrade = false,
  actionLoading = null,
  active = true,
  locale = "fr",
}: {
  item: WantedItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onAction: (item: WantedItem, action: "search" | "monitor" | "unmonitor") => void;
  showUpgrade?: boolean;
  actionLoading?: string | null;
  active?: boolean;
  locale?: string;
}) {
  const t = useT();
  const onCooldown = isOnCooldown(item.media.id);
  const remaining = getRemainingCooldown(item.media.id);
  // Reflects the real background job, not just the brief "enqueueing" fetch —
  // so the spinner stays correct even if this list re-renders or you switch
  // tabs and back while the search is still running server-side. Polling
  // pauses while this row's tab isn't the visible one — with up to 100+ rows
  // mounted at once across 4 tabs kept alive in the background, this was
  // producing constant network chatter even while sitting on a different tab.
  const searchSourceId =
    item.media.season != null && item.media.episode != null
      ? `episode-search-${item.media.id}-${item.media.season}-${item.media.episode}`
      : `movie-search-${item.media.id}`;
  const jobSearching = useJobRunning(searchSourceId, active);
  return (
    <div className="flex items-center gap-3 rounded-xl glass p-3 transition-colors hover:bg-white/5">
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onSelect(item.media.id)}
        onClick={(e) => e.stopPropagation()}
        className="h-4 w-4 rounded border-white/20 bg-surface text-brand-glow focus:ring-brand-glow"
      />

      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
        item.media.type === "movie" ? "bg-brand/12 text-brand-glow" : "bg-cyan/12 text-cyan")}>
        {item.media.type === "movie" ? <Film className="h-4 w-4" /> : <Tv className="h-4 w-4" />}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Link href={item.media.href} className="truncate font-semibold text-ink hover:text-brand-glow">
            {item.media.title}
            {item.media.season && item.media.episode && (
              <span className="text-ink-dim"> — S{item.media.season}E{String(item.media.episode).padStart(2, "0")}</span>
            )}
            {item.releaseDate && (
              <span className="ml-2 text-[11px] text-ink-dim">{formatDateTime(new Date(item.releaseDate).getTime(), locale)}</span>
            )}
          </Link>

          <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold",
            item.status === "missing" ? "border-down/30 bg-down/12 text-down" : "border-amber/30 bg-amber/12 text-amber")}>
            {item.status === "missing" ? t("activity.status.missing") : t("activity.status.cutoffUnmet")}
          </span>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-dim">
          <span className="flex items-center gap-1">
            <Check className="h-3 w-3" /> {t("activity.targetLabel")}: {item.targetQuality}
          </span>
          {item.currentQuality && (
            <span className="flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> {t("activity.currentLabel")}: {item.currentQuality}
            </span>
          )}
          {item.lastSearch && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {t("activity.lastSearch")}: {formatDateTime(new Date(item.lastSearch).getTime(), locale)}
            </span>
          )}
          {item.nextSearch && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {t("activity.nextSearch")}: {formatDateTime(new Date(item.nextSearch).getTime(), locale)}
            </span>
          )}
        </div>

        {showUpgrade && item.availableReleases && item.availableReleases.length > 0 && (
          <div className="mt-2 space-y-1">
            <p className="text-xs font-semibold text-ink">{t("activity.availableReleases")}:</p>
            {item.availableReleases.map((release, index) => (
              <div key={index} className="flex items-center gap-2 rounded-lg bg-surface/50 p-2 text-xs">
                <span className="font-mono truncate flex-1">{release.releaseTitle}</span>
                <span className="flex items-center gap-1 font-semibold text-cyan">
                  <Check className="h-3 w-3" /> {release.quality}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" /> {release.seeders}↑
                </span>
                <span>Score: {release.score}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onAction(item, "search"); }}
          disabled={actionLoading !== null || onCooldown}
          title={onCooldown ? `${t("activity.searchCooldown")} (${Math.ceil(remaining / 1000)}s)` : t("activity.searchNow")}
          className={cn("flex h-11 w-11 items-center justify-center rounded-lg glass transition-colors disabled:opacity-40",
            onCooldown ? "text-ink-dim" : "hover:bg-brand/15 hover:text-brand-glow")}
        >
          {actionLoading === `search_${item.media.id}` || jobSearching ? <Loader className="h-4 w-4 animate-spin" /> : onCooldown ? <Clock className="h-4 w-4" /> : <Search className="h-4 w-4" />}
        </button>
        {item.monitored ? (
          <button
            onClick={(e) => { e.stopPropagation(); onAction(item, "unmonitor"); }}
            disabled={actionLoading !== null}
            title={t("activity.unmonitor")}
            className="flex h-11 w-11 items-center justify-center rounded-lg glass transition-colors hover:bg-white/10 disabled:opacity-40"
          >
            {actionLoading === `unmonitor_${item.media.id}` ? <Loader className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          </button>
        ) : (
          <button
            onClick={(e) => { e.stopPropagation(); onAction(item, "monitor"); }}
            disabled={actionLoading !== null}
            title={t("activity.monitor")}
            className="flex h-11 w-11 items-center justify-center rounded-lg glass transition-colors hover:bg-white/10 disabled:opacity-40"
          >
            {actionLoading === `monitor_${item.media.id}` ? <Loader className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  );
}