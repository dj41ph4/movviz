"use client";

import { useState } from "react";
import useSWR from "swr";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { Bug, RefreshCw, Trash2, CheckCircle2, XCircle, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import type { AiDebugEntry } from "@/lib/ai/debugLog";

const KIND_LABEL_KEY: Record<AiDebugEntry["kind"], string> = {
  chat: "ai.settings.debugLog.kindChat",
  add_media: "ai.settings.debugLog.kindAddMedia",
  recommend: "ai.settings.debugLog.kindRecommend",
};

function EntryRow({ entry }: { entry: AiDebugEntry }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/6 last:border-0">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-white/4"
      >
        {entry.success ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-ok" />
        ) : (
          <XCircle className="h-4 w-4 shrink-0 text-down" />
        )}
        <span className="min-w-[90px] shrink-0 text-xs font-semibold text-ink-soft">
          {t(KIND_LABEL_KEY[entry.kind])}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-ink">{entry.preview}</span>
        {entry.provider && (
          <span className="shrink-0 rounded-full bg-white/6 px-2 py-0.5 text-[10px] font-bold text-ink-soft">
            {t(`ai.provider.${entry.provider}`)}
          </span>
        )}
        <span className="shrink-0 text-xs text-ink-dim">{entry.durationMs}ms</span>
        <span className="shrink-0 text-xs text-ink-dim">{new Date(entry.t).toLocaleTimeString()}</span>
        {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink-dim" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink-dim" />}
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 bg-black/20 px-4 py-3 text-xs sm:grid-cols-3">
          <Detail label={t("ai.settings.debugLog.user")} value={entry.username} />
          <Detail label={t("ai.settings.debugLog.provider")} value={entry.provider ? t(`ai.provider.${entry.provider}`) : "—"} />
          {entry.itemCount != null && <Detail label={t("ai.settings.debugLog.itemCount")} value={String(entry.itemCount)} />}
          {entry.error && <Detail label={t("ai.settings.debugLog.error")} value={entry.error} warn full />}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value, warn, full }: { label: string; value: string; warn?: boolean; full?: boolean }) {
  return (
    <div className={full ? "col-span-2 sm:col-span-3" : undefined}>
      <span className="block text-[10px] font-bold uppercase tracking-wider text-ink-dim">{label}</span>
      <span className={cn("whitespace-pre-wrap break-words", warn ? "font-semibold text-down" : "text-ink")}>{value}</span>
    </div>
  );
}

export function AiDebugLogPanel() {
  const t = useT();
  const { data, isLoading, mutate } = useSWR<{ entries: AiDebugEntry[] }>("/api/ai/debug-log", { refreshInterval: 10_000 });
  const [clearing, setClearing] = useState(false);
  const entries = data?.entries ?? [];

  const clear = async () => {
    setClearing(true);
    try {
      await fetch("/api/ai/debug-log", { method: "DELETE" });
      await mutate({ entries: [] }, { revalidate: false });
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="rounded-2xl glass p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-ink">
            <Bug className="h-4 w-4 text-brand-glow" /> {t("ai.settings.debugLog.title")}
          </h3>
          <p className="mt-0.5 text-xs text-ink-dim">{t("ai.settings.debugLog.hint")}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => mutate()}
            className="glass-strong flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-ink-soft transition-colors hover:text-ink"
          >
            <RefreshCw className="h-3.5 w-3.5" /> {t("ai.settings.debugLog.refresh")}
          </button>
          <button
            onClick={clear}
            disabled={clearing || entries.length === 0}
            className="glass-strong flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-bold text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
          >
            {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {t("ai.settings.debugLog.clear")}
          </button>
        </div>
      </div>

      {isLoading ? (
        <p className="py-8 text-center text-sm text-ink-dim">{t("ai.settings.loading")}</p>
      ) : entries.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-dim">{t("ai.settings.debugLog.empty")}</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-white/8">
          <div className="flex flex-wrap gap-4 border-b border-white/6 bg-black/20 px-4 py-2.5 text-xs text-ink-dim">
            <span>{t("ai.settings.debugLog.total", { n: String(entries.length) })}</span>
            <span className="text-ok">{t("ai.settings.debugLog.success", { n: String(entries.filter((e) => e.success).length) })}</span>
            <span className="text-down">{t("ai.settings.debugLog.failed", { n: String(entries.filter((e) => !e.success).length) })}</span>
          </div>
          {entries.map((e, i) => (
            <EntryRow key={`${e.t}-${i}`} entry={e} />
          ))}
        </div>
      )}
    </div>
  );
}
