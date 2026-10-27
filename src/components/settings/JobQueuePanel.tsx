"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
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

const JOB_TYPE_ORDER: JobType[] = [
  "download",
  "qualityUpgrade",
  "reconcile",
  "plexWatchlistSync",
  "plexLibrarySync",
  "plexMarkerSync",
  "rssScan",
  "seerrImport",
  "importLists",
  "metadataRefresh",
  "sagaScan",
  "libraryIndex",
  "libraryRename",
  "maintenance",
  "mediaProbe",
];

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
  const [priorities, setPriorities] = useState<Record<JobType, number> | null>(null);
  const [saving, setSaving] = useState<JobType | null>(null);

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

  // Le curseur envoyait une requête à chaque pixel glissé, et la réponse
  // d'une requête plus ancienne pouvait ramener le curseur en arrière.
  // On n'enregistre plus qu'une fois le curseur immobile.
  const saveTimers = useRef<Partial<Record<JobType, ReturnType<typeof setTimeout>>>>({});
  const setPriority = (type: JobType, value: number) => {
    setPriorities((p) => (p ? { ...p, [type]: value } : p));
    const timers = saveTimers.current;
    if (timers[type]) clearTimeout(timers[type]);
    timers[type] = setTimeout(async () => {
      setSaving(type);
      try {
        await fetch("/api/jobs/priorities", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ priorities: { [type]: value } }),
        });
      } finally {
        setSaving(null);
      }
    }, 400);
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
                  className="h-1.5 flex-1 rounded-full appearance-none bg-white/10 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-glow [&::-webkit-slider-thumb]:cursor-pointer"
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
