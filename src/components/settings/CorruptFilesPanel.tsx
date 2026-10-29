"use client";

import useSWR from "swr";
import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { formatBytes } from "@/lib/utils";
import { FileWarning, Loader2, Check, Search } from "lucide-react";

interface Job {
  id: string;
  sourceId?: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  current: number;
  total: number;
}

type Reason = "empty" | "zero_head" | "partial" | "unreadable";

interface Item {
  kind: "movie" | "episode";
  id: string;
  title: string;
  seasonNumber?: number;
  episodeNumber?: number;
  path: string;
  size: number;
  reason: Reason;
  zeroRatio: number;
}

interface Report {
  scannedAt: number | null;
  checked: number;
  missing: number;
  items: Item[];
}

const SOURCE_ID = "corrupt-files-scan";

/** Réglages > Maintenance — liste des fichiers vides ou incomplets de la
 *  bibliothèque (lecture seule : rien n'est supprimé ni modifié). */
export function CorruptFilesPanel() {
  const t = useT();
  const { data: jobsData, mutate: mutateJobs } = useSWR<{ jobs: Job[] }>("/api/jobs", { refreshInterval: 2000 });
  const { data: report, mutate: mutateReport } = useSWR<Report>("/api/library/corrupt-files");
  const [starting, setStarting] = useState(false);
  const [filter, setFilter] = useState("");

  const job = jobsData?.jobs.find((j) => j.sourceId === SOURCE_ID);
  const active = job?.status === "queued" || job?.status === "running";
  const running = starting || active;

  const start = async () => {
    setStarting(true);
    try {
      await fetch("/api/library/corrupt-files", { method: "POST" });
      await mutateJobs();
    } finally {
      setStarting(false);
    }
  };

  // Le rapport est enregistré à la fin du balayage : on le relit dès que la tâche se termine.
  const doneId = job?.status === "completed" ? job.id : null;
  useEffect(() => {
    if (doneId) void mutateReport();
  }, [doneId, mutateReport]);

  const items = (report?.items ?? []).filter((i) => !filter || `${i.title} ${i.path}`.toLowerCase().includes(filter.toLowerCase()));
  const label = (i: Item) =>
    i.kind === "episode" ? `${i.title} · S${String(i.seasonNumber ?? 0).padStart(2, "0")}E${String(i.episodeNumber ?? 0).padStart(2, "0")}` : i.title;

  return (
    <div className="space-y-4 rounded-2xl glass p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
          <FileWarning className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-ink">{t("corruptFiles.title")}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-dim">{t("corruptFiles.intro")}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={start}
          disabled={running}
          className="flex h-10 items-center gap-2 rounded-xl brand-gradient px-4 text-sm font-bold text-white disabled:opacity-60"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {running && job && job.total > 1 ? `${job.current} / ${job.total}` : running ? t("corruptFiles.scanning") : t("corruptFiles.scan")}
        </button>
        {report?.scannedAt && (
          <span className="text-xs text-ink-dim">
            {t("corruptFiles.summary", { checked: report.checked, count: report.items.length, date: new Date(report.scannedAt).toLocaleString() })}
          </span>
        )}
      </div>

      {report?.scannedAt && report.items.length === 0 && (
        <div className="flex items-center gap-2 rounded-xl glass p-3 text-sm text-ok">
          <Check className="h-4 w-4 shrink-0" />
          {t("corruptFiles.none")}
        </div>
      )}

      {report && report.items.length > 0 && (
        <div className="space-y-2">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("corruptFiles.filter")}
            className="h-10 w-full rounded-xl glass px-3 text-sm text-ink placeholder:text-ink-dim"
          />
          <ul className="max-h-[28rem] divide-y divide-white/8 overflow-y-auto rounded-xl glass-strong">
            {items.map((i) => (
              <li key={`${i.id}:${i.seasonNumber ?? ""}:${i.episodeNumber ?? ""}:${i.path}`} className="space-y-0.5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-ink">{label(i)}</span>
                  <span className="rounded-full bg-down/12 px-2 py-0.5 text-[11px] font-semibold text-down">
                    {t(`corruptFiles.reason.${i.reason}`)}
                    {i.reason === "partial" ? ` · ${Math.round(i.zeroRatio * 100)} %` : ""}
                  </span>
                </div>
                <p className="break-all text-xs text-ink-dim">{i.path}</p>
                <p className="text-xs text-ink-dim">{formatBytes(i.size)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
