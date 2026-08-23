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

type Kind = "movies" | "series";

const SOURCE_ID: Record<Kind, string> = {
  movies: "media-probe-library-movies",
  series: "media-probe-library-series",
};

/** One kind's scan/full buttons + progress + result — shared row markup for
 *  the Films and Séries sections below (see ProbeKindRow usage), each
 *  tracked as its own independent job (own sourceId) so a series scan
 *  running long never blocks starting a movie scan and vice versa. */
function ProbeKindRow({ kind, jobs, mutate }: { kind: Kind; jobs: Job[] | undefined; mutate: () => void }) {
  const t = useT();
  const [starting, setStarting] = useState(false);
  const sourceId = SOURCE_ID[kind];
  const job = jobs?.find((j) => j.sourceId === sourceId);
  const active = job?.status === "queued" || job?.status === "running";
  const running = starting || active;
  const lastResult = job?.status === "completed" ? job.result : undefined;

  const start = async (force: boolean) => {
    setStarting(true);
    try {
      await fetch(`/api/library/media-probe/scan?kind=${kind}${force ? "&force=1" : ""}`, { method: "POST" });
      await mutate();
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl glass-strong p-4">
      <div>
        <h4 className="text-sm font-bold text-ink">{t(kind === "movies" ? "common.movies" : "common.series")}</h4>
        <p className="mt-0.5 text-xs text-ink-dim">{t(kind === "movies" ? "mediaProbe.intro" : "mediaProbe.introSeries")}</p>
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
          title={t(kind === "movies" ? "mediaProbe.fullHint" : "mediaProbe.fullHintSeries")}
          className="flex h-10 items-center gap-2 rounded-xl glass px-4 text-sm font-semibold text-ink-soft transition-colors hover:text-ink disabled:opacity-60"
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
        <div className="flex items-center gap-2 rounded-xl glass p-3 text-sm text-ok">
          <Check className="h-4 w-4 shrink-0" />
          {t("mediaProbe.resultSummary", lastResult)}
        </div>
      )}

      {job?.status === "failed" && (
        <div className="flex items-center gap-2 rounded-xl border border-down/25 bg-down/8 p-3 text-sm text-down">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {job.error}
        </div>
      )}
    </div>
  );
}

/** Réglages > Maintenance — bulk-warms the MediaDescriptor cache (see
 *  src/lib/playback/engine/) for every owned movie AND every series episode,
 *  via the shared job queue. Same inline trigger+progress pattern as
 *  LibraryGrid's "Rechercher les manquants" button (poll /api/jobs, match by
 *  sourceId) — one row per kind, independently triggerable. */
export function MediaProbePanel() {
  const t = useT();
  const { data: jobsData, mutate } = useSWR<{ jobs: Job[] }>("/api/jobs", { refreshInterval: 2000 });

  return (
    <div className="rounded-2xl glass p-5 space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
          <ScanLine className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-ink">{t("mediaProbe.title")}</h3>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ProbeKindRow kind="movies" jobs={jobsData?.jobs} mutate={mutate} />
        <ProbeKindRow kind="series" jobs={jobsData?.jobs} mutate={mutate} />
      </div>
    </div>
  );
}
