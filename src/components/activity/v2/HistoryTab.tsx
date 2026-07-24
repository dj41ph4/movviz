"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useI18n, useT } from "@/i18n/provider";
import { cn, formatClockTime, formatDateTime } from "@/lib/utils";
import type { ActivityEntry } from "@/lib/activity/v2/types";
import { Download, Check, PackageCheck, X, AlertCircle, Search, Filter, ChevronDown, ChevronUp, Users } from "lucide-react";

/** Calendar-day bucket of a timestamp, in local time. */
function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** "Aujourd'hui" / "Hier" / "lundi 20 juillet 2026" section header. */
function dayLabel(ts: number, locale: string, t: (k: string) => string): string {
  const key = dayKey(ts);
  if (key === dayKey(Date.now())) return t("activity.today");
  if (key === dayKey(Date.now() - 86_400_000)) return t("activity.yesterday");
  return new Date(ts).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

const KIND_ICONS = {
  requested: <Download className="h-4 w-4" />,
  approved: <Check className="h-4 w-4" />,
  declined: <X className="h-4 w-4" />,
  searching: <Search className="h-4 w-4" />,
  grabbed: <Download className="h-4 w-4" />,
  downloading: <Download className="h-4 w-4" />,
  importing: <PackageCheck className="h-4 w-4" />,
  imported: <PackageCheck className="h-4 w-4" />,
  upgraded: <Download className="h-4 w-4" />,
  failed: <AlertCircle className="h-4 w-4" />,
  removed: <X className="h-4 w-4" />,
  blocked: <X className="h-4 w-4" />
};

const KIND_TONES = {
  requested: "text-brand-glow bg-brand/12",
  approved: "text-ok bg-ok/12",
  declined: "text-down bg-down/12",
  searching: "text-cyan bg-cyan/12",
  grabbed: "text-cyan bg-cyan/12",
  downloading: "text-cyan bg-cyan/12",
  importing: "text-brand-glow bg-brand/12",
  imported: "text-ok bg-ok/12",
  upgraded: "text-brand-glow bg-brand/12",
  failed: "text-down bg-down/12",
  removed: "text-down bg-down/12",
  blocked: "text-down bg-down/12"
};

const KIND_KEYS = Object.keys(KIND_ICONS) as (keyof typeof KIND_ICONS)[];

const STATUS_TABS = [
  { id: "all",         types: ["all"] },
  { id: "completed",   types: ["imported", "upgraded"] },
  { id: "inProgress",  types: ["grabbed", "downloading", "importing", "searching"] },
  { id: "failures",    types: ["failed", "blocked", "declined", "removed"] },
] as const;

export function HistoryTab({ failuresOnly = false }: { failuresOnly?: boolean } = {}) {
  const t = useT();
  const { locale } = useI18n();
  const { data, error } = useSWR<{ items: ActivityEntry[]; total: number }>(
    failuresOnly ? "/api/activity/v2?tab=failures" : "/api/activity/v2?tab=history"
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["all"]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedIndexers, setSelectedIndexers] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusTab, setStatusTab] = useState("all");

  const activateTab = (id: string) => {
    const tab = STATUS_TABS.find((t) => t.id === id);
    if (tab) setSelectedTypes([...tab.types]);
    setStatusTab(id);
  };

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  const uniqueUsers = useMemo(() => [...new Set(items.map(item => item.actor))], [items]);
  const uniqueIndexers = useMemo(() => {
    const set = new Set<string>();
    for (const item of items) {
      if (item.release) set.add(item.release.indexer);
    }
    return [...set];
  }, [items]);

  const filteredItems = useMemo(() => items.filter(item => {
    if (selectedTypes.length > 0 && !selectedTypes.includes("all") && !selectedTypes.includes(item.kind)) {
      return false;
    }

    if (selectedUsers.length > 0 && !selectedUsers.includes(item.actor)) {
      return false;
    }

    if (selectedIndexers.length > 0 && item.release && !selectedIndexers.includes(item.release.indexer)) {
      return false;
    }

    if (searchQuery && !item.media.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false;
    }

    return true;
  }), [items, selectedTypes, selectedUsers, selectedIndexers, searchQuery]);

  const toggleType = (type: string) => {
    if (type === "all") {
      setSelectedTypes(["all"]);
    } else {
      const newTypes = selectedTypes.includes("all")
        ? [type]
        : selectedTypes.includes(type)
          ? selectedTypes.filter(t => t !== type)
          : [...selectedTypes, type];
      setSelectedTypes(newTypes.length === 0 ? ["all"] : newTypes);
    }
  };

  const toggleUser = (user: string) => {
    setSelectedUsers(prev =>
      prev.includes(user) ? prev.filter(u => u !== user) : [...prev, user]
    );
  };

  const toggleIndexer = (indexer: string) => {
    setSelectedIndexers(prev =>
      prev.includes(indexer) ? prev.filter(i => i !== indexer) : [...prev, indexer]
    );
  };

  if (error) return <div className="rounded-2xl glass py-12 text-center text-sm text-down">{t("activity.loadError")}</div>;
  if (!data) return <div className="flex items-center justify-center gap-2 py-16 text-ink-dim"><Download className="h-5 w-5 animate-pulse" /> {t("common.loading")}</div>;

  return (
    <div className="space-y-6">
      {/* Sous-onglets */}
      <div className="flex flex-wrap gap-1.5">
        {STATUS_TABS.map((st) => (
          <button
            key={st.id}
            onClick={() => activateTab(st.id)}
            className={cn(
              "rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors",
              statusTab === st.id
                ? "brand-gradient text-white shadow-lg"
                : "glass text-ink-soft hover:text-ink"
            )}
          >
            {t("activity." + st.id)}
          </button>
        ))}
      </div>

      {/* Filtres */}
      <div className="rounded-2xl glass">
        <div
          className="flex items-center justify-between p-4 cursor-pointer"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <div className="flex items-center gap-3">
            <Filter className="h-5 w-5 text-ink-dim" />
            <span className="font-semibold text-ink">{t("activity.filters")}</span>
            {(selectedTypes.length > 0 && !selectedTypes.includes("all")) ||
             selectedUsers.length > 0 ||
             selectedIndexers.length > 0 ||
             searchQuery ? (
              <span className="rounded-full bg-brand/20 px-2 py-0.5 text-xs font-semibold text-brand-glow">
                {filteredItems.length} / {total}
              </span>
            ) : null}
          </div>
          {filtersOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>

        {filtersOpen && (
          <div className="border-t border-white/10 p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              <div>
                <h4 className="mb-2 text-sm font-semibold text-ink">{t("activity.filterByType")}</h4>
                <div className="space-y-1.5">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes("all")}
                      onChange={() => toggleType("all")}
                      className="h-4 w-4 rounded border-white/20 bg-surface text-brand-glow focus:ring-brand-glow"
                    />
                    <span className="text-sm text-ink-soft">{t("activity.all")}</span>
                  </label>
                  {KIND_KEYS.map((kind) => (
                    <label key={kind} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedTypes.includes(kind)}
                        onChange={() => toggleType(kind)}
                        className="h-4 w-4 rounded border-white/20 bg-surface text-brand-glow focus:ring-brand-glow"
                      />
                      <span className="text-sm text-ink-soft">{t("activity.kinds." + kind)}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-ink">{t("activity.filterByUser")}</h4>
                <div className="space-y-1.5">
                  {uniqueUsers.map(user => (
                    <label key={user} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user)}
                        onChange={() => toggleUser(user)}
                        className="h-4 w-4 rounded border-white/20 bg-surface text-brand-glow focus:ring-brand-glow"
                      />
                      <span className="text-sm text-ink-soft capitalize">{user}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-ink">{t("activity.filterByIndexer")}</h4>
                <div className="space-y-1.5">
                  {uniqueIndexers.map(indexer => (
                    <label key={indexer} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedIndexers.includes(indexer)}
                        onChange={() => toggleIndexer(indexer)}
                        className="h-4 w-4 rounded border-white/20 bg-surface text-brand-glow focus:ring-brand-glow"
                      />
                      <span className="text-sm text-ink-soft">{indexer}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold text-ink">{t("activity.filterSearch")}</h4>
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={t("activity.filterSearch")}
                    className="w-full rounded-lg border border-white/10 bg-surface/50 px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-dim"
                  />
                  <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-dim" />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Résultats — groupés par jour (les entrées arrivent déjà triées de la plus récente à la plus ancienne) */}
      <div className="space-y-1.5">
        {filteredItems.map((item, idx) => {
          const Icon = KIND_ICONS[item.kind];
          const tone = KIND_TONES[item.kind];
          const label = t("activity.kinds." + item.kind);
          const newDay = idx === 0 || dayKey(item.timestamp) !== dayKey(filteredItems[idx - 1].timestamp);

          return (
            <div key={item.id}>
            {newDay && (
              <p className={cn("mb-1.5 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-ink-dim", idx > 0 && "mt-5")}>
                {dayLabel(item.timestamp, locale, t)}
              </p>
            )}
            <div className="flex items-center gap-3 rounded-xl glass px-4 py-3 transition-colors hover:bg-white/5">
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", tone)}>
                {Icon}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Link href={item.media.href} className="truncate font-semibold text-ink hover:text-brand-glow">
                    {item.media.title}
                    {item.media.season && item.media.episode && (
                      <span className="text-ink-dim"> — S{item.media.season}E{String(item.media.episode).padStart(2, "0")}</span>
                    )}
                  </Link>
                </div>

                <p className="mt-1 truncate text-xs text-ink-dim">
                  <span className="font-semibold text-ink">{item.actor}</span> {label}{" "}
                  {item.release && (
                    <span className="font-mono">{item.release.releaseTitle}</span>
                  )}
                  {item.failure && (
                    <span className="text-down"> — {item.failure.message}</span>
                  )}
                </p>

                {item.release && (
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-dim">
                    <span className="flex items-center gap-1">
                      <Check className="h-3 w-3" /> {item.release.quality}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {item.release.seeders}↑ {item.release.leechers}↓
                    </span>
                    <span>Score: {item.release.score}</span>
                  </div>
                )}
              </div>

              <span className="shrink-0 font-mono text-xs text-ink-dim" title={formatDateTime(item.timestamp, locale)}>
                {formatClockTime(item.timestamp, locale)}
              </span>
            </div>
            </div>
          );
        })}

        {filteredItems.length === 0 && (
          <div className="rounded-2xl glass py-16 text-center text-sm text-ink-dim">
            {searchQuery || selectedTypes.length > 0 || selectedUsers.length > 0 || selectedIndexers.length > 0
              ? t("activity.noResults") : t("activity.noActivity")}
          </div>
        )}
      </div>
    </div>
  );
}