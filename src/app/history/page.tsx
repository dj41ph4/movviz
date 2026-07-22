"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { PageHeader } from "@/components/ui/PageHeader";
import { useT, useI18n } from "@/i18n/provider";
import { cn, formatBytes, relativeTime, formatDate } from "@/lib/utils";
import type { ActivityEntry } from "@/lib/activity/v2/types";
import {
  Download, Check, X, AlertTriangle, Loader2, Film, Tv, Magnet, Server, Search, ScrollText, ChevronDown,
} from "lucide-react";

const KIND_ICON: Record<string, React.ElementType> = {
  grabbed: Download,
  imported: Check,
  upgraded: Check,
  failed: AlertTriangle,
  blocked: X,
};

const KIND_CLS: Record<string, string> = {
  grabbed: "text-cyan bg-cyan/12",
  imported: "text-ok bg-ok/12",
  upgraded: "text-ok bg-ok/12",
  failed: "text-down bg-down/12",
  blocked: "text-amber bg-amber/12",
};

const TYPE_OPTIONS = [
  { value: "", labelKey: "common.all" },
  { value: "movie", labelKey: "common.movies", icon: Film },
  { value: "series", labelKey: "common.series", icon: Tv },
] as const;

const KIND_OPTIONS = [
  { value: "", labelKey: "common.all" },
  { value: "grabbed", labelKey: "history.grabbed" },
  { value: "imported", labelKey: "history.imported" },
  { value: "upgraded", labelKey: "history.upgraded" },
  { value: "failed", labelKey: "history.failed" },
] as const;

export default function HistoryPage() {
  const t = useT();
  const { locale } = useI18n();
  const [type, setType] = useState("");
  const [kind, setKind] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const params = new URLSearchParams({ limit: "100" });
  if (type) params.set("type", type);
  if (kind) params.set("kind", kind);

  const { data, isLoading } = useSWR<{ items: ActivityEntry[]; total: number }>(
    `/api/history?${params.toString()}`
  );

  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader title={t("history.title")} description={t("history.description")} />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap gap-2">
        <div className="flex items-center gap-1 rounded-2xl glass p-1">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setType(opt.value)}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
                type === opt.value ? "brand-gradient text-white" : "text-ink-soft hover:text-ink"
              )}
            >
              {"icon" in opt && opt.icon && <opt.icon className="h-3.5 w-3.5" />}
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 rounded-2xl glass p-1">
          {KIND_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setKind(opt.value)}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-semibold transition-colors",
                kind === opt.value ? "brand-gradient text-white" : "text-ink-soft hover:text-ink"
              )}
            >
              {t(opt.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 rounded-2xl glass py-16 text-ink-dim">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}

      {!isLoading && items.length === 0 && (
        <div className="rounded-2xl glass py-16 text-center text-sm text-ink-dim">{t("history.noEvents")}</div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="overflow-hidden rounded-2xl glass">
          <div className="hidden grid-cols-[1fr_50px_70px_100px_80px] gap-4 border-b border-white/8 px-5 py-3 text-xs font-bold uppercase tracking-wider md:grid">
            <span>{t("search.release")}</span>
            <span className="text-center">{t("history.kind")}</span>
            <span className="text-center">{t("search.size")}</span>
            <span className="text-center">{t("search.age")}</span>
            <span className="text-right">{t("search.action")}</span>
          </div>
          {items.map((entry) => {
            const Icon = KIND_ICON[entry.kind] ?? Search;
            const cls = KIND_CLS[entry.kind] ?? "text-ink-dim bg-white/5";
            const hasLog = !!entry.failure?.message;
            const expanded = expandedId === entry.id;
            return (
              <div key={entry.id} className="border-b border-white/5 last:border-0">
              <div
                className="grid grid-cols-1 gap-2 px-5 py-4 transition-colors hover:bg-white/[0.03] md:grid-cols-[1fr_50px_70px_100px_80px] md:items-center md:gap-4"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", cls)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <Link href={entry.media.href} className="truncate text-sm font-semibold text-ink hover:text-brand-glow">
                      {entry.media.title}
                    </Link>
                    {entry.release?.releaseTitle && (
                      <p className="truncate font-mono text-[11px] text-ink-dim">{entry.release.releaseTitle}</p>
                    )}
                    {entry.media.season != null && (
                      <p className="text-[11px] text-ink-dim">
                        S{String(entry.media.season).padStart(2, "0")}
                        {entry.media.episode != null && `E${String(entry.media.episode).padStart(2, "0")}`}
                      </p>
                    )}
                  </div>
                </div>
                <span className={cn("flex items-center justify-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", cls)}>
                  <Icon className="h-2.5 w-2.5" /> {entry.kind}
                </span>
                <span className="text-center text-sm text-ink-soft">
                  {entry.release?.size ? formatBytes(entry.release.size) : entry.import?.fileSize ? formatBytes(entry.import.fileSize) : "—"}
                </span>
                <span className="text-center text-sm text-ink-soft" title={formatDate(new Date(entry.timestamp).toISOString(), locale) ?? ""}>
                  {relativeTime(new Date(entry.timestamp).toISOString())}
                </span>
                <div className="flex justify-end gap-1">
                  <span className="rounded-full border border-white/8 px-2 py-0.5 text-[10px] font-semibold text-ink-dim">
                    {entry.release?.indexer ?? entry.actor}
                  </span>
                  {entry.release?.score != null && (
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-bold",
                      entry.release.score >= 90 ? "text-ok bg-ok/12" : entry.release.score >= 75 ? "text-amber bg-amber/12" : "text-ink-soft bg-white/5"
                    )}>
                      {entry.release.score}
                    </span>
                  )}
                  {hasLog && (
                    <button
                      onClick={() => setExpandedId(expanded ? null : entry.id)}
                      className={cn(
                        "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors",
                        expanded ? "border-brand/30 bg-brand/12 text-brand-glow" : "border-white/8 text-ink-dim hover:text-ink"
                      )}
                    >
                      <ScrollText className="h-2.5 w-2.5" />
                      {t("history.logs")}
                      <ChevronDown className={cn("h-2.5 w-2.5 transition-transform", expanded && "rotate-180")} />
                    </button>
                  )}
                </div>
              </div>
              {hasLog && expanded && (
                <div className="border-t border-white/5 bg-black/20 px-5 py-3">
                  <p className="text-xs leading-relaxed text-ink-soft">{entry.failure!.message}</p>
                  {entry.failure!.code && (
                    <p className="mt-1 font-mono text-[10px] text-ink-dim">{entry.failure!.code}</p>
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
