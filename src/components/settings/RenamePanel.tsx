"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useI18n } from "@/i18n/provider";
import { LOCALES, type Locale } from "@/i18n/config";
import {
  Film, Tv, Loader2, Check, X, ArrowRight, AlertTriangle,
  RefreshCw, Search, Bug, ShieldAlert,
} from "lucide-react";

interface RenameCandidate {
  id: string;
  type: "movie" | "series";
  title: string;
  year: number | null;
  translatedTitle: string | null;
  currentFolder: string;
  expectedFolder: string;
  currentPath: string;
  expectedPath: string;
  affectedItems: number;
}

interface ExecuteResponse {
  results: { success: boolean; id: string; type: string; title: string; error?: string; skipped?: boolean }[];
  plexRefreshed: boolean;
}

interface JobStatus { id: string; status: string; current: number; total: number; error: string | null }

interface ScanStatus {
  running: boolean;
  job: JobStatus | null;
  candidates: RenameCandidate[];
  language: string;
  log: string[];
  execute: {
    running: boolean;
    job: JobStatus | null;
    log: string[];
    result: ExecuteResponse | null;
  };
}

const LOCALE_TMDB: Record<string, string> = {
  fr: "fr-FR", en: "en-US", it: "it-IT", nl: "nl-NL", de: "de-DE",
};

export function RenamePanel() {
  const { locale, t } = useI18n();
  const [language, setLanguage] = useState(locale);
  const [candidates, setCandidates] = useState<RenameCandidate[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [executing, setExecuting] = useState(false);
  const [results, setResults] = useState<ExecuteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const logEndRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [execProgress, setExecProgress] = useState<{ current: number; total: number } | null>(null);
  const [execLogs, setExecLogs] = useState<string[]>([]);
  const [showExecLogs, setShowExecLogs] = useState(false);
  const execLogEndRef = useRef<HTMLDivElement>(null);
  const execPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [cleanDirs, setCleanDirs] = useState(true);
  const [cleanupResult, setCleanupResult] = useState<{ deleted: number } | null>(null);
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => {
    if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [logs]);
  useEffect(() => {
    if (execLogEndRef.current) execLogEndRef.current.scrollIntoView({ behavior: "smooth" });
  }, [execLogs]);

  // Poll scan status while running
  useEffect(() => {
    if (!running) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    const poll = async () => {
      try {
        const res = await fetch("/api/library/rename", { cache: "no-store" });
        if (!res.ok) return;
        const data: ScanStatus = await res.json();
        setProgress({ current: data.job?.current ?? 0, total: data.job?.total ?? 0 });
        if (data.log?.length) setLogs(data.log);

        if (data.job?.status === "completed") {
          setRunning(false);
          setCandidates(data.candidates);
          if (data.candidates.length > 0) {
            setSelected(new Set(data.candidates.map((c) => c.id)));
          }
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        } else if (data.job?.status === "failed") {
          setRunning(false);
          setError(data.job.error ?? "Scan failed");
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        }
      } catch { /* ignore polling errors */ }
    };
    poll();
    pollRef.current = setInterval(poll, 1500);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [running]);

  // Apply the completed execute job's results: drop successes/skips (already correct or just renamed) from the pending list, keep only what still needs attention.
  const applyExecuteResult = useCallback((result: ExecuteResponse) => {
    setResults(result);
    const resolvedIds = new Set(result.results.filter((r) => r.success || r.skipped).map((r) => r.id));
    setCandidates((prev) => {
      if (!prev) return prev;
      const remaining = prev.filter((c) => !resolvedIds.has(c.id));
      return remaining.length > 0 ? remaining : null;
    });
    setSelected((prev) => {
      const next = new Set(prev);
      resolvedIds.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  // After an apply completes, optionally clean up empty dirs left behind by renames.
  useEffect(() => {
    if (!results || !cleanDirs || cleaning) return;
    let cancelled = false;
    (async () => {
      setCleaning(true);
      try {
        const scanRes = await fetch("/api/library/clean-dirs", { cache: "no-store" });
        if (!scanRes.ok) return;
        const { emptyDirs } = await scanRes.json() as { emptyDirs: string[] };
        if (emptyDirs.length === 0 || cancelled) return;
        const delRes = await fetch("/api/library/clean-dirs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ paths: emptyDirs }),
        });
        if (delRes.ok) {
          const data = await delRes.json() as { deleted: number };
          if (!cancelled) setCleanupResult(data);
        }
      } catch {
        // silent — cleanup is best-effort
      } finally {
        if (!cancelled) setCleaning(false);
      }
    })();
    return () => { cancelled = true; };
  }, [results, cleanDirs, cleaning]);

  // Poll execute status while an apply is running
  useEffect(() => {
    if (!executing) {
      if (execPollRef.current) { clearInterval(execPollRef.current); execPollRef.current = null; }
      return;
    }
    const poll = async () => {
      try {
        const res = await fetch("/api/library/rename", { cache: "no-store" });
        if (!res.ok) return;
        const data: ScanStatus = await res.json();
        setExecProgress({ current: data.execute.job?.current ?? 0, total: data.execute.job?.total ?? 0 });
        if (data.execute.log?.length) setExecLogs(data.execute.log);

        if (data.execute.job?.status === "completed") {
          setExecuting(false);
          if (data.execute.result) applyExecuteResult(data.execute.result);
          if (execPollRef.current) { clearInterval(execPollRef.current); execPollRef.current = null; }
        } else if (data.execute.job?.status === "failed") {
          setExecuting(false);
          setError(data.execute.job.error ?? "Execute failed");
          if (execPollRef.current) { clearInterval(execPollRef.current); execPollRef.current = null; }
        }
      } catch { /* ignore polling errors */ }
    };
    poll();
    execPollRef.current = setInterval(poll, 1500);
    return () => { if (execPollRef.current) { clearInterval(execPollRef.current); execPollRef.current = null; } };
  }, [executing, applyExecuteResult]);

  // Check for an active scan or apply on mount — both are background jobs and survive a page reload
  useEffect(() => {
    fetch("/api/library/rename", { cache: "no-store" })
      .then((r) => r.json() as Promise<ScanStatus>)
      .then((data) => {
        if (data.running) {
          setRunning(true);
          setLogs(data.log ?? []);
        } else if (data.job?.status === "completed" && data.candidates.length > 0) {
          setCandidates(data.candidates);
          setLogs(data.log ?? []);
          if (data.language) setLanguage(data.language as Locale);
          if (data.candidates.length > 0) {
            setSelected(new Set(data.candidates.map((c) => c.id)));
          }
        }
        if (data.execute.running) {
          setExecuting(true);
          setExecLogs(data.execute.log ?? []);
        }
      })
      .catch(() => {});
  }, []);

  const doScan = useCallback(async () => {
    setError(null);
    setResults(null);
    setCandidates(null);
    setSelected(new Set());
    setProgress(null);
    setLogs([]);

    try {
      const res = await fetch("/api/library/rename", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "scan", language: LOCALE_TMDB[language] ?? "fr-FR" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error ?? "Scan failed");
        return;
      }
      setRunning(true);
    } catch (e: any) {
      setError(e.message ?? "Network error");
    }
  }, [language]);

  const toggleAll = useCallback(() => {
    if (!candidates) return;
    setSelected((prev) =>
      prev.size === candidates.length
        ? new Set()
        : new Set(candidates.map((c) => c.id))
    );
  }, [candidates]);

  const toggleType = useCallback((type: "movie" | "series") => {
    if (!candidates) return;
    const ids = candidates.filter((c) => c.type === type).map((c) => c.id);
    setSelected((prev) => {
      const allIn = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      ids.forEach((id) => allIn ? next.delete(id) : next.add(id));
      return next;
    });
  }, [candidates]);

  const toggleOne = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const doExecute = useCallback(async () => {
    if (!candidates) return;
    const selections = candidates
      .filter((c) => selected.has(c.id))
      .map((c) => ({ id: c.id, type: c.type }));
    if (selections.length === 0) return;
    setError(null);
    setResults(null);
    setExecProgress(null);
    setExecLogs([]);
    try {
      const res = await fetch("/api/library/rename", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "execute", selections, language: LOCALE_TMDB[language] ?? "fr-FR" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error ?? "Execute failed");
        return;
      }
      setExecuting(true);
    } catch (e: any) {
      setError(e.message ?? "Network error");
    }
  }, [candidates, selected, language]);

  const pct = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;
  const execPct = execProgress && execProgress.total > 0
    ? Math.round((execProgress.current / execProgress.total) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-2xl border border-down/25 bg-down/8 p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-down" />
        <div>
          <p className="text-sm font-bold text-down">{t("settings.diskWarningTitle")}</p>
          <p className="mt-1 text-xs text-ink-dim">{t("settings.diskWarningHint")}</p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-brand/25 bg-brand/8 p-4">
        <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-brand-glow" />
        <div className="flex-1">
          <p className="text-sm font-bold text-ink">{t("rename.title")}</p>
          <p className="mt-1 text-xs text-ink-dim">{t("rename.intro")}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-ink-soft">{t("rename.languageLabel")}</label>
        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value as Locale)}
          className="h-9 rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40"
          disabled={running || executing}
        >
          {LOCALES.map((l) => (
            <option key={l} value={l}>{l.toUpperCase()}</option>
          ))}
        </select>
        <button
          onClick={doScan}
          disabled={running || executing}
          className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm ring-focus hover:bg-brand-glow disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          {running ? t("rename.scanning") : t("rename.scan")}
        </button>
      </div>

      <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-dim">
        <input
          type="checkbox"
          checked={cleanDirs}
          onChange={(e) => setCleanDirs(e.target.checked)}
          disabled={running || executing}
          className="h-4 w-4 rounded border-white/20 bg-white/5 text-brand ring-focus focus:ring-2 disabled:opacity-30"
        />
        {t("rename.cleanEmptyDirs")}
      </label>

      {progress && (
        <div className="space-y-2 rounded-2xl glass p-4">
          <div className="flex items-center justify-between text-xs text-ink-dim">
            <span>{progress.current} / {progress.total}</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-brand transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {(running || logs.length > 0) && (
        <div>
          <button
            onClick={() => setShowLogs(!showLogs)}
            className="flex items-center gap-1.5 text-xs font-semibold text-ink-dim hover:text-ink transition-colors"
          >
            <Bug className="h-3.5 w-3.5" />
            {showLogs ? t("rename.hideLogs") : t("rename.showLogs", { count: logs.length })}
          </button>
          {showLogs && (
            <div className="mt-2 max-h-48 overflow-y-auto rounded-xl bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-ink-dim">
              {logs.length === 0 && (
                <span className="italic text-ink-dim/50">{t("rename.logsEmpty")}</span>
              )}
              {logs.map((line, i) => (
                <div key={i} className={`${line.includes("ERREUR") ? "text-down" : line.includes("→") ? "text-ok" : ""}`}>
                  {line}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-down/25 bg-down/8 p-4 text-sm text-down">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div>
            <p className="font-semibold">{t("rename.errorTitle")}</p>
            <p className="mt-0.5 text-xs opacity-80">{error}</p>
          </div>
        </div>
      )}

      {(executing || execProgress) && (
        <div className="space-y-2 rounded-2xl glass p-4">
          <div className="flex items-center justify-between text-xs text-ink-dim">
            <span>{execProgress?.current ?? 0} / {execProgress?.total ?? 0}</span>
            <span>{execPct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-brand transition-all duration-300"
              style={{ width: `${execPct}%` }}
            />
          </div>
        </div>
      )}

      {(executing || execLogs.length > 0) && (
        <div>
          <button
            onClick={() => setShowExecLogs(!showExecLogs)}
            className="flex items-center gap-1.5 text-xs font-semibold text-ink-dim hover:text-ink transition-colors"
          >
            <Bug className="h-3.5 w-3.5" />
            {showExecLogs ? t("rename.hideLogs") : t("rename.showLogs", { count: execLogs.length })}
          </button>
          {showExecLogs && (
            <div className="mt-2 max-h-48 overflow-y-auto rounded-xl bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-ink-dim">
              {execLogs.length === 0 && (
                <span className="italic text-ink-dim/50">{t("rename.logsEmpty")}</span>
              )}
              {execLogs.map((line, i) => (
                <div key={i} className={`${line.includes("ERROR") || line.includes("ERREUR") ? "text-down" : line.includes("WARN") || line.includes("PARTIAL") ? "text-amber" : line.includes("DONE") || line.includes("SUMMARY") ? "text-ok" : ""}`}>
                  {line}
                </div>
              ))}
              <div ref={execLogEndRef} />
            </div>
          )}
        </div>
      )}

      {results && (
        <div className="rounded-2xl glass-strong p-4 text-sm">
          {results.results.filter((r) => r.success).length > 0 && (
            <div className="flex items-center gap-2 text-ok">
              <Check className="h-4 w-4" />
              {t("rename.successCount", { count: results.results.filter((r) => r.success).length })}
            </div>
          )}
          {results.results.filter((r) => !r.success && !r.skipped).length > 0 && (
            <>
              <div className="mt-1 flex items-center gap-2 text-down">
                <X className="h-4 w-4" />
                {t("rename.failCount", { count: results.results.filter((r) => !r.success && !r.skipped).length })}
              </div>
              <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-xl bg-black/30 p-2.5 text-xs">
                {results.results.filter((r) => !r.success && !r.skipped).map((r, i) => (
                  <li key={`${r.id}-${i}`} className="text-ink-dim">
                    <span className="font-semibold text-ink-soft">{r.title || r.id}</span>
                    {r.error ? ` — ${r.error}` : ""}
                  </li>
                ))}
              </ul>
            </>
          )}
          {results.plexRefreshed && (
            <div className="mt-1 flex items-center gap-2 text-ink-soft">
              <RefreshCw className="h-4 w-4" />
              {t("rename.plexRefreshed")}
            </div>
          )}
          {cleaning && (
            <div className="mt-1 flex items-center gap-2 text-ink-soft">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("cleanDirs.deleting")}
            </div>
          )}
          {cleanupResult && cleanupResult.deleted > 0 && (
            <div className="mt-1 flex items-center gap-2 text-ok">
              <Check className="h-4 w-4" />
              {t("cleanDirs.deletedCount", { count: cleanupResult.deleted })}
            </div>
          )}
          {cleanupResult && cleanupResult.deleted === 0 && (
            <div className="mt-1 flex items-center gap-2 text-ink-soft">
              <Check className="h-4 w-4" />
              {t("cleanDirs.clean")}
            </div>
          )}
        </div>
      )}

      {candidates && candidates.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <SelBtn label={selected.size === candidates.length ? t("rename.deselectAll") : t("rename.selectAll")} onClick={toggleAll} />
            <SelBtn label={t("rename.selectMovies")} icon={<Film className="h-3 w-3" />} onClick={() => toggleType("movie")} />
            <SelBtn label={t("rename.selectSeries")} icon={<Tv className="h-3 w-3" />} onClick={() => toggleType("series")} />
            <span className="text-xs text-ink-dim">{selected.size}/{candidates.length} {t("rename.selected")}</span>
            <div className="flex-1" />
            <button
              onClick={doExecute}
              disabled={selected.size === 0 || executing}
              className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-white shadow-sm ring-focus hover:bg-brand-glow disabled:opacity-50"
            >
              {executing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {executing ? t("rename.applying") : t("rename.apply", { count: selected.size })}
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl glass">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8 text-left text-xs font-semibold text-ink-dim">
                  <th className="w-10 px-3 py-3" />
                  <th className="px-3 py-3">{t("rename.colType")}</th>
                  <th className="px-3 py-3">{t("rename.colCurrent")}</th>
                  <th className="px-3 py-3" />
                  <th className="px-3 py-3">{t("rename.colExpected")}</th>
                  <th className="w-20 px-3 py-3 text-right">{t("rename.colFiles")}</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.id} className="border-b border-white/5 transition-colors hover:bg-white/3">
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleOne(c.id)}
                        className="h-4 w-4 rounded border-white/20 bg-white/5 text-brand ring-focus focus:ring-2"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      {c.type === "movie" ? <Film className="h-4 w-4 text-brand-glow" /> : <Tv className="h-4 w-4 text-cyan" />}
                    </td>
                    <td className="max-w-[260px] truncate px-3 py-2.5 font-medium text-ink" title={c.currentPath}>
                      <span className="block truncate">{c.currentFolder}</span>
                      <span className="block truncate text-[11px] text-ink-dim">{c.title}{c.year ? ` (${c.year})` : ""}</span>
                    </td>
                    <td className="px-3 py-2.5 text-ink-dim"><ArrowRight className="h-4 w-4" /></td>
                    <td className="max-w-[260px] truncate px-3 py-2.5 font-medium text-ink" title={c.expectedPath}>
                      <span className="block truncate">{c.expectedFolder}</span>
                      <span className="block truncate text-[11px] text-brand-glow">{c.translatedTitle}{c.year ? ` (${c.year})` : ""}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs text-ink-dim">{c.affectedItems}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {candidates && candidates.length === 0 && !running && (
        <div className="flex items-center gap-2 rounded-2xl glass-strong p-4 text-sm text-ink-soft">
          <Check className="h-4 w-4 text-ok" />
          {t("rename.noRenames")}
        </div>
      )}
    </div>
  );
}

function SelBtn({ label, icon, onClick }: { label: string; icon?: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 rounded-lg border border-white/8 px-3 py-1.5 text-xs font-semibold text-ink-soft ring-focus hover:border-white/20 hover:text-ink"
    >
      {icon}{label}
    </button>
  );
}
