"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { Toggle } from "@/components/ui/Toggle";
import { Loader2, Clock, CheckCircle2, XCircle, ListChecks, ListOrdered, Ban, Square, Play } from "lucide-react";

/** Pourquoi un job en file attend (voir getJobHolds côté serveur). */
type JobHold =
  | { code: "heavy_running"; task?: string }
  | { code: "lane" }
  | { code: "slot" }
  | { code: "activity"; hold:
      | { code: "user_active"; user?: string; path?: string }
      | { code: "foreground"; users: string[] }
      | { code: "playback"; count: number } };

type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
type JobType =
  | "download"
  | "sagaScan"
  | "reconcile"
  | "qualityUpgrade"
  | "plexLibrarySync"
  | "plexMarkerSync"
  | "plexWatchlistSync"
  | "metadataRefresh"
  | "rssScan"
  | "seerrImport"
  | "importLists"
  | "libraryIndex"
  | "libraryRename"
  | "maintenance"
  | "mediaProbe";

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


const STATUS_ICON: Record<JobStatus, typeof Clock> = {
  queued: Clock,
  running: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
  cancelled: Ban,
};
const STATUS_TONE: Record<JobStatus, string> = {
  queued: "text-ink-dim",
  running: "text-cyan",
  completed: "text-ok",
  failed: "text-down",
  cancelled: "text-ink-dim",
};

export function JobQueuePanel() {
  const t = useT();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [slowDuringDownload, setSlowDuringDownload] = useState<boolean | null>(null);

  const [holds, setHolds] = useState<Record<string, JobHold>>({});
  const [forceMessage, setForceMessage] = useState<string | null>(null);

  const loadJobs = () =>
    fetch("/api/jobs", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setJobs(d.jobs ?? []);
        setHolds(d.holds ?? {});
      });

  const loadSlowSetting = () =>
    fetch("/api/settings/background-tasks", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setSlowDuringDownload(d.slowDuringDownload === true));

  useEffect(() => {
    loadJobs();
    loadSlowSetting();
    const id = setInterval(loadJobs, 2500);
    return () => clearInterval(id);
  }, []);

  const changeSlowDuringDownload = async (next: boolean) => {
    setSlowDuringDownload(next);
    await fetch("/api/settings/background-tasks", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slowDuringDownload: next }),
    }).catch(() => null);
    await loadSlowSetting();
  };

  const cancelJob = async (id: string) => {
    await fetch(`/api/jobs/${id}/cancel`, { method: "POST" });
    await loadJobs();
  };

  // Lance tout de suite un job en file, devant l'activité des utilisateurs et les lectures.
  const forceJob = async (id: string) => {
    setForceMessage(null);
    const res = await fetch(`/api/jobs/${id}/force`, { method: "POST" }).catch(() => null);
    if (res && !res.ok) {
      const body = await res.json().catch(() => null) as { error?: string } | null;
      setForceMessage(t(body?.error === "heavy_busy" ? "jobs.forceBusy" : body?.error === "queue_full" ? "jobs.forceFull" : "jobs.forceFailed"));
    } else if (!res) setForceMessage(t("jobs.forceFailed"));
    await loadJobs();
  };

  const holdText = (hold: JobHold | undefined): string | null => {
    if (!hold) return null;
    switch (hold.code) {
      case "heavy_running": return t("jobs.holdHeavy", { task: hold.task ?? "…" });
      case "lane": return t("jobs.holdLane");
      case "slot": return t("jobs.holdSlot");
      case "activity":
        if (hold.hold.code === "playback") return t("jobs.holdPlayback", { count: String(hold.hold.count) });
        if (hold.hold.code === "foreground") return t("jobs.holdForeground", { users: hold.hold.users.join(", ") });
        return t("jobs.holdUserActive", { user: hold.hold.user ?? "?", path: hold.hold.path ? `(${hold.hold.path})` : "" }).trim();
    }
  };

  const active = jobs.filter((j) => j.status === "queued" || j.status === "running");
  const recent = jobs.filter((j) => j.status === "completed" || j.status === "failed" || j.status === "cancelled").slice(0, 10);

  return (
    <div className="rounded-2xl glass p-5 space-y-6">
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
        {forceMessage && <p className="mb-3 text-xs text-warn">{forceMessage}</p>}

        {active.length === 0 ? (
          <div className="flex items-center gap-2 rounded-2xl glass p-4 text-sm text-ink-dim">
            <ListChecks className="h-4 w-4" /> {t("jobs.empty")}
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {active.map((job) => {
                const Icon = STATUS_ICON[job.status];
                const pct = job.total > 0 ? Math.round((job.current / job.total) * 100) : 0;
                return (
                  <motion.div
                    key={job.id}
                    layout
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    className="overflow-hidden rounded-2xl glass p-3.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon className={cn("h-4 w-4 shrink-0", STATUS_TONE[job.status], job.status === "running" && "animate-spin")} />
                      <span className="min-w-0 flex-1 break-words text-sm font-medium text-ink">{job.label}</span>
                      <span className="shrink-0 text-xs text-ink-dim">
                        {job.status === "queued" ? t("jobs.statusQueued") : `${job.current}/${job.total}`}
                      </span>
                      {job.status === "queued" && (
                        <button
                          onClick={() => forceJob(job.id)}
                          title={t("jobs.force")}
                          aria-label={t("jobs.force")}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-dim transition-colors hover:bg-white/10 hover:text-brand-glow"
                        >
                          <Play className="h-3 w-3 fill-current" />
                        </button>
                      )}
                      <button
                        onClick={() => cancelJob(job.id)}
                        title={t("jobs.cancel")}
                        aria-label={t("jobs.cancel")}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-ink-dim transition-colors hover:bg-white/10 hover:text-down"
                      >
                        <Square className="h-3 w-3 fill-current" />
                      </button>
                    </div>
                    {job.status === "queued" && holdText(holds[job.id]) && (
                      <p className="mt-1.5 pl-[26px] text-xs text-ink-dim">{holdText(holds[job.id])}</p>
                    )}
                    {job.status === "running" && job.total > 0 && (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/40">
                        <div className="h-full rounded-full brand-gradient transition-[width] duration-500" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        {recent.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-dim">{t("jobs.recent")}</p>
            <div className="space-y-1.5">
              <AnimatePresence initial={false}>
                {recent.map((job) => {
                  const Icon = STATUS_ICON[job.status];
                  return (
                    <motion.div
                      key={job.id}
                      layout
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      className="flex items-center gap-2.5 overflow-hidden rounded-xl glass px-3 py-2 text-xs"
                    >
                      <Icon className={cn("h-3.5 w-3.5 shrink-0", STATUS_TONE[job.status])} />
                      <span className="min-w-0 flex-1 break-words text-ink-soft">{job.label}</span>
                      <span className="text-ink-dim">{job.total > 0 ? `${job.current}/${job.total}` : ""}</span>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-2xl glass p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-ink">{t("jobs.slowTitle")}</h3>
            <p className="mt-1 text-xs text-ink-dim">{t("jobs.slowHint")}</p>
          </div>
          <Toggle label={t("jobs.slowTitle")} on={slowDuringDownload === true} disabled={slowDuringDownload === null} onChange={() => changeSlowDuringDownload(!slowDuringDownload)} />
        </div>
      </div>
    </div>
  );
}
