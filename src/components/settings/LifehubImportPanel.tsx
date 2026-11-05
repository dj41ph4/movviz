"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useT } from "@/i18n/provider";
import { toast } from "@/components/ui/Toast";
import { Upload, Loader2, Check, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

const POLL_MS = 1500;

interface LifehubImportResult {
  totalRows: number;
  moviesMatched: number;
  episodesMatched: number;
  unmatched: string[];
}
interface LifehubImportJob {
  status: "running" | "done" | "error";
  current: number;
  total: number;
  result?: LifehubImportResult;
  error?: string;
}

/**
 * LifeHub → Movviz (demande explicite user). Same behavior as
 * NetflixImportPanel: each user imports their own LifeHub JSON export, it is
 * processed by a server-side background job keyed by user id and only marks
 * titles watched for that user.
 */
export function LifehubImportPanel() {
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [json, setJson] = useState<string | null>(null);
  const [job, setJob] = useState<LifehubImportJob | null>(null);
  const [starting, setStarting] = useState(false);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const notifiedRef = useRef(false);

  const poll = useCallback(async () => {
    try {
      const r = await fetch("/api/lifehub/import", { cache: "no-store" });
      if (!r.ok) return;
      const data: { job: LifehubImportJob | null } = await r.json();
      setJob(data.job);
    } catch { /* keep last known state, try again next tick */ }
  }, []);

  useEffect(() => {
    poll();
    const timer = setInterval(() => {
      setJob((current) => {
        if (current?.status === "running" || current === null) poll();
        return current;
      });
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [poll]);

  useEffect(() => {
    if (!job || job.status === "running" || notifiedRef.current) return;
    notifiedRef.current = true;
    if (job.status === "done" && job.result) {
      toast("success", t("settings.lifehub.importDone", { movies: String(job.result.moviesMatched), episodes: String(job.result.episodesMatched) }));
    } else if (job.status === "error") {
      toast("error", t("settings.lifehub.importFailed"));
    }
  }, [job, t]);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setJson(await file.text());
  };

  const runImport = async () => {
    if (!json || starting || job?.status === "running") return;
    setStarting(true);
    notifiedRef.current = false;
    try {
      const r = await fetch("/api/lifehub/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ json }),
      });
      if (r.ok) {
        poll();
      } else if (r.status === 409) {
        toast("error", t("settings.lifehub.alreadyRunning"));
      } else if (r.status === 400) {
        toast("error", t("settings.lifehub.invalidFile"));
      } else {
        toast("error", t("settings.lifehub.importFailed"));
      }
    } catch {
      toast("error", t("settings.lifehub.importFailed"));
    } finally {
      setStarting(false);
    }
  };

  const running = job?.status === "running";
  const result = job?.status === "done" ? job.result : null;

  return (
    <div>
      <div>
        <h2 className="text-lg font-bold text-ink">{t("settings.lifehub.title")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-dim">{t("settings.lifehub.description")}</p>
      </div>

      <div className="mt-5 rounded-xl border border-white/8 bg-black/20 p-4">
        <p className="mb-3 text-xs text-ink-dim">{t("settings.lifehub.howTo")}</p>

        <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={onFileChange} className="hidden" disabled={running} />

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={running}
            className="glass-strong flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
          >
            <Upload className="h-4 w-4" />
            {fileName ?? t("settings.lifehub.chooseFile")}
          </button>
          <button
            onClick={runImport}
            disabled={!json || starting || running}
            className="brand-gradient flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-bold text-white disabled:opacity-40"
          >
            {(starting || running) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {running
              ? t("settings.lifehub.importProgress", { current: String(job.current), total: String(Math.max(job.total, job.current)) })
              : t("settings.lifehub.import")}
          </button>
        </div>

        {running && (
          <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full brand-gradient transition-all"
              style={{ width: `${job.total > 0 ? Math.min(100, (job.current / job.total) * 100) : 5}%` }}
            />
          </div>
        )}

        {job?.status === "error" && (
          <p className="mt-3 rounded-lg bg-down/10 px-3 py-2 text-xs text-down">{job.error ?? t("settings.lifehub.importFailed")}</p>
        )}

        {result && (
          <div className="mt-4 space-y-2 border-t border-white/8 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-ok/30 bg-ok/12 px-2.5 py-0.5 text-[11px] font-bold text-ok">
                <Check className="h-3 w-3" /> {t("settings.lifehub.moviesMatched", { count: String(result.moviesMatched) })}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-ok/30 bg-ok/12 px-2.5 py-0.5 text-[11px] font-bold text-ok">
                <Check className="h-3 w-3" /> {t("settings.lifehub.episodesMatched", { count: String(result.episodesMatched) })}
              </span>
              {result.unmatched.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber/30 bg-amber/12 px-2.5 py-0.5 text-[11px] font-bold text-amber">
                  <AlertTriangle className="h-3 w-3" /> {t("settings.lifehub.unmatchedCount", { count: String(result.unmatched.length) })}
                </span>
              )}
            </div>

            {result.unmatched.length > 0 && (
              <div>
                <button
                  onClick={() => setShowUnmatched((o) => !o)}
                  className="flex items-center gap-1 text-xs font-semibold text-ink-soft hover:text-ink"
                >
                  {showUnmatched ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {t("settings.lifehub.showUnmatched")}
                </button>
                {showUnmatched && (
                  <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto rounded-lg bg-white/4 p-2 text-xs text-ink-dim">
                    {result.unmatched.map((title, i) => (
                      <li key={i} className="break-words">{title}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
