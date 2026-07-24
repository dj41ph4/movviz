"use client";

import { useEffect, useState, useCallback } from "react";
import { useT } from "@/i18n/provider";
import { relativeTime } from "@/lib/utils";
import { useJobRunning } from "@/lib/jobs/useJobRunning";
import { RotateCw, Loader2, Pencil, Check, X, ListTodo } from "lucide-react";

interface TaskStatus {
  id: string;
  name: string;
  intervalMs: number;
  lastRunAt: number | null;
  lastDurationMs: number | null;
  nextRunAt: number | null;
}

function formatInterval(ms: number) {
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.round((ms % 3600000) / 60000);
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}j`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || parts.length === 0) parts.push(`${m}min`);
  return parts.join(" ");
}

function parseInterval(d: number, h: number, m: number): number {
  return (d * 86400000) + (h * 3600000) + (m * 60000);
}

function splitInterval(ms: number) {
  return {
    days: Math.floor(ms / 86400000),
    hours: Math.floor((ms % 86400000) / 3600000),
    minutes: Math.round((ms % 3600000) / 60000),
  };
}

function formatDuration(ms: number | null) {
  if (ms == null) return "—";
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function formatFuture(ts: number): string | null {
  const diff = ts - Date.now();
  const min = Math.round(diff / 60000);
  if (min < 1) return null;
  if (min < 60) return `${min}m`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h`;
  return `${Math.round(hr / 24)}j`;
}

export function TasksPanel() {
  const t = useT();
  const [tasks, setTasks] = useState<TaskStatus[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const load = useCallback(() =>
    fetch("/api/tasks", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setTasks(d.tasks ?? [])),
  []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const run = async (id: string) => {
    setRunning(id);
    try {
      await fetch(`/api/tasks/${id}/run`, { method: "POST" });
      await load();
    } finally {
      setRunning(null);
    }
  };

  const saveInterval = async (id: string, intervalMs: number | null) => {
    await fetch("/api/tasks", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tasks: [{ id, intervalMs }] }),
    });
    setEditing(null);
    await load();
  };

  return (
    <div>
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
          <ListTodo className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-ink">{t("tasks.title")}</h3>
          <p className="mt-0.5 text-xs text-ink-dim">{t("tasks.name")}</p>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl glass">
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="sticky top-0 z-10 border-b border-white/8 bg-white/[0.03] backdrop-blur text-left text-xs font-bold uppercase tracking-wide text-ink-dim">
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
            editing === task.id ? (
              <EditRow
                key={task.id}
                task={task}
                onSave={(ms) => saveInterval(task.id, ms)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <TaskRow
                key={task.id}
                task={task}
                localRunning={running === task.id}
                onRun={() => run(task.id)}
                onEdit={() => setEditing(task.id)}
              />
            )
          ))}
        </tbody>
      </table>
      </div>
      </div>
    </div>
  );
}

function EditRow({ task, onSave, onCancel }: { task: TaskStatus; onSave: (ms: number | null) => void; onCancel: () => void }) {
  const t = useT();
  const split = splitInterval(task.intervalMs);
  const [d, setD] = useState(split.days);
  const [h, setH] = useState(split.hours);
  const [m, setM] = useState(split.minutes);

  return (
    <tr className="border-b border-white/5 last:border-0">
      <td className="px-4 py-3 font-semibold text-ink">{t("scheduler.task." + task.id)}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <input value={d} onChange={(e) => setD(Math.max(0, parseInt(e.target.value) || 0))} className="h-7 w-12 rounded-lg border border-white/8 bg-black/30 px-1.5 text-center text-xs text-ink outline-none" />
          <span className="text-xs text-ink-dim">j</span>
          <input value={h} onChange={(e) => setH(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))} className="h-7 w-12 rounded-lg border border-white/8 bg-black/30 px-1.5 text-center text-xs text-ink outline-none" />
          <span className="text-xs text-ink-dim">h</span>
          <input value={m} onChange={(e) => setM(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))} className="h-7 w-12 rounded-lg border border-white/8 bg-black/30 px-1.5 text-center text-xs text-ink outline-none" />
          <span className="text-xs text-ink-dim">min</span>
        </div>
      </td>
      <td className="px-4 py-3 text-ink-dim" colSpan={2}>
        <p className="text-xs text-ink-dim">{formatInterval(parseInterval(d, h, m))}</p>
      </td>
      <td className="px-4 py-3 text-ink-dim" />
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => onSave(parseInterval(d, h, m))} className="flex h-7 w-7 items-center justify-center rounded-lg text-ok hover:bg-white/10">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={onCancel} className="flex h-7 w-7 items-center justify-center rounded-lg text-red hover:bg-white/10">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function TaskRow({ task, localRunning, onRun, onEdit }: { task: TaskStatus; localRunning: boolean; onRun: () => void; onEdit: () => void }) {
  const t = useT();
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
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={onEdit}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-dim hover:bg-white/10 hover:text-ink"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onRun}
            disabled={running}
            className="flex h-8 w-8 items-center justify-center rounded-lg glass-strong text-ink-soft transition-colors hover:text-brand-glow disabled:opacity-50"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCw className="h-3.5 w-3.5" />}
          </button>
        </div>
      </td>
    </tr>
  );
}
