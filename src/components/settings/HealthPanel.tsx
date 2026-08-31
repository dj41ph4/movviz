"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { Check, X, Loader2, Activity } from "lucide-react";

interface ProcStats {
  rssBytes: number | null;
  cpuMs: number | null;
  uptimeMs: number | null;
}

interface HealthData {
  engine: boolean;
  tmdb: boolean;
  indexers: { name: string; ok: boolean }[];
  disk: { total: number; free: number } | null;
  processes?: { web: ProcStats; engine: ProcStats | null };
}

function formatBytes(n: number) {
  const gb = n / 1024 ** 3;
  return `${gb.toFixed(1)} GB`;
}

function ProcRow({ label, stats }: { label: string; stats: ProcStats }) {
  const t = useT();
  // Cumulative CPU time over process lifetime → sustained average load. A
  // healthy idle service sits in single digits; a pegged one shows ~100%.
  const cpuPct =
    stats.cpuMs != null && stats.uptimeMs ? Math.round((stats.cpuMs / stats.uptimeMs) * 100) : null;
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-4 py-3">
      <span className="text-sm font-semibold text-ink-soft">{label}</span>
      <span className="flex items-center gap-4 font-mono text-xs">
        <span className={cn(cpuPct != null && cpuPct >= 70 ? "text-down" : cpuPct != null && cpuPct >= 30 ? "text-amber" : "text-ink-dim")}>
          CPU {cpuPct != null ? `${cpuPct}%` : "—"}
        </span>
        <span className={cn(stats.rssBytes != null && stats.rssBytes > 1.2 * 1024 ** 3 ? "text-down" : "text-ink-dim")}>
          RAM {stats.rssBytes != null ? formatBytes(stats.rssBytes) : "—"}
        </span>
        <span className="text-ink-dim">
          {t("health.procUptime")} {stats.uptimeMs != null ? `${Math.round(stats.uptimeMs / 60000)}min` : "—"}
        </span>
      </span>
    </div>
  );
}

function Row({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-4 py-3">
      <span className="text-sm font-semibold text-ink-soft">{label}</span>
      <span className={cn("flex items-center gap-1.5 text-sm font-semibold", ok ? "text-ok" : "text-down")}>
        {ok ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
      </span>
    </div>
  );
}

export function HealthPanel() {
  const t = useT();
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading && !data) {
    return (
      <div className="rounded-2xl glass p-5">
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
            <Activity className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-bold text-ink">{t("health.title")}</h3>
            <p className="mt-0.5 text-xs text-ink-dim">{t("health.checking")}</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-2 rounded-2xl glass py-16 text-ink-dim"><Loader2 className="h-5 w-5 animate-spin" /> {t("health.checking")}</div>
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="rounded-2xl glass p-5">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
          <Activity className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-ink">{t("health.title")}</h3>
          <p className="mt-0.5 text-xs text-ink-dim">{t("health.engine")}</p>
        </div>
      </div>
      <div className="space-y-3 rounded-2xl glass p-5">
      <Row label={t("health.engine")} ok={data.engine} />
      <Row label={t("health.tmdb")} ok={data.tmdb} />
      {data.indexers.map((ix) => (
        <Row key={ix.name} label={`${t("health.indexers")} · ${ix.name}`} ok={ix.ok} />
      ))}
      {data.processes && (
        <>
          <ProcRow label={t("health.procWeb")} stats={data.processes.web} />
          {data.processes.engine && <ProcRow label={t("health.procEngine")} stats={data.processes.engine} />}
        </>
      )}
      {data.disk && (
        <div className="rounded-xl border border-white/5 bg-black/20 px-4 py-3">
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="font-semibold text-ink-soft">{t("health.disk")}</span>
            <span className="text-ink-dim">{formatBytes(data.disk.total - data.disk.free)} / {formatBytes(data.disk.total)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
            <div className="h-full brand-gradient" style={{ width: `${Math.round(((data.disk.total - data.disk.free) / data.disk.total) * 100)}%` }} />
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
