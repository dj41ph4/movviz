"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { relativeTime } from "@/lib/utils";
import { useJobRunning } from "@/lib/jobs/useJobRunning";
import { RotateCw, Loader2 } from "lucide-react";

interface TaskStatus {
  id: string;
  name: string;
  intervalMs: number;
  lastRunAt: number | null;
  lastDurationMs: number | null;
  nextRunAt: number | null;
}

function formatInterval(ms: number) {
  const hours = ms / 3_600_000;
  if (hours >= 24 && hours % 24 === 0) return `${hours / 24} j`;
  if (hours >= 1) return `${hours} h`;
  return `${Math.round(ms / 60_000)} min`;
}

function formatDuration(ms: number | null) {
  if (ms == null) return "—";
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** relativeTime() only speaks "ago" — nextRunAt is in the future, so it needs its own "in X" phrasing. */
function formatFuture(ts: number): string | null {
  const diff = ts - Date.now();
  const min = Math.round(diff / 60000);
  if (min < 1) return null; // due now
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.round(hr / 24)}j`;
}

export function TasksPanel() {
  const t = useT();
  const [tasks, setTasks] = useState<TaskStatus[]>([]);
  const [running, setRunning] = useState<string | null>(null);

  const load = () =>
    fetch("/api/tasks", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setTasks(d.tasks ?? []));

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  const run = async (id: string) => {
    setRunning(id);
    try {
      // Just enqueues and returns — the task runs as a background job, so
      // there's nothing to await beyond that. TaskRow's own job-queue-backed
      // spinner (see useJobRunning) is what actually reflects it running.
      await fetch(`/api/tasks/${id}/run`, { method: "POST" });
      await load();
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl glass">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/8 text-left text-xs font-bold uppercase tracking-wide text-ink-dim">
            <th className="px-4 py-3">{t("tasks.name")}</th>
            <th className="px-4 py-3">{t("tasks.interval")}</th>
            <th className="px-4 py-3">{t("tasks.lastRun")}</th>
            <th className="px-4 py-3">{t("tasks.lastDuration")}</th>
            <th className="px-4 py-3">{t("tasks.nextRun")}</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <TaskRow key={task.id} task={task} localRunning={running === task.id} onRun={() => run(task.id)} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TaskRow({ task, localRunning, onRun }: { task: TaskStatus; localRunning: boolean; onRun: () => void }) {
  const t = useT();
  // The click already sets localRunning instantly, but that resets the
  // moment this panel unmounts — useJobRunning reflects the real job-queue
  // state instead, so the spinner still shows correctly if you leave
  // Réglages and come back while the task is still running.
  const jobRunning = useJobRunning(task.id);
  const running = localRunning || jobRunning;
  return (
    <tr className="border-b border-white/5 last:border-0">
      <td className="px-4 py-3 font-semibold text-ink">{t("scheduler.task." + task.id)}</td>
      <td className="px-4 py-3 text-ink-soft">{formatInterval(task.intervalMs)}</td>
      <td className="px-4 py-3 text-ink-dim">
        {task.lastRunAt ? relativeTime(new Date(task.lastRunAt).toISOString()) : t("tasks.never")}
      </td>
      <td className="px-4 py-3 text-ink-dim">{formatDuration(task.lastDurationMs)}</td>
      <td className="px-4 py-3 text-ink-dim">
        {task.nextRunAt
          ? (() => {
              const remaining = formatFuture(task.nextRunAt);
              return remaining ? `${t("tasks.in")} ${remaining}` : t("tasks.now");
            })()
          : "—"}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={onRun}
          disabled={running}
          className="flex h-8 w-8 items-center justify-center rounded-lg glass-strong text-ink-soft transition-colors hover:text-brand-glow disabled:opacity-50"
        >
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
        </button>
      </td>
    </tr>
  );
}
