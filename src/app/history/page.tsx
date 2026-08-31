"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { PageHeader } from "@/components/ui/PageHeader";
import { useT, useI18n } from "@/i18n/provider";
import { cn, formatBytes, relativeTime, formatDate } from "@/lib/utils";
import type { ActivityEntry } from "@/lib/activity/v2/types";
import {
  Download, Check, ArrowUpCircle, X, AlertTriangle, Loader2, Film, Tv,
  ChevronDown, Search, ScrollText, Inbox,
} from "lucide-react";

// ─── Kind metadata ───────────────────────────────────────────────────────────

const KIND_META: Record<string, { icon: React.ElementType; color: string; border: string; bg: string }> = {
  grabbed:   { icon: Download,       color: "text-cyan",     border: "border-cyan/50",   bg: "bg-cyan/8" },
  imported:  { icon: Check,          color: "text-ok",       border: "border-ok/50",     bg: "bg-ok/8" },
  upgraded:  { icon: ArrowUpCircle,  color: "text-ok",       border: "border-ok/50",     bg: "bg-ok/8" },
  failed:    { icon: AlertTriangle,  color: "text-down",     border: "border-down/50",   bg: "bg-down/6" },
  blocked:   { icon: X,              color: "text-amber",    border: "border-amber/50",  bg: "bg-amber/6" },
  searching: { icon: Search,         color: "text-brand-glow", border: "border-brand/40", bg: "bg-brand/6" },
};
const DEFAULT_META = { icon: ScrollText, color: "text-ink-dim", border: "border-white/10", bg: "" };

// ─── Date grouping ───────────────────────────────────────────────────────────

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

interface Group { key: string; entries: ActivityEntry[] }

function groupByDate(items: ActivityEntry[]): Group[] {
  const now = Date.now();
  const today = startOfDay(now);
  const yesterday = today - 86_400_000;
  const weekAgo = today - 7 * 86_400_000;
  const monthAgo = today - 30 * 86_400_000;

  const buckets: Group[] = [
    { key: "today",     entries: [] },
    { key: "yesterday", entries: [] },
    { key: "thisWeek",  entries: [] },
    { key: "thisMonth", entries: [] },
    { key: "older",     entries: [] },
  ];

  for (const item of items) {
    const ts = item.timestamp;
    if      (ts >= today)     buckets[0].entries.push(item);
    else if (ts >= yesterday) buckets[1].entries.push(item);
    else if (ts >= weekAgo)   buckets[2].entries.push(item);
    else if (ts >= monthAgo)  buckets[3].entries.push(item);
    else                      buckets[4].entries.push(item);
  }

  return buckets.filter((b) => b.entries.length > 0);
}

// ─── Filter options ───────────────────────────────────────────────────────────

const TYPE_OPTIONS = [
  { value: "", labelKey: "common.all" },
  { value: "movie",  labelKey: "common.movies",  icon: Film },
  { value: "series", labelKey: "common.series",  icon: Tv },
] as const;

const KIND_OPTIONS = [
  { value: "",         labelKey: "common.all" },
  { value: "grabbed",  labelKey: "history.grabbed" },
  { value: "imported", labelKey: "history.imported" },
  { value: "upgraded", labelKey: "history.upgraded" },
  { value: "failed",   labelKey: "history.failed" },
  { value: "blocked",  labelKey: "history.blocked" },
] as const;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const t = useT();
  const { locale } = useI18n();
  const [type, setType] = useState("");
  const [kind, setKind] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const params = new URLSearchParams({ limit: "200" });
  if (type) params.set("type", type);
  if (kind) params.set("kind", kind);

  const { data, isLoading } = useSWR<{ items: ActivityEntry[]; total: number }>(
    `/api/history?${params.toString()}`,
    { refreshInterval: 10_000 }
  );

  const items = data?.items ?? [];
  const groups = useMemo(() => groupByDate(items), [items]);

  const countLabel = items.length === 1
    ? t("history.events").replace("{n}", "1")
    : t("history.eventsPlural").replace("{n}", String(items.length));

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <PageHeader title={t("history.title")} description={t("history.description")}>
        {!isLoading && items.length > 0 && (
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-ink-dim">
            {countLabel}
          </span>
        )}
      </PageHeader>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-0.5 rounded-2xl glass p-1">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setType(opt.value)}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors",
                type === opt.value ? "brand-gradient text-white shadow-sm" : "text-ink-soft hover:text-ink"
              )}
            >
              {"icon" in opt && <opt.icon className="h-3.5 w-3.5" />}
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-0.5 rounded-2xl glass p-1">
          {KIND_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setKind(opt.value)}
              className={cn(
                "rounded-xl px-3.5 py-2 text-xs font-semibold transition-colors",
                kind === opt.value ? "brand-gradient text-white shadow-sm" : "text-ink-soft hover:text-ink"
              )}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 rounded-2xl glass px-5 py-4">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-white/8" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-48 animate-pulse rounded bg-white/8" />
                <div className="h-2.5 w-64 animate-pulse rounded bg-white/5" />
              </div>
              <div className="h-3 w-16 animate-pulse rounded bg-white/5" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && items.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3 rounded-2xl glass py-20 text-center"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5">
            <Inbox className="h-7 w-7 text-ink-dim" />
          </span>
          <p className="font-semibold text-ink">{t("history.noEvents")}</p>
          <p className="text-sm text-ink-dim">{t("history.noEventsHint")}</p>
        </motion.div>
      )}

      {/* Timeline */}
      {!isLoading && groups.length > 0 && (
        <div className="space-y-8">
          {groups.map((group, gi) => (
            <motion.div
              key={group.key}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: gi * 0.06 }}
            >
              {/* Date group header */}
              <div className="mb-3 flex items-center gap-3">
                <span className="text-xs font-bold uppercase tracking-widest text-ink-dim">
                  {t(`history.${group.key}` as Parameters<typeof t>[0])}
                </span>
                <div className="h-px flex-1 bg-white/6" />
              </div>

              {/* Entries */}
              <div className="space-y-2">
                {group.entries.map((entry, ei) => (
                  <HistoryEntry
                    key={entry.id}
                    entry={entry}
                    index={ei + gi * 10}
                    locale={locale}
                    expanded={expandedId === entry.id}
                    onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    t={t}
                  />
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Entry card ───────────────────────────────────────────────────────────────

function HistoryEntry({
  entry, index, locale, expanded, onToggle, t,
}: {
  entry: ActivityEntry;
  index: number;
  locale: string;
  expanded: boolean;
  onToggle: () => void;
  t: ReturnType<typeof useT>;
}) {
  const meta = KIND_META[entry.kind] ?? DEFAULT_META;
  const Icon = meta.icon;
  const isFailed = entry.kind === "failed" || entry.kind === "blocked";
  const hasDetails = !!(entry.failure?.message || entry.failure?.code);
  const kindLabel = t(`history.${entry.kind}` as Parameters<typeof t>[0]) ?? entry.kind;

  const size =
    entry.release?.size   ? formatBytes(entry.release.size)   :
    entry.import?.fileSize ? formatBytes(entry.import.fileSize) : null;

  const quality = entry.release?.quality ?? entry.import?.qualityDetected ?? null;
  const score = entry.release?.score ?? null;
  const indexer = entry.release?.indexer ?? null;
  const actor = entry.actor === "system" ? t("history.system") : (entry.actor ?? null);

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.03, 0.4) }}
      className={cn(
        "overflow-hidden rounded-2xl border-l-2 transition-colors",
        isFailed ? "glass border-down/50 bg-down/[0.03]" : "glass",
        meta.border
      )}
    >
      {/* Main row */}
      <div className="flex items-start gap-4 px-5 py-4">
        {/* Kind icon */}
        <span className={cn(
          "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
          isFailed ? "bg-down/12" : `${meta.bg || "bg-white/6"}`
        )}>
          <Icon className={cn("h-4 w-4", meta.color)} />
        </span>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Title row */}
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <Link
              href={entry.media?.href ?? "#"}
              className="text-sm font-semibold text-ink hover:text-brand-glow transition-colors"
            >
              {entry.media?.title ?? "—"}
            </Link>
            {entry.media?.season != null && (
              <span className="text-xs font-semibold text-ink-dim">
                S{String(entry.media.season).padStart(2, "0")}
                {entry.media.episode != null && `E${String(entry.media.episode).padStart(2, "0")}`}
              </span>
            )}
            {/* Kind badge */}
            <span className={cn(
              "rounded-full border px-2 py-0.5 text-[10px] font-bold",
              isFailed
                ? "border-down/25 bg-down/10 text-down"
                : `border-white/10 ${meta.color} bg-white/5`
            )}>
              {kindLabel}
            </span>
          </div>

          {/* Release name */}
          {entry.release?.releaseTitle && (
            <p className="mt-0.5 truncate font-mono text-[11px] text-ink-dim">
              {entry.release.releaseTitle}
            </p>
          )}

          {/* Failure message inline */}
          {isFailed && entry.failure?.message && (
            <p className={cn(
              "mt-1.5 rounded-xl px-3 py-2 text-xs leading-relaxed",
              entry.kind === "failed" ? "bg-down/10 text-down" : "bg-amber/10 text-amber"
            )}>
              {entry.failure.message}
            </p>
          )}

          {/* Meta pills */}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {indexer && (
              <span className="rounded-full border border-white/8 bg-white/4 px-2 py-0.5 text-[10px] font-semibold text-ink-dim">
                {indexer}
              </span>
            )}
            {size && (
              <span className="rounded-full border border-white/8 bg-white/4 px-2 py-0.5 text-[10px] font-semibold text-ink-dim">
                {size}
              </span>
            )}
            {quality && (
              <span className="rounded-full border border-white/8 bg-white/4 px-2 py-0.5 text-[10px] font-semibold text-ink-dim">
                {quality}
              </span>
            )}
            {score != null && (
              <span className={cn(
                "rounded-full border px-2 py-0.5 text-[10px] font-bold",
                score >= 90 ? "border-ok/25 bg-ok/10 text-ok"
                  : score >= 70 ? "border-amber/25 bg-amber/10 text-amber"
                  : "border-white/10 bg-white/5 text-ink-dim"
              )}>
                {t("history.score")} {score}
              </span>
            )}
            {!isFailed && actor && actor !== t("history.system") && (
              <span className="rounded-full border border-white/8 bg-white/4 px-2 py-0.5 text-[10px] font-semibold text-ink-dim">
                {actor}
              </span>
            )}
          </div>
        </div>

        {/* Timestamp + expand */}
        <div className="flex shrink-0 flex-col items-end gap-2">
          <span
            className="text-xs text-ink-dim"
            title={formatDate(new Date(entry.timestamp).toISOString(), locale) ?? ""}
          >
            {relativeTime(new Date(entry.timestamp).toISOString(), locale)}
          </span>
          {hasDetails && !isFailed && (
            <button
              onClick={onToggle}
              className={cn(
                "flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold transition-colors",
                expanded
                  ? "border-brand/30 bg-brand/12 text-brand-glow"
                  : "border-white/8 text-ink-dim hover:text-ink"
              )}
            >
              {t("history.logs")}
              <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", expanded && "rotate-180")} />
            </button>
          )}
        </div>
      </div>

      {/* Expandable extra detail (non-failure entries) */}
      <AnimatePresence>
        {expanded && hasDetails && !isFailed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/5 bg-black/20 px-5 py-3">
              {entry.failure?.message && (
                <p className="text-xs leading-relaxed text-ink-soft">{entry.failure.message}</p>
              )}
              {entry.failure?.code && (
                <p className="mt-1.5 font-mono text-[10px] text-ink-dim">{entry.failure.code}</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
