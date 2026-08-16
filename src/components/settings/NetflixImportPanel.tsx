"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useT } from "@/i18n/provider";
import { toast } from "@/components/ui/Toast";
import { Upload, Loader2, Check, AlertTriangle, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

// Netflix's own "download your viewing activity" page — plain URL, no
// translation needed (same pattern as AiSettingsPanel's provider key links).
const NETFLIX_ACTIVITY_URL = "https://www.netflix.com/viewingactivity";

const POLL_MS = 1500;

interface NetflixImportResult {
  totalRows: number;
  moviesMatched: number;
  episodesMatched: number;
  unmatched: string[];
}
interface NetflixImportJob {
  status: "running" | "done" | "error";
  current: number;
  total: number;
  result?: NetflixImportResult;
  error?: string;
}

/**
 * Netflix → Movviz (demande explicite user). Netflix has no public API for
 * viewing history — the only legitimate way in is the CSV each user
 * downloads themselves from their own Netflix account. Strictly per-user,
 * non-admin (every Movviz account configures its own history).
 *
 * The import itself runs as a BACKGROUND job on the server (demande
 * explicite user: a real Netflix history can run to thousands of rows, far
 * too slow for one HTTP request — see src/lib/netflix/importJobs.ts) — this
 * component only starts it then polls GET /api/netflix/import for
 * progress, keyed by user id server-side. That polling resumes correctly
 * even after navigating away and back (or a full reload) mid-import, since
 * nothing about progress lives in this component's own state until the
 * first poll response arrives.
 */
export function NetflixImportPanel() {
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [job, setJob] = useState<NetflixImportJob | null>(null);
  const [starting, setStarting] = useState(false);
  const [showUnmatched, setShowUnmatched] = useState(false);
  const notifiedRef = useRef(false);

  const poll = useCallback(async () => {
    try {
      const r = await fetch("/api/netflix/import", { cache: "no-store" });
      if (!r.ok) return;
      const data: { job: NetflixImportJob | null } = await r.json();
      setJob(data.job);
    } catch { /* keep last known state, try again next tick */ }
  }, []);

  // Resume-on-mount + poll while a job is running, stop once settled.
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
      toast("success", t("settings.netflix.importDone", { movies: String(job.result.moviesMatched), episodes: String(job.result.episodesMatched) }));
    } else if (job.status === "error") {
      toast("error", t("settings.netflix.importFailed"));
    }
  }, [job, t]);

  const pickFile = () => fileInputRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setCsv(await file.text());
  };

  const runImport = async () => {
    if (!csv || starting || job?.status === "running") return;
    setStarting(true);
    notifiedRef.current = false;
    try {
      const r = await fetch("/api/netflix/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      if (r.ok) {
        poll();
      } else if (r.status === 409) {
        toast("error", t("settings.netflix.alreadyRunning"));
      } else {
        toast("error", t("settings.netflix.importFailed"));
      }
    } catch {
      toast("error", t("settings.netflix.importFailed"));
    } finally {
      setStarting(false);
    }
  };

  const running = job?.status === "running";
  const result = job?.status === "done" ? job.result : null;

  return (
    <div>
      <div>
        <h2 className="text-lg font-bold text-ink">{t("settings.netflix.title")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-dim">{t("settings.netflix.description")}</p>
      </div>

      <div className="mt-5 rounded-xl border border-white/8 bg-black/20 p-4">
        <p className="mb-2 text-xs text-ink-dim">{t("settings.netflix.howTo")}</p>
        <a
          href={NETFLIX_ACTIVITY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-glow hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          {NETFLIX_ACTIVITY_URL.replace(/^https?:\/\//, "")}
        </a>

        <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={onFileChange} className="hidden" disabled={running} />

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={pickFile}
            disabled={running}
            className="glass-strong flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold text-ink-soft transition-colors hover:text-ink disabled:opacity-40"
          >
            <Upload className="h-4 w-4" />
            {fileName ?? t("settings.netflix.chooseFile")}
          </button>
          <button
            onClick={runImport}
            disabled={!csv || starting || running}
            className="brand-gradient flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-bold text-white disabled:opacity-40"
          >
            {(starting || running) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {running
              ? t("settings.netflix.importProgress", { current: String(job.current), total: String(Math.max(job.total, job.current)) })
              : t("settings.netflix.import")}
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
          <p className="mt-3 rounded-lg bg-down/10 px-3 py-2 text-xs text-down">{job.error ?? t("settings.netflix.importFailed")}</p>
        )}

        {result && (
          <div className="mt-4 space-y-2 border-t border-white/8 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-ok/30 bg-ok/12 px-2.5 py-0.5 text-[11px] font-bold text-ok">
                <Check className="h-3 w-3" /> {t("settings.netflix.moviesMatched", { count: String(result.moviesMatched) })}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-ok/30 bg-ok/12 px-2.5 py-0.5 text-[11px] font-bold text-ok">
                <Check className="h-3 w-3" /> {t("settings.netflix.episodesMatched", { count: String(result.episodesMatched) })}
              </span>
              {result.unmatched.length > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber/30 bg-amber/12 px-2.5 py-0.5 text-[11px] font-bold text-amber">
                  <AlertTriangle className="h-3 w-3" /> {t("settings.netflix.unmatchedCount", { count: String(result.unmatched.length) })}
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
                  {t("settings.netflix.showUnmatched")}
                </button>
                {showUnmatched && (
                  <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto rounded-lg bg-white/4 p-2 text-xs text-ink-dim">
                    {result.unmatched.map((title, i) => (
                      <li key={i} className="truncate">{title}</li>
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
