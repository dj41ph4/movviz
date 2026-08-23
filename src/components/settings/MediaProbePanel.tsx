"use client";

import useSWR from "swr";
import { useState } from "react";
import { useT } from "@/i18n/provider";
import { ScanLine, Loader2, Check, AlertTriangle } from "lucide-react";

interface Job {
  id: string;
  sourceId?: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  current: number;
  total: number;
  error: string | null;
  result?: { probed: number; skipped: number; failed: number; total: number };
}

const SOURCE_ID = "media-probe-library";

/** Réglages > Maintenance — bulk-warms the MediaDescriptor cache (see
 *  src/lib/playback/engine/) for every owned movie, via the shared job
 *  queue. Same inline trigger+progress pattern as LibraryGrid's "Rechercher
 *  les manquants" button (poll /api/jobs, match by sourceId). */
export function MediaProbePanel() {
  const t = useT();
  const [starting, setStarting] = useState<"incremental" | "full" | null>(null);
  const { data: jobsData, mutate } = useSWR<{ jobs: Job[] }>("/api/jobs", { refreshInterval: 2000 });
  const job = jobsData?.jobs.find((j) => j.sourceId === SOURCE_ID);
  const active = job?.status === "queued" || job?.status === "running";
  const running = !!starting || active;
  const lastResult = job?.status === "completed" ? job.result : undefined;

  const start = async (force: boolean) => {
    setStarting(force ? "full" : "incremental");
    try {
      await fetch(`/api/library/media-probe/scan${force ? "?force=1" : ""}`, { method: "POST" });
      await mutate();
    } finally {
      setStarting(null);
    }
  };

  return (
    <div className="rounded-2xl glass p-5 space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
          <ScanLine className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-ink">{t("mediaProbe.title")}</h3>
          <p className="mt-0.5 text-xs text-ink-dim">{t("mediaProbe.intro")}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => start(false)}
          disabled={running}
          className="flex h-10 items-center gap-2 rounded-xl brand-gradient px-4 text-sm font-bold text-white disabled:opacity-60"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
          {running && job && job.total > 1 ? `${job.current} / ${job.total}` : running ? t("mediaProbe.scanning") : t("mediaProbe.scan")}
        </button>
        <button
          onClick={() => start(true)}
          disabled={running}
          title={t("mediaProbe.fullHint")}
          className="flex h-10 items-center gap-2 rounded-xl glass-strong px-4 text-sm font-semibold text-ink-soft transition-colors hover:text-ink disabled:opacity-60"
        >
          <ScanLine className="h-4 w-4" />
          {t("mediaProbe.full")}
        </button>
      </div>

      {running && job && job.total > 1 && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full brand-gradient transition-[width] duration-500"
            style={{ width: `${Math.round((job.current / job.total) * 100)}%` }}
          />
        </div>
      )}

      {lastResult && (
        <div className="flex items-center gap-2 rounded-2xl glass-strong p-4 text-sm text-ok">
          <Check className="h-4 w-4 shrink-0" />
          {t("mediaProbe.resultSummary", lastResult)}
        </div>
      )}

      {job?.status === "failed" && (
        <div className="flex items-center gap-2 rounded-2xl border border-down/25 bg-down/8 p-4 text-sm text-down">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {job.error}
        </div>
      )}
    </div>
  );
}
