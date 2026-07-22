"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { RefreshCw, Loader2, Gauge, Globe, MonitorSmartphone } from "lucide-react";

interface PerfAggregate {
  kind: "client" | "outbound";
  label: string;
  count: number;
  avgMs: number;
  maxMs: number;
  lastMs: number;
  lastAt: number;
  errors: number;
}

function msTone(ms: number) {
  if (ms >= 2000) return "text-down";
  if (ms >= 500) return "text-amber";
  return "text-ok";
}

function fmtMs(ms: number) {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${Math.round(ms)}ms`;
}

function PerfTable({ rows, emptyLabel }: { rows: PerfAggregate[]; emptyLabel: string }) {
  const t = useT();
  if (!rows.length) {
    return <p className="py-6 text-center text-xs text-ink-dim">{emptyLabel}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-white/5 bg-black/40">
      <table className="w-full text-left font-mono text-[11px]">
        <thead>
          <tr className="border-b border-white/8 text-[10px] uppercase tracking-wider text-ink-dim">
            <th className="px-3 py-2 font-semibold">{t("health.perfColRequest")}</th>
            <th className="px-3 py-2 text-right font-semibold">{t("health.perfColCount")}</th>
            <th className="px-3 py-2 text-right font-semibold">{t("health.perfColAvg")}</th>
            <th className="px-3 py-2 text-right font-semibold">{t("health.perfColMax")}</th>
            <th className="px-3 py-2 text-right font-semibold">{t("health.perfColLast")}</th>
            <th className="px-3 py-2 text-right font-semibold">{t("health.perfColErrors")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.kind + a.label} className="border-b border-white/5 last:border-0">
              <td className="max-w-[320px] truncate px-3 py-1.5 text-ink-soft" title={a.label}>{a.label}</td>
              <td className="px-3 py-1.5 text-right text-ink-dim">{a.count}</td>
              <td className={cn("px-3 py-1.5 text-right font-bold", msTone(a.avgMs))}>{fmtMs(a.avgMs)}</td>
              <td className={cn("px-3 py-1.5 text-right", msTone(a.maxMs))}>{fmtMs(a.maxMs)}</td>
              <td className="px-3 py-1.5 text-right text-ink-soft">{fmtMs(a.lastMs)}</td>
              <td className={cn("px-3 py-1.5 text-right", a.errors ? "text-down" : "text-ink-dim")}>{a.errors}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PerfPanel() {
  const t = useT();
  const [aggregates, setAggregates] = useState<PerfAggregate[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/perf", { cache: "no-store" });
      if (res.ok) setAggregates((await res.json()).aggregates ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const clientRows = (aggregates ?? []).filter((a) => a.kind === "client").slice(0, 30);
  const outboundRows = (aggregates ?? []).filter((a) => a.kind === "outbound").slice(0, 30);

  return (
    <div className="rounded-2xl glass p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-bold text-ink">
            <Gauge className="h-4 w-4 text-brand-glow" /> {t("health.perfTitle")}
          </h3>
          <p className="mt-1 max-w-xl text-xs text-ink-dim">{t("health.perfHint")}</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex h-9 items-center gap-2 rounded-xl glass-strong px-3.5 text-xs font-semibold text-ink-soft disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {t("health.logsRefresh")}
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-ink-dim">
            <MonitorSmartphone className="h-3.5 w-3.5" /> {t("health.perfKindClient")}
          </h4>
          <PerfTable rows={clientRows} emptyLabel={t("health.perfEmpty")} />
        </div>
        <div>
          <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-ink-dim">
            <Globe className="h-3.5 w-3.5" /> {t("health.perfKindOutbound")}
          </h4>
          <PerfTable rows={outboundRows} emptyLabel={t("health.perfEmpty")} />
        </div>
      </div>
    </div>
  );
}
