"use client";

import { useState } from "react";
import { useT } from "@/i18n/provider";
import { RefreshCw, Loader2, Check, AlertTriangle } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { confirmDialog } from "@/components/ui/ConfirmDialog";

interface SyncDetail {
  seriesId: string;
  title: string;
  ok: boolean;
  error?: string;
  oldSeasonCount?: number;
  newSeasonCount?: number;
}

interface SyncResult {
  total: number;
  animeFound: number;
  synced: number;
  skipped: number;
  specialsBackfilled: number;
  details: SyncDetail[];
}

export function TvdbSyncAllPanel() {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResult | { error: string } | null>(null);

  const run = async () => {
    if (!(await confirmDialog(t("tvdbSyncAll.intro"), { tone: "default" }))) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/metadata/tvdb/sync-all", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setResult({ error: data.error === "tvdb_not_configured" ? t("tvdbSyncAll.notConfigured") : data.error });
        setLoading(false);
        return;
      }
      if (!data.jobId) {
        // Another run was already in flight — nothing new to poll for.
        setLoading(false);
        return;
      }
      // A full-library scan (one TMDb fetch per title) runs far longer than
      // a reverse proxy's request timeout — polled through the job queue
      // instead of awaited directly (see the route's own comment).
      pollJob(data.jobId);
    } catch {
      setResult({ error: "network_error" });
      setLoading(false);
    }
  };

  const pollJob = async (jobId: string) => {
    for (;;) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const res = await fetch("/api/jobs", { cache: "no-store" });
        const data = await res.json() as { jobs?: Array<{ id: string; status: string; result?: unknown; error?: string | null }> };
        const job = data.jobs?.find((j) => j.id === jobId);
        if (!job) continue;
        if (job.status === "completed") {
          const r = job.result as SyncResult;
          setResult(r);
          toast("success", t("tvdbSyncAll.summary", { synced: r.synced, animeFound: r.animeFound, total: r.total }));
          setLoading(false);
          return;
        }
        if (job.status === "failed") {
          setResult({ error: job.error ?? "sync_error" });
          setLoading(false);
          return;
        }
      } catch {
        // Transient poll failure — keep trying, the job itself is unaffected.
      }
    }
  };

  return (
    <div className="rounded-2xl glass p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan/12 text-cyan">
          <RefreshCw className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-ink">{t("tvdbSyncAll.title")}</h3>
          <p className="mt-0.5 text-xs text-ink-dim">{t("tvdbSyncAll.intro")}</p>
        </div>
      </div>

      <button
        onClick={run}
        disabled={loading}
        className="flex h-10 items-center gap-2 rounded-xl bg-cyan/15 px-4 text-sm font-semibold text-cyan transition-colors hover:bg-cyan/25 disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
        {loading ? t("tvdbSyncAll.running") : t("tvdbSyncAll.run")}
      </button>

      {result && "error" in result && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-down/10 p-2 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-down" />
          <p className="text-ink-soft">{result.error}</p>
        </div>
      )}

      {result && !("error" in result) && (
        <div className="mt-4 space-y-2 text-sm">
          <p className="font-semibold text-ink-soft">
            {t("tvdbSyncAll.summary", { synced: result.synced, animeFound: result.animeFound, total: result.total })}
          </p>
          {result.specialsBackfilled > 0 && (
            <p className="text-xs text-ink-dim">{t("tvdbSyncAll.specialsBackfilled", { count: result.specialsBackfilled })}</p>
          )}
          {result.animeFound === 0 && (
            <p className="text-xs text-ink-dim">{t("tvdbSyncAll.noAnime")}</p>
          )}
          {result.details.map((d) => (
            <div
              key={d.seriesId}
              className={`flex items-start gap-2 rounded-lg p-2 ${d.ok ? "bg-ok/10" : "bg-white/5"}`}
            >
              {d.ok ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
              ) : (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ink-dim" />
              )}
              <p className="truncate text-ink-soft">
                {d.ok
                  ? d.oldSeasonCount !== d.newSeasonCount
                    ? t("tvdbSyncAll.seasonsChanged", { title: d.title, old: d.oldSeasonCount ?? 0, new: d.newSeasonCount ?? 0 })
                    : t("tvdbSyncAll.titlesRefreshed", { title: d.title })
                  : t("tvdbSyncAll.skipped", { title: d.title, reason: d.error ?? "?" })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
