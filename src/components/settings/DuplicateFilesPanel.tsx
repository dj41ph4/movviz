"use client";

import useSWR, { mutate as globalMutate } from "swr";
import { useEffect, useMemo, useState } from "react";
import { useT } from "@/i18n/provider";
import { formatBytes } from "@/lib/utils";
import { confirmDialog } from "@/components/ui/ConfirmDialog";
import { toast } from "@/components/ui/Toast";
import { Copy, Loader2, Check, Search, Trash2 } from "lucide-react";

interface Job {
  id: string;
  sourceId?: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  current: number;
  total: number;
}

type State = "duplicate" | "no_original" | "in_use" | "recent";

interface Item {
  path: string;
  name: string;
  size: number;
  state: State;
  originalSize: number | null;
}

interface Report {
  scannedAt: number | null;
  checked: number;
  items: Item[];
}

const SOURCE_ID = "duplicate-files-scan";
/** Seuls ces états peuvent être supprimés : un fichier utilisé ou récent n'a pas de case. */
const selectable = (i: Item) => i.state === "duplicate" || i.state === "no_original";
const badgeClass: Record<State, string> = {
  duplicate: "bg-down/12 text-down",
  no_original: "bg-amber/15 text-amber-100",
  in_use: "bg-white/10 text-ink-soft",
  recent: "bg-white/10 text-ink-soft",
};

/** Réglages > Maintenance — doublons « (2) », « (3)… » laissés dans la bibliothèque.
 *  Le balayage est en lecture seule ; la suppression ne part que d'un clic confirmé,
 *  sur les lignes cochées, et le serveur revérifie chaque fichier avant de l'effacer. */
export function DuplicateFilesPanel() {
  const t = useT();
  const { data: jobsData, mutate: mutateJobs } = useSWR<{ jobs: Job[] }>("/api/jobs", { refreshInterval: 2000 });
  const { data: report, mutate: mutateReport } = useSWR<Report>("/api/library/duplicate-files");
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [starting, setStarting] = useState(false);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [working, setWorking] = useState(false);

  const job = jobsData?.jobs.find((j) => j.sourceId === SOURCE_ID);
  const active = job?.status === "queued" || job?.status === "running";
  const running = starting || active;

  const start = async () => {
    setStarting(true);
    try {
      await fetch("/api/library/duplicate-files", { method: "POST" });
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

  const all = useMemo(() => (report?.items ?? []).filter((i) => !pending.has(i.path)), [report, pending]);
  const items = useMemo(
    () => all.filter((i) => !filter || `${i.name} ${i.path}`.toLowerCase().includes(filter.toLowerCase())),
    [all, filter]
  );
  const shownSelectable = items.filter(selectable);
  const chosen = useMemo(() => all.filter((i) => selected.has(i.path) && selectable(i)), [all, selected]);
  const chosenBytes = chosen.reduce((sum, i) => sum + i.size, 0);
  const withoutOriginal = chosen.filter((i) => i.state === "no_original").length;
  const allShownSelected = shownSelectable.length > 0 && shownSelectable.every((i) => selected.has(i.path));
  const reclaimable = all.filter((i) => i.state === "duplicate").reduce((sum, i) => sum + i.size, 0);

  const toggle = (i: Item) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (!next.delete(i.path)) next.add(i.path);
      return next;
    });
  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const i of shownSelectable) {
        if (allShownSelected) next.delete(i.path);
        else next.add(i.path);
      }
      return next;
    });

  const run = async () => {
    if (chosen.length === 0 || working) return;
    const ok = await confirmDialog(
      t(withoutOriginal > 0 ? "duplicateFiles.confirmDeleteNoOriginal" : "duplicateFiles.confirmDelete", {
        count: chosen.length,
        size: formatBytes(chosenBytes),
        noOriginal: withoutOriginal,
      }),
      { tone: "danger" }
    );
    if (!ok) return;
    setWorking(true);
    const paths = chosen.map((i) => i.path);
    setPending((prev) => new Set([...prev, ...paths]));
    setSelected(new Set());
    try {
      const res = await fetch("/api/library/duplicate-files/resolve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paths }),
      });
      const data = (await res.json().catch(() => null)) as { done?: number; failed?: { error?: string }[]; freedBytes?: number } | null;
      if (!res.ok || !data) {
        toast("error", t("duplicateFiles.error"));
      } else {
        void globalMutate((key) => typeof key === "string" && key.startsWith("/api/library/"));
        const failures = data.failed ?? [];
        const counts = new Map<string, number>();
        for (const f of failures) counts.set(f.error ?? "unknown", (counts.get(f.error ?? "unknown") ?? 0) + 1);
        const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        const reasonKey = top ? `duplicateFiles.err_${top}` : "";
        const reason = reasonKey && t(reasonKey) !== reasonKey ? t(reasonKey) : top ?? "";
        toast(failures.length > 0 ? "error" : "success", t(failures.length > 0 ? "duplicateFiles.partial" : "duplicateFiles.deleted", {
          count: data.done ?? 0,
          failed: failures.length,
          reason,
          size: formatBytes(data.freedBytes ?? 0),
        }));
      }
    } finally {
      setWorking(false);
      await Promise.all([mutateReport(), mutateJobs()]);
      setPending((prev) => {
        const next = new Set(prev);
        for (const p of paths) next.delete(p);
        return next;
      });
    }
  };

  return (
    <div className="space-y-4 rounded-2xl glass p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
          <Copy className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-ink">{t("duplicateFiles.title")}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-dim">{t("duplicateFiles.intro")}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={start}
          disabled={running}
          className="flex h-10 items-center gap-2 rounded-xl brand-gradient px-4 text-sm font-bold text-white disabled:opacity-60"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {running && job && job.total > 1 ? `${job.current} / ${job.total}` : running ? t("duplicateFiles.scanning") : t("duplicateFiles.scan")}
        </button>
        {report?.scannedAt && (
          <span className="text-xs text-ink-dim">
            {t("duplicateFiles.summary", { checked: report.checked, count: report.items.length, date: new Date(report.scannedAt).toLocaleString() })}
          </span>
        )}
      </div>

      {report?.scannedAt && all.length === 0 && (
        <div className="flex items-center gap-2 rounded-xl glass p-3 text-sm text-ok">
          <Check className="h-4 w-4 shrink-0" />
          {t("duplicateFiles.none")}
        </div>
      )}

      {all.length > 0 && (
        <div className="space-y-3">
          {reclaimable > 0 && <p className="text-xs font-semibold text-ink-soft">{t("duplicateFiles.reclaimable", { size: formatBytes(reclaimable) })}</p>}
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={t("duplicateFiles.filter")}
            className="h-10 w-full rounded-xl glass px-3 text-sm text-ink placeholder:text-ink-dim"
          />

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex h-10 cursor-pointer items-center gap-2 rounded-xl glass px-3 text-sm font-semibold text-ink-soft">
              <input type="checkbox" checked={allShownSelected} onChange={toggleAll} disabled={shownSelectable.length === 0} className="h-4 w-4 accent-[var(--brand,#8b5cf6)]" />
              {t("duplicateFiles.selectAll")}
            </label>
            <span className="text-xs text-ink-dim">{t("duplicateFiles.selected", { count: chosen.length })}</span>
            <button
              onClick={run}
              disabled={chosen.length === 0 || working}
              className="ml-auto flex h-10 items-center gap-2 rounded-xl glass px-4 text-sm font-semibold text-down transition-colors hover:bg-down/10 disabled:opacity-50"
            >
              {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
              {t("duplicateFiles.delete")}
            </button>
          </div>

          <ul className="max-h-[28rem] divide-y divide-white/8 overflow-y-auto rounded-xl glass-strong">
            {items.map((i) => (
              <li key={i.path}>
                <label className={`flex items-start gap-3 p-3 ${selectable(i) ? "cursor-pointer" : "opacity-70"}`}>
                  <input
                    type="checkbox"
                    checked={selected.has(i.path)}
                    onChange={() => toggle(i)}
                    disabled={!selectable(i)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand,#8b5cf6)]"
                  />
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className="flex flex-wrap items-center justify-between gap-2">
                      <span className="break-all text-sm font-semibold text-ink">{i.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${badgeClass[i.state]}`}>{t(`duplicateFiles.state.${i.state}`)}</span>
                    </span>
                    <span className="block break-all text-xs text-ink-dim">{i.path}</span>
                    <span className="block text-xs text-ink-dim">
                      {formatBytes(i.size)}
                      {i.originalSize !== null ? ` · ${t("duplicateFiles.original", { size: formatBytes(i.originalSize) })}` : ""}
                    </span>
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
