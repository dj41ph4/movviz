"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { Trash2, Loader2, Sparkles } from "lucide-react";

interface CacheStats {
  name: string;
  hits: number;
  misses: number;
  keys: number;
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

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 ** 2).toFixed(2)} MB`;
}

export function CachePanel() {
  const t = useT();
  const [caches, setCaches] = useState<CacheStats[]>([]);
  const [clearing, setClearing] = useState<string | null>(null);
  const [warm, setWarm] = useState<WarmState | null>(null);

  const load = () =>
    fetch("/api/cache", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCaches(d.caches ?? []));

  const loadWarm = () =>
    fetch("/api/cache/warm", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setWarm(d));

  useEffect(() => {
    load();
    loadWarm();
    const id = setInterval(() => { load(); loadWarm(); }, 1500);
    return () => clearInterval(id);
  }, []);

  const startWarm = () => fetch("/api/cache/warm", { method: "POST" }).then(loadWarm);
  const warmPct = warm && warm.total > 0 ? Math.round((warm.done / warm.total) * 100) : 0;

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

  if (caches.length === 0) {
    return (
      <div>
        {warmSection}
        <div className="rounded-2xl glass py-12 text-center text-sm text-ink-dim">{t("cache.empty")}</div>
      </div>
    );
  }

  return (
    <div>
      {warmSection}
      <div className="overflow-hidden rounded-2xl glass">
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/8 text-left text-xs font-bold uppercase tracking-wide text-ink-dim">
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
              <td className="px-4 py-3 text-ink-soft">{c.keys}</td>
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
