"use client";

import { useState, useCallback } from "react";
import { useT } from "@/i18n/provider";
import { FolderOpen, Loader2, Check, AlertTriangle, Trash2, ShieldAlert } from "lucide-react";

export function CleanDirsPanel() {
  const t = useT();
  const [scanning, setScanning] = useState(false);
  const [emptyDirs, setEmptyDirs] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [result, setResult] = useState<{ deleted: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scan = useCallback(async () => {
    setScanning(true);
    setError(null);
    setResult(null);
    setEmptyDirs(null);
    setSelected(new Set());
    try {
      const res = await fetch("/api/library/clean-dirs", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { emptyDirs: string[] } = await res.json();
      setEmptyDirs(data.emptyDirs);
      setSelected(new Set(data.emptyDirs.map((_, i) => i)));
    } catch (e: any) {
      setError(e.message ?? "Scan failed");
    } finally {
      setScanning(false);
    }
  }, []);

  const apply = useCallback(async () => {
    if (!emptyDirs) return;
    const paths = [...selected].map((i) => emptyDirs[i]);
    if (paths.length === 0) return;
    if (!confirm(t("cleanDirs.confirmDelete", { count: paths.length }))) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/library/clean-dirs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paths }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "Delete failed");
      }
      const data: { deleted: number } = await res.json();
      setResult(data);
      setEmptyDirs((prev) => (prev ? prev.filter((_, i) => !selected.has(i)) : prev));
      setSelected(new Set());
    } catch (e: any) {
      setError(e.message ?? "Network error");
    } finally {
      setDeleting(false);
    }
  }, [emptyDirs, selected]);

  const toggleAll = () => {
    if (!emptyDirs) return;
    if (selected.size === emptyDirs.length) setSelected(new Set());
    else setSelected(new Set(emptyDirs.map((_, i) => i)));
  };

  const toggle = (i: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
          <FolderOpen className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-ink">{t("cleanDirs.title")}</h3>
          <p className="mt-0.5 text-xs text-ink-dim">{t("cleanDirs.intro")}</p>
        </div>
      </div>
      <div className="flex items-start gap-3 rounded-2xl border border-down/25 bg-down/8 p-4">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-down" />
        <div>
          <p className="text-sm font-bold text-down">{t("settings.diskWarningTitle")}</p>
          <p className="mt-1 text-xs text-ink-dim">{t("settings.diskWarningHint")}</p>
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-brand/25 bg-brand/8 p-4">
        <FolderOpen className="mt-0.5 h-5 w-5 shrink-0 text-brand-glow" />
        <div className="flex-1">
          <p className="text-sm font-bold text-ink">{t("cleanDirs.title")}</p>
          <p className="mt-1 text-xs text-ink-dim">{t("cleanDirs.intro")}</p>
        </div>
      </div>

      <button
        onClick={scan}
        disabled={scanning}
        className="flex h-10 items-center gap-2 rounded-xl brand-gradient px-4 text-sm font-bold text-white disabled:opacity-50"
      >
        {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <FolderOpen className="h-4 w-4" />}
        {scanning ? t("cleanDirs.scanning") : t("cleanDirs.scan")}
      </button>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl border border-down/25 bg-down/8 p-4 text-sm text-down">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      {result && (
        <div className="flex items-center gap-2 rounded-2xl glass-strong p-4 text-sm text-ok">
          <Check className="h-4 w-4" />
          {t("cleanDirs.deletedCount", { count: result.deleted })}
        </div>
      )}

      {emptyDirs && (
        <>
          {emptyDirs.length > 0 ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-dim">
                  <input
                    type="checkbox"
                    checked={selected.size === emptyDirs.length}
                    onChange={toggleAll}
                    className="h-4 w-4 rounded border-white/20 bg-white/5 text-brand ring-focus focus:ring-2"
                  />
                  {selected.size}/{emptyDirs.length} {t("rename.selected")}
                </label>
                <button
                  onClick={apply}
                  disabled={deleting || selected.size === 0}
                  className="flex items-center gap-2 rounded-xl bg-down px-5 py-2 text-sm font-bold text-white hover:bg-down-hover disabled:opacity-50"
                >
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  {deleting ? t("cleanDirs.deleting") : t("cleanDirs.delete", { count: selected.size })}
                </button>
              </div>

              <div className="overflow-hidden rounded-2xl glass">
                {emptyDirs.map((dir, i) => (
                  <label
                    key={i}
                    className="flex cursor-pointer items-center gap-3 border-b border-white/5 px-4 py-3 transition-colors hover:bg-white/3 last:border-b-0"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(i)}
                      onChange={() => toggle(i)}
                      className="h-4 w-4 shrink-0 rounded border-white/20 bg-white/5 text-brand ring-focus focus:ring-2"
                    />
                    <FolderOpen className="h-4 w-4 shrink-0 text-ink-dim" />
                    <span className="truncate text-sm text-ink" title={dir}>
                      {dir}
                    </span>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 rounded-2xl glass-strong p-4 text-sm text-ink-soft">
              <Check className="h-4 w-4 text-ok" />
              {t("cleanDirs.clean")}
            </div>
          )}
        </>
      )}
    </div>
  );
}
