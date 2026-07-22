"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { RefreshCw, Copy, Check, Loader2, Trash2, Bug } from "lucide-react";

interface SearchLogLine {
  t: number;
  level: "info" | "warn" | "error" | "debug";
  step: string;
  message: string;
  ms?: number;
}

const LEVEL_TONE: Record<SearchLogLine["level"], string> = {
  info: "text-ink-soft",
  warn: "text-amber",
  error: "text-down",
  debug: "text-ink-dim/60",
};

const STEP_COLOR: Record<string, string> = {
  "search_all_missing.start": "text-brand",
  "search_all_missing.end": "text-brand",
  "rss_refresh": "text-sky",
  "cache_search": "text-purple",
};

function stepColor(step: string): string {
  for (const [prefix, color] of Object.entries(STEP_COLOR)) {
    if (step.startsWith(prefix)) return color;
  }
  if (step.startsWith("search_movie.")) return "text-ok";
  if (step.startsWith("grab_release.")) return "text-amber";
  if (step.startsWith("series_pack.")) return "text-amber";
  if (step.startsWith("boot.")) return "text-sky";
  return "text-ink-dim";
}

export function SearchLogsPanel() {
  const t = useT();
  const [logs, setLogs] = useState<SearchLogLine[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [levelFilter, setLevelFilter] = useState<SearchLogLine["level"] | "all">("all");
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/diagnostic/search-logs", { cache: "no-store" });
      if (res.ok) setLogs((await res.json()).logs ?? []);
    } finally {
      setLoading(false);
    }
  };

  const clear = async () => {
    await fetch("/api/diagnostic/search-logs", { method: "DELETE" });
    setLogs([]);
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 80);
  };

  const copy = async () => {
    if (!logs?.length) return;
    const text = logs
      .filter((l) => levelFilter === "all" || l.level === levelFilter)
      .map((l) => `[${new Date(l.t).toISOString()}] ${l.level.toUpperCase()} ${l.step} ${l.message}${l.ms != null ? ` (${l.ms}ms)` : ""}`)
      .join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const displayed = logs
    ? levelFilter === "all" ? logs : logs.filter((l) => l.level === levelFilter)
    : [];

  return (
    <div className="rounded-2xl glass p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-ink">Diagnostic — Recherche des manquants</h3>
          <p className="mt-1 max-w-xl text-xs text-ink-dim">
            Journal détaillé de la recherche de tout ce qui est manquant. Chaque étape (lecture cache RSS,
            scoring, filtrage, envoi au moteur) est chronométrée. Utile pour comprendre pourquoi un titre
            n'est pas trouvé ou pourquoi le bouton fait planter l'app.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={load}
            disabled={loading}
            className="flex h-9 items-center gap-2 rounded-xl glass-strong px-3.5 text-xs font-semibold text-ink-soft disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Actualiser
          </button>
          <button
            onClick={copy}
            disabled={!logs?.length}
            className="flex h-9 items-center gap-2 rounded-xl glass-strong px-3.5 text-xs font-semibold text-ink-soft disabled:opacity-40"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-ok" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copiés" : "Copier"}
          </button>
          <button
            onClick={clear}
            disabled={!logs?.length}
            className="flex h-9 items-center gap-2 rounded-xl glass-strong px-3.5 text-xs font-semibold text-ink-soft disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Effacer
          </button>
        </div>
      </div>

      <div className="mt-3 flex gap-1.5">
        {(["all", "info", "warn", "error", "debug"] as const).map((lvl) => (
          <button
            key={lvl}
            onClick={() => setLevelFilter(lvl)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors",
              levelFilter === lvl
                ? "bg-white/12 text-white"
                : "text-ink-dim hover:text-ink-soft"
            )}
          >
            {lvl === "all" ? "TOUT" : lvl.toUpperCase()}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-ink-dim">
          {displayed.length} ligne{displayed.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="mt-3 max-h-[520px] overflow-y-auto rounded-xl border border-white/5 bg-black/40 p-3 font-mono text-[11px] leading-relaxed"
      >
        {!displayed.length ? (
          <p className="py-6 text-center text-ink-dim">
            Aucune entrée pour l'instant. Lance une recherche des manquants depuis la bibliothèque,
            puis actualise ce panneau.
          </p>
        ) : (
          displayed.map((l, i) => (
            <div key={i} className="flex gap-2 whitespace-pre-wrap break-all hover:bg-white/4">
              <span className="shrink-0 text-ink-dim/50">{new Date(l.t).toLocaleTimeString()}</span>
              <span className={cn("shrink-0 font-bold", LEVEL_TONE[l.level])}>
                {l.level === "debug" ? "DBG" : l.level.toUpperCase()}
              </span>
              <span className={cn("shrink-0 font-semibold", stepColor(l.step))}>{l.step}</span>
              <span className="text-ink-soft">{l.message}</span>
              {l.ms != null && (
                <span className={cn("shrink-0", l.ms >= 2000 ? "text-down font-bold" : l.ms >= 500 ? "text-amber" : "text-ink-dim/50")}>
                  +{l.ms}ms
                </span>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
