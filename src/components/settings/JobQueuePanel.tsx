"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { Loader2, Clock, CheckCircle2, XCircle, ListChecks, ListOrdered } from "lucide-react";

type JobStatus = "queued" | "running" | "completed" | "failed";
type JobType =
  | "download"
  | "sagaScan"
  | "reconcile"
  | "qualityUpgrade"
  | "plexLibrarySync"
  | "plexWatchlistSync"
  | "metadataRefresh"
  | "rssScan"
  | "seerrImport"
  | "importLists"
  | "libraryIndex"
  | "libraryRename"
  | "maintenance";

interface Job {
  id: string;
  type: JobType;
  label: string;
  status: JobStatus;
  current: number;
  total: number;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
  error: string | null;
}

const JOB_TYPE_ORDER: JobType[] = [
  "download",
  "qualityUpgrade",
  "reconcile",
  "plexWatchlistSync",
  "plexLibrarySync",
  "rssScan",
  "seerrImport",
  "importLists",
  "metadataRefresh",
  "sagaScan",
  "libraryIndex",
  "libraryRename",
  "maintenance",
];

const STATUS_ICON: Record<JobStatus, typeof Clock> = {
  queued: Clock,
  running: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
};
const STATUS_TONE: Record<JobStatus, string> = {
  queued: "text-ink-dim",
  running: "text-cyan",
  completed: "text-ok",
  failed: "text-down",
};

export function JobQueuePanel() {
  const t = useT();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [priorities, setPriorities] = useState<Record<JobType, number> | null>(null);
  const [saving, setSaving] = useState<JobType | null>(null);

  const loadJobs = () =>
    fetch("/api/jobs", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setJobs(d.jobs ?? []));

  const loadPriorities = () =>
    fetch("/api/jobs/priorities", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setPriorities(d.priorities));

  useEffect(() => {
    loadJobs();
    loadPriorities();
    const id = setInterval(loadJobs, 2500);
    return () => clearInterval(id);
  }, []);

  const setPriority = async (type: JobType, value: number) => {
    setPriorities((p) => (p ? { ...p, [type]: value } : p));
    setSaving(type);
    try {
      const res = await fetch("/api/jobs/priorities", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ priorities: { [type]: value } }),
      });
      if (res.ok) {
        const d = await res.json();
        setPriorities(d.priorities);
      }
    } finally {
      setSaving(null);
    }
  };

  const active = jobs.filter((j) => j.status === "queued" || j.status === "running");
  const recent = jobs.filter((j) => j.status === "completed" || j.status === "failed").slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
          <ListOrdered className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-ink">{t("jobs.title")}</h3>
          <p className="mt-0.5 text-xs text-ink-dim">{t("jobs.queueTitle")}</p>
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-sm font-bold text-ink">{t("jobs.queueTitle")}</h3>
        <p className="mb-3 text-xs text-ink-dim">{t("jobs.queueHint")}</p>

        {active.length === 0 ? (
          <div className="flex items-center gap-2 rounded-2xl glass p-4 text-sm text-ink-dim">
            <ListChecks className="h-4 w-4" /> {t("jobs.empty")}
          </div>
        ) : (
          <div className="space-y-2">
            {active.map((job) => {
              const Icon = STATUS_ICON[job.status];
              const pct = job.total > 0 ? Math.round((job.current / job.total) * 100) : 0;
              return (
                <div key={job.id} className="rounded-2xl glass p-3.5">
                  <div className="flex items-center gap-2.5">
                    <Icon className={cn("h-4 w-4 shrink-0", STATUS_TONE[job.status], job.status === "running" && "animate-spin")} />
                    <span className="flex-1 truncate text-sm font-medium text-ink">{job.label}</span>
                    <span className="shrink-0 text-xs text-ink-dim">
                      {job.status === "queued" ? t("jobs.statusQueued") : `${job.current}/${job.total}`}
                    </span>
                  </div>
                  {job.status === "running" && job.total > 0 && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/40">
                      <div className="h-full rounded-full brand-gradient transition-[width] duration-500" style={{ width: `${pct}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {recent.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-dim">{t("jobs.recent")}</p>
            <div className="space-y-1.5">
              {recent.map((job) => {
                const Icon = STATUS_ICON[job.status];
                return (
                  <div key={job.id} className="flex items-center gap-2.5 rounded-xl glass px-3 py-2 text-xs">
                    <Icon className={cn("h-3.5 w-3.5 shrink-0", STATUS_TONE[job.status])} />
                    <span className="flex-1 truncate text-ink-soft">{job.label}</span>
                    <span className="text-ink-dim">{job.total > 0 ? `${job.current}/${job.total}` : ""}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div>
        <h3 className="mb-1 text-sm font-bold text-ink">{t("jobs.prioritiesTitle")}</h3>
        <p className="mb-3 text-xs text-ink-dim">{t("jobs.prioritiesHint")}</p>
        {priorities && (
          <div className="space-y-3 rounded-2xl glass p-4">
            {JOB_TYPE_ORDER.map((type) => (
              <div key={type} className="flex items-center gap-4">
                <div className="w-44 shrink-0">
                  <p className="text-sm font-medium text-ink">{t(`jobs.types.${type}`)}</p>
                  {type === "download" && <p className="text-[11px] text-ink-dim">{t("jobs.downloadHint")}</p>}
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={priorities[type] ?? 0}
                  onChange={(e) => setPriority(type, Number(e.target.value))}
                  className="h-1.5 flex-1 accent-brand-glow"
                />
                <span className="w-10 shrink-0 text-right text-sm font-bold text-ink tabular-nums">
                  {saving === type ? <Loader2 className="ml-auto h-3.5 w-3.5 animate-spin text-ink-dim" /> : priorities[type]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
