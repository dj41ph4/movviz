"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { Trash2, Loader2, Sparkles, Database, Images, RefreshCw } from "lucide-react";

interface CacheStats {
  name: string;
  hits: number;
  misses: number;
  keys: number;
  maxEntries: number;
  keySizeBytes: number;
  valueSizeBytes: number;
}

interface WarmState {
  running: boolean;
  done: number;
  total: number;
  startedAt: number | null;
  finishedAt: number | null;
  error: string | null;
}

interface ArtworkWarmState {
  running: boolean;
  mode: "complete" | "incremental" | null;
  done: number;
  total: number;
  cached: number;
  failed: number;
  startedAt: number | null;
  finishedAt: number | null;
  error: string | null;
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 ** 2).toFixed(2)} MB`;
}

export function CachePanel() {
  const t = useT();
  const [caches, setCaches] = useState<CacheStats[]>([]);
  const [clearing, setClearing] = useState<string | null>(null);
  const [clearingArtwork, setClearingArtwork] = useState<"all" | "logos" | "backdrops" | null>(null);
  const [warm, setWarm] = useState<WarmState | null>(null);
  const [artworkWarm, setArtworkWarm] = useState<ArtworkWarmState | null>(null);

  const load = () =>
    fetch("/api/cache", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCaches(d.caches ?? []));

  const loadWarm = () =>
    fetch("/api/cache/warm", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setWarm(d));

  const loadArtworkWarm = () =>
    fetch("/api/cache/artwork-warm", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setArtworkWarm(d));

  useEffect(() => {
    load();
    loadWarm();
    loadArtworkWarm();
    const id = setInterval(() => { load(); loadWarm(); loadArtworkWarm(); }, 1500);
    return () => clearInterval(id);
  }, []);

  const startWarm = () => fetch("/api/cache/warm", { method: "POST" }).then(loadWarm);
  const startArtworkWarm = (mode: "complete" | "incremental") =>
    fetch("/api/cache/artwork-warm", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode }),
    }).then(loadArtworkWarm);
  const clearArtwork = async (part: "all" | "logos" | "backdrops") => {
    setClearingArtwork(part);
    try {
      await fetch("/api/cache/artwork/clear", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ part }),
      });
    } finally {
      setClearingArtwork(null);
      await loadArtworkWarm();
    }
  };
  const warmPct = warm && warm.total > 0 ? Math.round((warm.done / warm.total) * 100) : 0;
  const artworkWarmPct = artworkWarm && artworkWarm.total > 0 ? Math.round((artworkWarm.done / artworkWarm.total) * 100) : 0;

  const clear = async (name: string) => {
    setClearing(name);
    try {
      await fetch(`/api/cache/${encodeURIComponent(name)}/clear`, { method: "POST" });
      await load();
    } finally {
      setClearing(null);
    }
  };

  const warmSection = (
    <div className="mb-6 rounded-2xl glass p-5">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <Sparkles className="h-4 w-4 text-brand-glow" /> {t("cache.warmTitle")}
        </h3>
        {warm?.running && <span className="text-xs font-semibold text-cyan">{warmPct}%</span>}
      </div>
      <p className="mb-3 text-xs text-ink-dim">{t("cache.warmHint")}</p>
      {warm?.running ? (
        <div className="h-2 overflow-hidden rounded-full bg-black/40">
          <div
            className="h-full rounded-full brand-gradient transition-[width] duration-500"
            style={{ width: `${warmPct}%` }}
          />
        </div>
      ) : (
        <button
          onClick={startWarm}
          className="flex h-10 items-center gap-2 rounded-xl brand-gradient px-4 text-sm font-bold text-white"
        >
          <Sparkles className="h-4 w-4" /> {t("cache.warmButton")}
        </button>
      )}
      {!warm?.running && warm?.finishedAt && (
        <p className={cn("mt-2 text-xs font-semibold", warm.error ? "text-down" : "text-ok")}>
          {warm.error ? warm.error : t("cache.warmDone", { n: warm.total })}
        </p>
      )}
    </div>
  );

  const artworkSection = (
    <div className="mb-6 rounded-2xl border border-brand/20 bg-brand/5 p-5">
      <div className="mb-1 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <Images className="h-4 w-4 text-brand-glow" /> {t("cache.artworkTitle")}
        </h3>
        {artworkWarm?.running && <span className="text-xs font-semibold text-cyan">{artworkWarmPct}%</span>}
      </div>
      <p className="mb-3 text-xs text-ink-dim">{t("cache.artworkHint")}</p>
      {artworkWarm?.running ? (
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-black/40">
            <div className="h-full rounded-full brand-gradient transition-[width] duration-500" style={{ width: `${artworkWarmPct}%` }} />
          </div>
          <p className="text-xs text-ink-dim">{t("cache.artworkProgress", { done: artworkWarm.done, total: artworkWarm.total })}</p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => startArtworkWarm("complete")}
            className="flex h-10 items-center gap-2 rounded-xl brand-gradient px-4 text-sm font-bold text-white"
          >
            <Images className="h-4 w-4" /> {t("cache.artworkComplete")}
          </button>
          <button
            onClick={() => startArtworkWarm("incremental")}
            className="flex h-10 items-center gap-2 rounded-xl glass-strong px-4 text-sm font-bold text-ink"
          >
            <RefreshCw className="h-4 w-4" /> {t("cache.artworkIncremental")}
          </button>
        </div>
      )}
      {!artworkWarm?.running && artworkWarm?.finishedAt && (
        <p className={cn("mt-2 text-xs font-semibold", artworkWarm.error || artworkWarm.failed ? "text-down" : "text-ok")}>
          {artworkWarm.error
            ? artworkWarm.error
            : t("cache.artworkDone", { n: artworkWarm.cached })}
        </p>
      )}
      {!artworkWarm?.running && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-white/8 pt-3">
          <button
            onClick={() => clearArtwork("all")}
            disabled={clearingArtwork !== null}
            className="flex h-9 items-center gap-1.5 rounded-lg glass-strong px-3 text-xs font-semibold text-down disabled:opacity-50"
          >
            {clearingArtwork === "all" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {t("cache.artworkClearAll")}
          </button>
          <button
            onClick={() => clearArtwork("logos")}
            disabled={clearingArtwork !== null}
            className="flex h-9 items-center gap-1.5 rounded-lg glass-strong px-3 text-xs font-semibold text-ink disabled:opacity-50"
          >
            {clearingArtwork === "logos" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {t("cache.artworkClearLogos")}
          </button>
          <button
            onClick={() => clearArtwork("backdrops")}
            disabled={clearingArtwork !== null}
            className="flex h-9 items-center gap-1.5 rounded-lg glass-strong px-3 text-xs font-semibold text-ink disabled:opacity-50"
          >
            {clearingArtwork === "backdrops" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            {t("cache.artworkClearBackdrops")}
          </button>
        </div>
      )}
      <p className="mt-3 text-[11px] text-ink-dim">{t("cache.artworkDaily")}</p>
    </div>
  );

  if (caches.length === 0) {
    return (
      <div className="rounded-2xl glass p-5">
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
            <Database className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-bold text-ink">{t("cache.title")}</h3>
            <p className="mt-0.5 text-xs text-ink-dim">{t("cache.intro")}</p>
          </div>
        </div>
        {artworkSection}
        {warmSection}
        <div className="flex flex-col items-center gap-2 rounded-2xl glass py-12 text-center">
          <Database className="h-6 w-6 text-ink-dim" />
          <p className="text-sm text-ink-dim">{t("cache.empty")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl glass p-5">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
          <Database className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-ink">{t("cache.title")}</h3>
          <p className="mt-0.5 text-xs text-ink-dim">{t("cache.intro")}</p>
        </div>
      </div>
      {artworkSection}
      {warmSection}

      <div className="overflow-hidden rounded-2xl glass">
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="sticky top-0 z-10 border-b border-white/8 bg-white/[0.03] backdrop-blur text-left text-xs font-bold uppercase tracking-wide text-ink-dim">
            <th className="px-4 py-3">{t("cache.name")}</th>
            <th className="px-4 py-3">{t("cache.hits")}</th>
            <th className="px-4 py-3">{t("cache.misses")}</th>
            <th className="px-4 py-3">{t("cache.keys")}</th>
            <th className="px-4 py-3">{t("cache.size")}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {caches.map((c) => (
            <tr key={c.name} className="border-b border-white/5 last:border-0">
              <td className="px-4 py-3 font-semibold text-ink">{c.name}</td>
              <td className="px-4 py-3 text-ok">{c.hits}</td>
              <td className="px-4 py-3 text-ink-dim">{c.misses}</td>
              <td className="px-4 py-3 text-ink-soft">{c.keys} / {c.maxEntries}</td>
              <td className="px-4 py-3 text-ink-dim">{formatBytes(c.keySizeBytes + c.valueSizeBytes)}</td>
              <td className="px-4 py-3 text-right">
                <button
                  onClick={() => clear(c.name)}
                  disabled={clearing === c.name}
                  className="flex h-8 items-center gap-1.5 rounded-lg glass-strong px-3 text-xs font-semibold text-down disabled:opacity-50"
                >
                  {clearing === c.name ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  {t("cache.clear")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
      </div>
    </div>
  );
}
