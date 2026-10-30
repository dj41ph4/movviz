"use client";

import useSWR, { mutate as globalMutate } from "swr";
import { useEffect, useMemo, useState } from "react";
import { useT } from "@/i18n/provider";
import { formatBytes } from "@/lib/utils";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/Toast";
import { FileWarning, Loader2, Check, Search, Trash2, RefreshCw } from "lucide-react";

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

type Action = "delete" | "replace";

const SOURCE_ID = "corrupt-files-scan";
const REPLACE_SOURCE_ID = "corrupt-files-replace";
const keyOf = (i: Item) => `${i.kind}:${i.id}:${i.seasonNumber ?? ""}:${i.episodeNumber ?? ""}`;

/** Réglages > Maintenance — fichiers vides ou incomplets de la bibliothèque.
 *  Le balayage est en lecture seule ; supprimer ou remplacer ne part que d'un
 *  clic confirmé, sur les lignes cochées. */
export function CorruptFilesPanel() {
  const t = useT();
  const { data: jobsData, mutate: mutateJobs } = useSWR<{ jobs: Job[] }>("/api/jobs", { refreshInterval: 2000 });
  const replaceJob = jobsData?.jobs.find((j) => j.sourceId === REPLACE_SOURCE_ID);
  const replaceActive = replaceJob?.status === "queued" || replaceJob?.status === "running";
  const { data: report, mutate: mutateReport } = useSWR<Report>("/api/library/corrupt-files", { refreshInterval: replaceActive ? 4000 : 0 });
  // Lignes en cours de traitement : elles disparaissent tout de suite, sans attendre le serveur.
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState<Action | null>(null);

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

  const items = useMemo(
    () => (report?.items ?? []).filter((i) => !pending.has(keyOf(i)) && (!filter || `${i.title} ${i.path}`.toLowerCase().includes(filter.toLowerCase()))),
    [report, filter, pending]
  );
  const chosen = useMemo(() => (report?.items ?? []).filter((i) => selected.has(keyOf(i)) && !pending.has(keyOf(i))), [report, selected, pending]);
  const allShownSelected = items.length > 0 && items.every((i) => selected.has(keyOf(i)));

  const toggle = (i: Item) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(keyOf(i))) next.add(keyOf(i));
      return next;
    });
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const i of items) {
        if (allShownSelected) next.delete(keyOf(i));
        else next.add(keyOf(i));
      }
      return next;
    });

  const run = async (action: Action) => {
    if (chosen.length === 0 || working) return;
    const ok = await confirmDialog(t(action === "delete" ? "corruptFiles.confirmDelete" : "corruptFiles.confirmReplace", { count: chosen.length }), {
      tone: action === "delete" ? "danger" : "default",
    });
    if (!ok) return;
    setWorking(action);
    const keys = chosen.map(keyOf);
    setPending((prev) => new Set([...prev, ...keys]));
    setSelected(new Set());
    try {
      const res = await fetch("/api/library/corrupt-files/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          items: chosen.map((i) => ({ kind: i.kind, id: i.id, seasonNumber: i.seasonNumber, episodeNumber: i.episodeNumber })),
        }),
      });
      const data = (await res.json().catch(() => null)) as { done?: number; failed?: unknown[]; searchQueued?: boolean } | null;
      if (!res.ok || !data) {
        toast("error", t("corruptFiles.error"));
      } else {
        // Fiches titre, bibliothèque et activité reflètent aussitôt les fichiers retirés.
        void globalMutate((key) => typeof key === "string" && key.startsWith("/api/library/"));
        const failures = (data.failed ?? []) as { error?: string }[];
        const failed = failures.length;
        // Raison la plus fréquente, en clair : « occupé, partagé ou déjà sain » ne disait rien.
        const counts = new Map<string, number>();
        for (const f of failures) counts.set(f.error ?? "unknown", (counts.get(f.error ?? "unknown") ?? 0) + 1);
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        const reasonKey = top ? `corruptFiles.err_${top}` : "";
        const reason = reasonKey && t(reasonKey) !== reasonKey ? t(reasonKey) : top ?? "";
        toast(failed > 0 ? "error" : "success", t(failed > 0 ? "corruptFiles.partial" : action === "replace" && data.searchQueued ? "corruptFiles.replaced" : "corruptFiles.deleted", { count: data.done ?? 0, failed, reason }));
      }
    } finally {
      setWorking(null);
      await Promise.all([mutateReport(), mutateJobs()]);
      setPending((prev) => {
        const next = new Set(prev);
        for (const k of keys) next.delete(k);
        return next;
      });
    }
  };

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

      {replaceActive && (
        <div className="flex items-center gap-2 rounded-xl glass p-3 text-sm text-ink-soft">
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
          {t("corruptFiles.replacing", { current: replaceJob?.current ?? 0, total: replaceJob?.total ?? 0 })}
        </div>
      )}

      {report?.scannedAt && report.items.length === 0 && (
        <div className="flex items-center gap-2 rounded-xl glass p-3 text-sm text-ok">
          <Check className="h-4 w-4 shrink-0" />
          {t("corruptFiles.none")}
        </div>
      )}

      {report && report.items.length > 0 && (
        <div className="space-y-3">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("corruptFiles.filter")}
            className="h-10 w-full rounded-xl glass px-3 text-sm text-ink placeholder:text-ink-dim"
          />

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl glass px-3 text-sm font-semibold text-ink-soft">
              <input type="checkbox" checked={allShownSelected} onChange={toggleAll} className="h-4 w-4 accent-[var(--brand,#8b5cf6)]" />
              {t("corruptFiles.selectAll")}
            </label>
            <span className="text-xs text-ink-dim">{t("corruptFiles.selected", { count: chosen.length })}</span>
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                onClick={() => run("delete")}
                disabled={chosen.length === 0 || !!working}
                className="flex h-10 items-center gap-2 rounded-xl glass px-4 text-sm font-semibold text-down transition-colors hover:bg-down/10 disabled:opacity-50"
              >
                {working === "delete" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {t("corruptFiles.delete")}
              </button>
              <button
                onClick={() => run("replace")}
                disabled={chosen.length === 0 || !!working}
                className="flex h-10 items-center gap-2 rounded-xl brand-gradient px-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {working === "replace" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {t("corruptFiles.replace")}
              </button>
            </div>
          </div>

          <ul className="max-h-[28rem] divide-y divide-white/8 overflow-y-auto rounded-xl glass-strong">
            {items.map((i) => (
              <li key={keyOf(i)}>
                <label className="flex cursor-pointer items-start gap-3 p-3">
                  <input
                    type="checkbox"
                    checked={selected.has(keyOf(i))}
                    onChange={() => toggle(i)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand,#8b5cf6)]"
                  />
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink">{label(i)}</span>
                      <span className="rounded-full bg-down/12 px-2 py-0.5 text-[11px] font-semibold text-down">
                        {t(`corruptFiles.reason.${i.reason}`)}
                        {i.reason === "partial" ? ` · ${Math.round(i.zeroRatio * 100)} %` : ""}
                      </span>
                    </span>
                    <span className="block break-all text-xs text-ink-dim">{i.path}</span>
                    <span className="block text-xs text-ink-dim">{formatBytes(i.size)}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
