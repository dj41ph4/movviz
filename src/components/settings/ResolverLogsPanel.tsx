"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { RefreshCw, Copy, Check, Loader2, FileCode } from "lucide-react";

interface LogLine {
  t: number;
  level: "info" | "error";
  message: string;
}

const LEVEL_TONE: Record<LogLine["level"], string> = {
  info: "text-ink-soft",
  error: "text-down",
};

export function ResolverLogsPanel() {
  const t = useT();
  const [logs, setLogs] = useState<LogLine[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/resolver/logs", { cache: "no-store" });
      if (res.ok) setLogs((await res.json()).logs ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 3000);
    return () => clearInterval(interval);
  }, []);

  const copy = async () => {
    if (!logs?.length) return;
    const text = logs.map((l) => `[${new Date(l.t).toISOString()}] ${l.level.toUpperCase()} ${l.message}`).join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-2xl glass p-5">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
          <FileCode className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-ink">{t("health.resolverLogsTitle")}</h3>
          <p className="mt-0.5 text-xs text-ink-dim">{t("health.resolverLogsHint")}</p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="flex shrink-0 gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex h-9 items-center gap-2 rounded-xl glass-strong px-3.5 text-xs font-semibold text-ink-soft disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            {t("health.logsRefresh")}
          </button>
          <button
            onClick={copy}
            disabled={!logs?.length}
            className="flex h-9 items-center gap-2 rounded-xl glass-strong px-3.5 text-xs font-semibold text-ink-soft disabled:opacity-40"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? t("health.logsCopied") : t("health.logsCopy")}
          </button>
        </div>
      </div>

      <div className="mt-4 max-h-[420px] overflow-y-auto rounded-xl border border-white/5 bg-black/40 p-3 font-mono text-[11px] leading-relaxed">
        {!logs?.length ? (
          <p className="py-6 text-center text-ink-dim">{t("health.logsEmpty")}</p>
        ) : (
          logs.map((l, i) => (
            <div key={i} className="flex gap-2 whitespace-pre-wrap break-all">
              <span className="shrink-0 text-ink-dim">{new Date(l.t).toLocaleTimeString()}</span>
              <span className={cn("shrink-0 font-bold", LEVEL_TONE[l.level])}>{l.level.toUpperCase()}</span>
              <span className="text-ink-soft">{l.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
