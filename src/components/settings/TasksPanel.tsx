"use client";

import { useEffect, useState, useCallback } from "react";
import { useT, useI18n } from "@/i18n/provider";
import { relativeTime } from "@/lib/utils";
import { useJobRunning } from "@/lib/jobs/useJobRunning";
import { RotateCw, Loader2, Pencil, Check, X, ListTodo, Square } from "lucide-react";
import type { TaskWindow } from "@/lib/scheduler/window";

const DEFAULT_WINDOW: TaskWindow = { startHour: 4, endHour: 6 };
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function formatWindow(w: TaskWindow) {
  return `${w.startHour}h–${w.endHour}h`;
}

/** Case « Limiter à une plage horaire » + deux heures (début inclus, fin exclue). */
function WindowFields({ value, onChange, compact }: { value: TaskWindow | null; onChange: (w: TaskWindow | null) => void; compact?: boolean }) {
  const t = useT();
  const select = `rounded-lg border border-white/8 bg-black/30 px-1.5 text-xs text-ink outline-none ${compact ? "h-8" : "h-7"}`;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-ink-dim">
      <label className="flex items-center gap-1.5">
        <input type="checkbox" checked={value != null} onChange={(e) => onChange(e.target.checked ? DEFAULT_WINDOW : null)} />
        {t("tasks.windowOn")}
      </label>
      {value && (
        <>
          <span>{t("tasks.windowFrom")}</span>
          <select aria-label={t("tasks.windowFrom")} value={value.startHour} onChange={(e) => onChange({ ...value, startHour: Number(e.target.value) })} className={select}>
            {HOURS.map((hr) => <option key={hr} value={hr}>{hr}h</option>)}
          </select>
          <span>{t("tasks.windowTo")}</span>
          <select aria-label={t("tasks.windowTo")} value={value.endHour} onChange={(e) => onChange({ ...value, endHour: Number(e.target.value) })} className={select}>
            {HOURS.map((hr) => <option key={hr} value={hr}>{hr}h</option>)}
          </select>
          {value.startHour === value.endHour && <span className="text-warn">{t("tasks.windowInvalid")}</span>}
        </>
      )}
    </div>
  );
}

interface TaskStatus {
  id: string;
  name: string;
  intervalMs: number;
  /** Plage horaire de démarrage (heure du serveur), ou null. */
  window: TaskWindow | null;
  lastRunAt: number | null;
  lastDurationMs: number | null;
  /** Pire gel du serveur pendant la dernière exécution (ms). */
  lastMaxBlockMs: number | null;
  nextRunAt: number | null;
  heavy: boolean;
  state: "queued" | "running" | "stopping" | null;
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

/** Pire gel : vert sous 0,5 s, orange jusqu'à 2 s, rouge au-delà. */
function formatBlock(ms: number | null): { text: string; tone: string } {
  if (ms == null) return { text: "—", tone: "text-ink-dim" };
  const text = ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
  const tone = ms < 500 ? "text-ok" : ms < 2000 ? "text-warn" : "text-down";
  return { text, tone };
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
  const [timeZone, setTimeZone] = useState("");

  const load = useCallback(() =>
    fetch("/api/tasks", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setTasks(d.tasks ?? []);
        if (typeof d.timeZone === "string") setTimeZone(d.timeZone);
      }),
  []);

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, [load]);

  const stop = async (id: string) => {
    await fetch(`/api/tasks/${id}/stop`, { method: "POST" });
    await load();
  };

  const run = async (id: string) => {
    setRunning(id);
    try {
      await fetch(`/api/tasks/${id}/run`, { method: "POST" });
      await load();
    } finally {
      setRunning(null);
    }
  };

  const saveInterval = async (id: string, intervalMs: number | null, window: TaskWindow | null) => {
    // Une plage invalide (début = fin) n'est pas envoyée : on garde la précédente.
    if (window && window.startHour === window.endHour) return;
    await fetch("/api/tasks", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tasks: [{ id, intervalMs, window }] }),
    });
    setEditing(null);
    await load();
  };

  return (
    <div className="rounded-2xl glass p-5">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
          <ListTodo className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-ink">{t("tasks.title")}</h3>
          <p className="mt-0.5 text-xs text-ink-dim">{t("tasks.hint")}</p>
          {timeZone && <p className="mt-0.5 text-xs text-ink-dim">{t("tasks.windowHint", { tz: timeZone })}</p>}
        </div>
      </div>
      {/* Table on sm+ — a data-dense grid works fine once there's room for
          6 columns. Below that, the columns don't fit no matter how far
          the horizontal scroll goes (confirmed at 375px: headers truncate,
          content clips) — a stacked card per task reads far better there. */}
      <div className="hidden overflow-hidden rounded-2xl glass sm:block">
      <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="sticky top-0 z-10 border-b border-white/8 bg-white/[0.03] backdrop-blur text-left text-xs font-bold uppercase tracking-wide text-ink-dim">
            <th className="px-4 py-3">{t("tasks.name")}</th>
            <th className="px-4 py-3">{t("tasks.interval")}</th>
            <th className="px-4 py-3">{t("tasks.lastRun")}</th>
            <th className="px-4 py-3">{t("tasks.lastDuration")}</th>
            <th className="px-4 py-3">{t("tasks.maxBlock")}</th>
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
                onSave={(ms, win) => saveInterval(task.id, ms, win)}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <TaskRow
                key={task.id}
                task={task}
                localRunning={running === task.id}
                onRun={() => run(task.id)}
                onStop={() => stop(task.id)}
                onEdit={() => setEditing(task.id)}
              />
            )
          ))}
        </tbody>
      </table>
      </div>
      </div>

      <div className="space-y-2 sm:hidden">
        {tasks.map((task) =>
          editing === task.id ? (
            <EditCard
              key={task.id}
              task={task}
              onSave={(ms, win) => saveInterval(task.id, ms, win)}
              onCancel={() => setEditing(null)}
            />
          ) : (
            <TaskCard
              key={task.id}
              task={task}
              localRunning={running === task.id}
              onRun={() => run(task.id)}
              onStop={() => stop(task.id)}
              onEdit={() => setEditing(task.id)}
            />
          )
        )}
      </div>
    </div>
  );
}

function EditRow({ task, onSave, onCancel }: { task: TaskStatus; onSave: (ms: number | null, win: TaskWindow | null) => void; onCancel: () => void }) {
  const t = useT();
  const [win, setWin] = useState<TaskWindow | null>(task.window);
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
      <td className="px-4 py-3 text-ink-dim" colSpan={3}>
        <p className="text-xs text-ink-dim">{formatInterval(parseInterval(d, h, m))}</p>
        <WindowFields value={win} onChange={setWin} />
      </td>
      <td className="px-4 py-3 text-ink-dim" />
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-1">
          <button onClick={() => onSave(parseInterval(d, h, m), win)} aria-label={t("common.save")} className="flex h-7 w-7 items-center justify-center rounded-lg text-ok hover:bg-white/10">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={onCancel} aria-label={t("common.cancel")} className="flex h-7 w-7 items-center justify-center rounded-lg text-down hover:bg-white/10">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function EditCard({ task, onSave, onCancel }: { task: TaskStatus; onSave: (ms: number | null, win: TaskWindow | null) => void; onCancel: () => void }) {
  const t = useT();
  const [win, setWin] = useState<TaskWindow | null>(task.window);
  const split = splitInterval(task.intervalMs);
  const [d, setD] = useState(split.days);
  const [h, setH] = useState(split.hours);
  const [m, setM] = useState(split.minutes);

  return (
    <div className="rounded-xl glass p-3">
      <p className="mb-2 font-semibold text-ink">{t("scheduler.task." + task.id)}</p>
      <div className="flex items-center gap-1.5">
        <input value={d} onChange={(e) => setD(Math.max(0, parseInt(e.target.value) || 0))} className="h-8 w-14 rounded-lg border border-white/8 bg-black/30 px-1.5 text-center text-xs text-ink outline-none" />
        <span className="text-xs text-ink-dim">j</span>
        <input value={h} onChange={(e) => setH(Math.max(0, Math.min(23, parseInt(e.target.value) || 0)))} className="h-8 w-14 rounded-lg border border-white/8 bg-black/30 px-1.5 text-center text-xs text-ink outline-none" />
        <span className="text-xs text-ink-dim">h</span>
        <input value={m} onChange={(e) => setM(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)))} className="h-8 w-14 rounded-lg border border-white/8 bg-black/30 px-1.5 text-center text-xs text-ink outline-none" />
        <span className="text-xs text-ink-dim">min</span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => onSave(parseInterval(d, h, m), win)} aria-label={t("common.save")} className="flex h-8 w-8 items-center justify-center rounded-lg text-ok hover:bg-white/10">
            <Check className="h-3.5 w-3.5" />
          </button>
          <button onClick={onCancel} aria-label={t("common.cancel")} className="flex h-8 w-8 items-center justify-center rounded-lg text-down hover:bg-white/10">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <WindowFields value={win} onChange={setWin} compact />
    </div>
  );
}

function TaskName({ task }: { task: TaskStatus }) {
  const t = useT();
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span>{t("scheduler.task." + task.id)}</span>
      {task.heavy && (
        <span title={t("tasks.heavyHint")} className="rounded-md bg-white/8 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-dim">
          {t("tasks.heavy")}
        </span>
      )}
      {task.state === "queued" && <span className="text-[11px] font-normal text-ink-dim">· {t("tasks.queued")}</span>}
      {task.state === "stopping" && <span className="text-[11px] font-normal text-warn">· {t("tasks.stopping")}</span>}
    </span>
  );
}

/** Lancer maintenant, ou Arrêter quand la tâche est en file ou en cours. */
function RunStopButton({ task, running, onRun, onStop }: { task: TaskStatus; running: boolean; onRun: () => void; onStop: () => void }) {
  const t = useT();
  if (running || task.state != null) {
    const stopping = task.state === "stopping";
    return (
      <button
        onClick={onStop}
        disabled={stopping}
        title={stopping ? t("tasks.stopping") : t("tasks.stop")}
        aria-label={t("tasks.stop")}
        className="group flex h-8 w-8 items-center justify-center rounded-lg glass-strong text-ink-soft transition-colors hover:text-down disabled:opacity-50"
      >
        {stopping ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin group-hover:hidden" />
            <Square className="hidden h-3 w-3 fill-current group-hover:block" />
          </>
        )}
      </button>
    );
  }
  return (
    <button
      onClick={onRun}
      title={t("tasks.runNow")}
      aria-label={t("tasks.runNow")}
      className="flex h-8 w-8 items-center justify-center rounded-lg glass-strong text-ink-soft transition-colors hover:text-brand-glow"
    >
      <RotateCw className="h-3.5 w-3.5" />
    </button>
  );
}

function TaskCard({ task, localRunning, onRun, onStop, onEdit }: { task: TaskStatus; localRunning: boolean; onRun: () => void; onStop: () => void; onEdit: () => void }) {
  const t = useT();
  const { locale } = useI18n();
  const jobRunning = useJobRunning(task.id);
  const running = localRunning || jobRunning;
  const block = formatBlock(task.lastMaxBlockMs);
  const nextRun = task.nextRunAt
    ? (() => {
        const remaining = formatFuture(task.nextRunAt);
        return remaining ? `${t("tasks.in")} ${remaining}` : t("tasks.now");
      })()
    : "—";

  return (
    <div className="rounded-xl glass p-3">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-ink"><TaskName task={task} /></p>
        <div className="flex shrink-0 items-center gap-1">
          <button onClick={onEdit} aria-label={t("tasks.edit")} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-dim hover:bg-white/10 hover:text-ink">
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <RunStopButton task={task} running={running} onRun={onRun} onStop={onStop} />
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-ink-dim">
        <span>{t("tasks.interval")} : {formatInterval(task.intervalMs)}{task.window ? ` · ${formatWindow(task.window)}` : ""}</span>
        <span>{t("tasks.lastDuration")} : {formatDuration(task.lastDurationMs)}</span>
        <span>{t("tasks.lastRun")} : {task.lastRunAt ? relativeTime(new Date(task.lastRunAt).toISOString(), locale) : t("tasks.never")}</span>
        <span>{t("tasks.nextRun")} : {nextRun}</span>
        <span>{t("tasks.maxBlock")} : <span className={block.tone}>{block.text}</span></span>
      </div>
    </div>
  );
}

function TaskRow({ task, localRunning, onRun, onStop, onEdit }: { task: TaskStatus; localRunning: boolean; onRun: () => void; onStop: () => void; onEdit: () => void }) {
  const t = useT();
  const { locale } = useI18n();
  const jobRunning = useJobRunning(task.id);
  const running = localRunning || jobRunning;
  const block = formatBlock(task.lastMaxBlockMs);
  return (
    <tr className="border-b border-white/5 last:border-0">
      <td className="px-4 py-3 font-semibold text-ink"><TaskName task={task} /></td>
      <td className="px-4 py-3 text-ink-soft">
        {formatInterval(task.intervalMs)}
        {task.window && <span className="ml-1.5 text-xs text-ink-dim" title={t("tasks.windowOn")}>· {formatWindow(task.window)}</span>}
      </td>
      <td className="px-4 py-3 text-ink-dim">
        {task.lastRunAt ? relativeTime(new Date(task.lastRunAt).toISOString(), locale) : t("tasks.never")}
      </td>
      <td className="px-4 py-3 text-ink-dim">{formatDuration(task.lastDurationMs)}</td>
      <td className={`px-4 py-3 tabular-nums ${block.tone}`}>{block.text}</td>
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
            aria-label={t("tasks.edit")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-dim hover:bg-white/10 hover:text-ink"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <RunStopButton task={task} running={running} onRun={onRun} onStop={onStop} />
        </div>
      </td>
    </tr>
  );
}
