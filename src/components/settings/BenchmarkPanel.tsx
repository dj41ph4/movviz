"use client";

import { useEffect, useState, useCallback } from "react";
import { useT, useI18n } from "@/i18n/provider";
import { cn, relativeTime } from "@/lib/utils";
import { RefreshCw, Loader2, Cpu } from "lucide-react";

interface BenchmarkProfileResult {
  id: string;
  label: string;
  encoderImpl: string;
  isHardware: boolean;
  realtimeFactor: number | null;
  error: string | null;
}

interface BenchmarkResult {
  ranAt: number;
  durationMs: number;
  appVersion: string;
  hardwareAcceleration: Record<string, boolean>;
  profiles: BenchmarkProfileResult[];
}

function factorTone(factor: number | null): string {
  if (factor === null) return "text-down";
  if (factor < 1) return "text-down";
  if (factor < 2) return "text-amber";
  return "text-ok";
}

/** Pill matching the project's standard status-indicator shape — see
 *  CLAUDE.md's visual-language cheat sheet (rounded-full border, semantic
 *  color trio). */
function FactorPill({ factor }: { factor: number | null }) {
  const t = useT();
  const tone = factorTone(factor);
  const label = factor === null ? t("benchmark.failed") : `${factor.toFixed(2)}x`;
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold",
      tone,
      factor === null ? "border-down/30 bg-down/12" : factor < 1 ? "border-down/30 bg-down/12" : factor < 2 ? "border-amber/30 bg-amber/12" : "border-ok/30 bg-ok/12"
    )}>
      {label}
    </span>
  );
}

export function BenchmarkPanel() {
  const t = useT();
  const { locale } = useI18n();
  const [result, setResult] = useState<BenchmarkResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/system/benchmark", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setResult(d.result))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const run = async () => {
    setRunning(true);
    try {
      const res = await fetch("/api/system/benchmark", { method: "POST" });
      if (res.ok) {
        const d = await res.json();
        setResult(d.result);
      }
    } finally {
      setRunning(false);
    }
  };

  const hwLabels = result ? Object.entries(result.hardwareAcceleration).filter(([, v]) => v).map(([k]) => k) : [];

  return (
    <div className="rounded-2xl glass p-5">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
          <Cpu className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-ink">{t("benchmark.title")}</h3>
          <p className="mt-0.5 text-xs text-ink-dim">{t("benchmark.hint")}</p>
        </div>
        <button
          onClick={run}
          disabled={running || loading}
          className="ml-auto flex h-9 shrink-0 items-center gap-2 rounded-xl brand-gradient px-3.5 text-xs font-bold text-white transition-transform hover:scale-105 disabled:opacity-50 disabled:hover:scale-100"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          {running ? t("benchmark.running") : t("benchmark.run")}
        </button>
      </div>

      {!result && !loading && (
        <p className="py-6 text-center text-xs text-ink-dim">{t("benchmark.never")}</p>
      )}

      {result && (
        <div className="space-y-3">
          <p className="text-xs text-ink-dim">
            {t("benchmark.lastRun")} : {relativeTime(new Date(result.ranAt).toISOString(), locale)} · v{result.appVersion}
          </p>
          {hwLabels.length > 0 && (
            <p className="text-xs text-ink-dim">
              {t("benchmark.hardwareDetected")} : <span className="text-ink-soft">{hwLabels.join(", ")}</span>
            </p>
          )}
          <div className="overflow-hidden rounded-xl border border-white/5 bg-black/40">
            {result.profiles.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 border-b border-white/5 px-3.5 py-2.5 last:border-0">
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-ink-soft">{t("benchmark.profile." + p.id)}</p>
                  <p className="truncate text-[10px] text-ink-dim">{p.encoderImpl}{p.isHardware ? ` · ${t("benchmark.hardware")}` : ""}</p>
                </div>
                <FactorPill factor={p.realtimeFactor} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
