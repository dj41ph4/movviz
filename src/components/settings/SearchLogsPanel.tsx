"use client";

import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { RefreshCw, Copy, Check, Loader2, Trash2, Bug, Search, X } from "lucide-react";

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
  "priority.": "text-brand-glow",
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
  // Bug fix (requested live: 4000-line buffer, dozens of unrelated tags like
  // rss_refresh/grab_release/series_pack drowning out the one tag someone
  // actually needs, e.g. plex.watchSync) — free-text filter over step+message,
  // combined with the existing level filter rather than replacing it.
  const [textFilter, setTextFilter] = useState("");
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

  // Live tail : la passe d'arrière-plan écrit ses lignes en continu, un
  // simple chargement au montage donnait l'impression que le journal était
  // vide/mort. Rafraîchi toutes les 5s, uniquement si l'onglet est visible,
  // et sans re-render si rien n'a changé (comparaison longueur + dernier
  // timestamp). L'endpoint /api/diagnostic est exclu du marquage d'activité
  // utilisateur, ce poll reste donc silencieux pour l'arrière-plan.
  useEffect(() => {
    const id = setInterval(async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/diagnostic/search-logs", { cache: "no-store" });
        if (!res.ok) return;
        const next = ((await res.json()) as { logs?: SearchLogLine[] }).logs ?? [];
        setLogs((prev) => {
          if (!prev) return next;
          if (next.length === 0 && prev.length === 0) return prev;
          const lastPrev = prev[prev.length - 1];
          const lastNext = next[next.length - 1];
          if (prev.length === next.length && lastPrev && lastNext && lastPrev.t === lastNext.t) return prev;
          return next;
        });
      } catch {
        // keep whatever we had — the manual refresh button still works
      }
    }, 5000);
    return () => clearInterval(id);
  }, []);

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

  const matchesFilters = (l: SearchLogLine) => {
    if (levelFilter !== "all" && l.level !== levelFilter) return false;
    if (!textFilter.trim()) return true;
    const needle = textFilter.trim().toLowerCase();
    return l.step.toLowerCase().includes(needle) || l.message.toLowerCase().includes(needle);
  };

  const copy = async () => {
    if (!logs?.length) return;
    const text = logs
      .filter(matchesFilters)
      .map((l) => `[${new Date(l.t).toISOString()}] ${l.level.toUpperCase()} ${l.step} ${l.message}${l.ms != null ? ` (${l.ms}ms)` : ""}`)
      .join("\n");
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const displayed = logs ? logs.filter(matchesFilters) : [];

  return (
    <div className="rounded-2xl glass p-5">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
          <Bug className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-ink">{t("health.searchLogsTitle")}</h3>
          <p className="mt-0.5 text-xs text-ink-dim">{t("health.searchLogsHint")}</p>
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
          <button
            onClick={clear}
            disabled={!logs?.length}
            className="flex h-9 items-center gap-2 rounded-xl glass-strong px-3.5 text-xs font-semibold text-ink-soft disabled:opacity-40"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("cache.clear")}
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
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
            {lvl === "all" ? t("health.logsFilterAll") : lvl.toUpperCase()}
          </button>
        ))}
            <div className="relative min-w-[220px] flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-dim/60" />
              <input
                type="text"
                value={textFilter}
                onChange={(e) => setTextFilter(e.target.value)}
                placeholder={t("health.logsSearchPlaceholder")}
                className="h-7 w-full rounded-lg glass-strong pl-8 pr-7 text-[11px] text-ink-soft placeholder:text-ink-dim/50 focus:outline-none focus:ring-1 focus:ring-brand-glow/50"
              />
              {textFilter && (
                <button
                  onClick={() => setTextFilter("")}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-dim/60 hover:text-ink-soft"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <span className="text-[11px] text-ink-dim">
              {displayed.length} {t("health.logsLines")}
            </span>
      </div>

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="mt-3 max-h-[520px] overflow-y-auto rounded-xl border border-white/5 bg-black/40 p-3 font-mono text-[11px] leading-relaxed"
      >
        {!displayed.length ? (
          <p className="py-6 text-center text-ink-dim">{t("health.logsEmpty")}</p>
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
