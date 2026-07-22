"use client";

import { useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { useT } from "@/i18n/provider";
import { Wrench, Loader2, Film, Tv, Check, AlertTriangle, FolderSearch } from "lucide-react";
import { RepairFileBrowserModal } from "./RepairFileBrowserModal";

interface RepairCandidate {
  id: string;
  type: "movie" | "series";
  title: string;
  season?: number;
  episode?: number;
  oldPath: string;
  matches: string[];
  contested?: boolean;
}

export function RepairPathsPanel() {
  const t = useT();
  const [scanning, setScanning] = useState(false);
  const [candidates, setCandidates] = useState<RepairCandidate[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{ relinked: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualPaths, setManualPaths] = useState<Map<number, string>>(new Map());
  const [browsingIndex, setBrowsingIndex] = useState<number | null>(null);

  const [cleanDirs, setCleanDirs] = useState(true);
  const [cleanupResult, setCleanupResult] = useState<{ deleted: number } | null>(null);
  const [cleaning, setCleaning] = useState(false);

  const scan = useCallback(async () => {
    setScanning(true);
    setError(null);
    setResult(null);
    setCandidates(null);
    setManualPaths(new Map());
    try {
      const res = await fetch("/api/library/repair-paths", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { candidates: RepairCandidate[] } = await res.json();
      setCandidates(data.candidates);
      // Only unambiguous, uncontested single matches are pre-selected — anything with
      // zero or multiple candidates, or a match also claimed by another broken record,
      // needs a human to look before it's applied.
      setSelected(
        new Set(data.candidates.map((c, i) => (c.matches.length === 1 && !c.contested ? i : -1)).filter((i) => i >= 0))
      );
    } catch (e: any) {
      setError(e.message ?? "Scan failed");
    } finally {
      setScanning(false);
    }
  }, []);

  const apply = useCallback(async () => {
    if (!candidates) return;
    const selections = [...selected]
      .map((i) => ({ c: candidates[i], newPath: manualPaths.get(i) ?? candidates[i].matches[0] }))
      .filter(({ newPath }) => !!newPath)
      .map(({ c, newPath }) => ({ id: c.id, type: c.type, season: c.season, episode: c.episode, newPath }));
    if (selections.length === 0) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch("/api/library/repair-paths", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ selections }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Apply failed");
      }
      const data: { relinked: number } = await res.json();
      setResult(data);
      setCandidates((prev) => (prev ? prev.filter((_, i) => !selected.has(i)) : prev));
      setSelected(new Set());
      setManualPaths(new Map());

      if (cleanDirs) {
        setCleaning(true);
        try {
          const scanRes = await fetch("/api/library/clean-dirs", { cache: "no-store" });
          if (scanRes.ok) {
            const { emptyDirs } = await scanRes.json() as { emptyDirs: string[] };
            if (emptyDirs.length > 0) {
              const delRes = await fetch("/api/library/clean-dirs", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ paths: emptyDirs }),
              });
              if (delRes.ok) {
                const delData = await delRes.json() as { deleted: number };
                setCleanupResult(delData);
              }
            } else {
              setCleanupResult({ deleted: 0 });
            }
          }
        } catch {
          // best-effort
        } finally {
          setCleaning(false);
        }
      }
    } catch (e: any) {
      setError(e.message ?? "Network error");
    } finally {
      setApplying(false);
    }
  }, [candidates, selected, manualPaths, cleanDirs]);

  const toggle = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const chooseManualPath = (i: number, newPath: string) => {
    setManualPaths((prev) => new Map(prev).set(i, newPath));
    setSelected((prev) => new Set(prev).add(i));
    setBrowsingIndex(null);
  };

  const unambiguous = candidates?.filter((c) => c.matches.length === 1 && !c.contested).length ?? 0;
  const conflict = candidates?.filter((c) => c.matches.length === 1 && c.contested).length ?? 0;
  const ambiguous = candidates?.filter((c) => c.matches.length > 1).length ?? 0;
  const notFound = candidates?.filter((c) => c.matches.length === 0).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3 rounded-2xl border border-brand/25 bg-brand/8 p-4">
        <Wrench className="mt-0.5 h-5 w-5 shrink-0 text-brand-glow" />
        <div className="flex-1">
          <p className="text-sm font-bold text-ink">{t("repairPaths.title")}</p>
          <p className="mt-1 text-xs text-ink-dim">{t("repairPaths.intro")}</p>
        </div>
      </div>

      <button
        onClick={scan}
        disabled={scanning}
        className="flex h-10 items-center gap-2 rounded-xl brand-gradient px-4 text-sm font-bold text-white disabled:opacity-50"
      >
        {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
        {scanning ? t("repairPaths.scanning") : t("repairPaths.scan")}
      </button>

      <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-dim">
        <input
          type="checkbox"
          checked={cleanDirs}
          onChange={(e) => setCleanDirs(e.target.checked)}
          disabled={applying || scanning}
          className="h-4 w-4 rounded border-white/20 bg-white/5 text-brand ring-focus focus:ring-2 disabled:opacity-30"
        />
        {t("repairPaths.cleanEmptyDirs")}
      </label>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-down/25 bg-down/8 p-4 text-sm text-down">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className="flex items-center gap-2 rounded-2xl glass-strong p-4 text-sm text-ok">
          <Check className="h-4 w-4" />
          {t("repairPaths.relinkedCount", { count: result.relinked })}
        </div>
      )}

      {cleaning && (
        <div className="flex items-center gap-2 rounded-2xl glass-strong p-4 text-sm text-ink-soft">
          <Loader2 className="h-4 w-4 animate-spin" />
          Nettoyage des dossiers vides…
        </div>
      )}

      {cleanupResult && cleanupResult.deleted > 0 && (
        <div className="flex items-center gap-2 rounded-2xl glass-strong p-4 text-sm text-ok">
          <Check className="h-4 w-4" />
          {t("cleanDirs.deletedCount", { count: cleanupResult.deleted })}
        </div>
      )}

      {cleanupResult && cleanupResult.deleted === 0 && (
        <div className="flex items-center gap-2 rounded-2xl glass-strong p-4 text-sm text-ink-soft">
          <Check className="h-4 w-4" />
          {t("cleanDirs.clean")}
        </div>
      )}

      {candidates && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-xs text-ink-dim">
            <span className="rounded-full border border-ok/30 bg-ok/12 px-2.5 py-1 font-bold text-ok">
              {t("repairPaths.unambiguous", { count: unambiguous })}
            </span>
            {ambiguous > 0 && (
              <span className="rounded-full border border-amber/30 bg-amber/12 px-2.5 py-1 font-bold text-amber">
                {t("repairPaths.ambiguous", { count: ambiguous })}
              </span>
            )}
            {conflict > 0 && (
              <span className="rounded-full border border-amber/30 bg-amber/12 px-2.5 py-1 font-bold text-amber">
                {t("repairPaths.conflict", { count: conflict })}
              </span>
            )}
            {notFound > 0 && (
              <span className="rounded-full border border-down/30 bg-down/12 px-2.5 py-1 font-bold text-down">
                {t("repairPaths.notFound", { count: notFound })}
              </span>
            )}
          </div>

          {candidates.length > 0 ? (
            <>
              <div className="flex items-center justify-between">
                <span className="text-xs text-ink-dim">{selected.size}/{candidates.length} {t("rename.selected")}</span>
                <button
                  onClick={apply}
                  disabled={applying || selected.size === 0}
                  className="flex items-center gap-2 rounded-xl brand-gradient px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  {applying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {applying ? t("repairPaths.applying") : t("repairPaths.apply", { count: selected.size })}
                </button>
              </div>

              <div className="overflow-x-auto rounded-2xl glass">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/8 text-left text-xs font-semibold text-ink-dim">
                      <th className="w-10 px-3 py-3" />
                      <th className="px-3 py-3">{t("rename.colType")}</th>
                      <th className="px-3 py-3">{t("repairPaths.colRecorded")}</th>
                      <th className="px-3 py-3">{t("repairPaths.colMatch")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((c, i) => (
                      <tr key={`${c.id}-${c.season ?? 0}-${c.episode ?? 0}`} className="border-b border-white/5 hover:bg-white/3">
                        <td className="px-3 py-2.5">
                          <input
                            type="checkbox"
                            checked={selected.has(i)}
                            disabled={manualPaths.has(i) ? false : c.matches.length !== 1 || c.contested}
                            onChange={() => toggle(i)}
                            className="h-4 w-4 rounded border-white/20 bg-white/5 text-brand ring-focus focus:ring-2 disabled:opacity-30"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          {c.type === "movie" ? <Film className="h-4 w-4 text-brand-glow" /> : <Tv className="h-4 w-4 text-cyan" />}
                        </td>
                        <td className="max-w-[280px] truncate px-3 py-2.5 font-medium text-ink" title={c.oldPath}>
                          <span className="block truncate">{c.title}{c.season != null ? ` — S${c.season}E${String(c.episode).padStart(2, "0")}` : ""}</span>
                          <span className="block truncate text-[11px] text-ink-dim">{c.oldPath}</span>
                        </td>
                        <td className="max-w-[320px] px-3 py-2.5 text-xs">
                          {manualPaths.has(i) ? (
                            <span className="block truncate text-brand-glow" title={manualPaths.get(i)}>{manualPaths.get(i)}</span>
                          ) : (
                            <span className="block truncate">
                              {c.matches.length === 0 && <span className="text-down">{t("repairPaths.noMatch")}</span>}
                              {c.matches.length === 1 && !c.contested && (
                                <span className="text-ok" title={c.matches[0]}>{c.matches[0]}</span>
                              )}
                              {c.matches.length === 1 && c.contested && (
                                <span className="text-amber" title={c.matches[0]}>{t("repairPaths.contestedMatch")}</span>
                              )}
                              {c.matches.length > 1 && (
                                <span className="text-amber">{t("repairPaths.multipleMatches", { count: c.matches.length })}</span>
                              )}
                            </span>
                          )}
                          <button
                            onClick={() => setBrowsingIndex(i)}
                            className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-ink-dim transition-colors hover:text-brand-glow"
                          >
                            <FolderSearch className="h-3 w-3" /> {t("repairPaths.browse")}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl glass-strong p-4 text-sm text-ink-soft">
              <Check className="h-4 w-4 text-ok" />
              {t("repairPaths.clean")}
            </div>
          )}
        </>
      )}

      <AnimatePresence>
        {browsingIndex !== null && candidates && candidates[browsingIndex] && (
          <RepairFileBrowserModal
            initial={dirnameOf(candidates[browsingIndex].oldPath)}
            onCancel={() => setBrowsingIndex(null)}
            onChoose={(p) => chooseManualPath(browsingIndex, p)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** Directory of a path, tolerant of both "/" and "\" separators regardless of which OS this runs on. */
function dirnameOf(p: string): string {
  const idx = Math.max(p.lastIndexOf("/"), p.lastIndexOf("\\"));
  return idx > 0 ? p.slice(0, idx) : p;
}
