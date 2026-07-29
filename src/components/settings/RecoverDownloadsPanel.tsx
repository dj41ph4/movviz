"use client";

import { useState } from "react";
import { useT } from "@/i18n/provider";
import { FileSearch, Loader2, Check, AlertTriangle, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/Toast";
import { confirmDialog } from "@/components/ui/ConfirmDialog";

function fmtSize(bytes: number) {
  if (!bytes) return "0 B";
  const u = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + " " + u[i];
}

export function RecoverDownloadsPanel() {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    recovered: Array<{ title: string; src: string; dest: string; size: number; season?: number; episode?: number }>;
    failed: Array<{ src: string; size: number; reason: string }>;
    duplicates: Array<{ src: string; size: number }>;
    summary: string;
  } | null>(null);
  const [cleaning, setCleaning] = useState(false);

  const run = async () => {
    if (!(await confirmDialog("Scanner le dossier de téléchargement à la recherche de fichiers non importés ? Les fichiers seront renommés et déplacés vers la bibliothèque.", { tone: "default" }))) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/maintenance/recover-downloads", { method: "POST" });
      const data = await res.json();
      setResult(data);
      toast("success", data.summary);
    } catch {
      setResult({ recovered: [], failed: [], duplicates: [], summary: "Erreur moteur" });
    } finally {
      setLoading(false);
    }
  };

  const cleanDuplicates = async () => {
    if (!result?.duplicates?.length) return;
    if (!(await confirmDialog(`Supprimer ${result.duplicates.length} fichier(s) en double du dossier download ? Les fichiers dans la bibliothèque ne seront pas touchés.`, { tone: "danger" }))) return;
    setCleaning(true);
    try {
      const res = await fetch("/api/maintenance/recover-downloads", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ files: result.duplicates.map((d) => d.src) }),
      });
      const data = await res.json() as { deleted?: number };
      if (data.deleted) {
        setResult((prev) => prev ? { ...prev, duplicates: [] } : null);
        toast("success", `${data.deleted} doublon(s) supprimé(s)`);
      }
    } finally {
      setCleaning(false);
    }
  };

  return (
    <div className="rounded-2xl glass p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber/12 text-amber">
          <FileSearch className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-ink">Récupérer téléchargements</h3>
          <p className="mt-0.5 text-xs text-ink-dim">
            Analyse le dossier de téléchargement à la recherche de fichiers vidéo non importés et les déplace vers la bibliothèque.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={run}
          disabled={loading}
          className="flex h-10 items-center gap-2 rounded-xl bg-amber/15 px-4 text-sm font-semibold text-amber transition-colors hover:bg-amber/25 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSearch className="h-4 w-4" />}
          {loading ? "Scan en cours..." : "Récupérer téléchargements"}
        </button>
        {result?.duplicates?.length ? (
          <button
            onClick={cleanDuplicates}
            disabled={cleaning}
            className="flex h-10 items-center gap-2 rounded-xl bg-down/15 px-4 text-sm font-semibold text-down transition-colors hover:bg-down/25 disabled:opacity-50"
          >
            {cleaning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Effacer {result.duplicates.length} doublon(s)
          </button>
        ) : null}
      </div>

      {result && (
        <div className="mt-4 space-y-2 text-sm">
          <p className="font-semibold text-ink-soft">{result.summary}</p>
          {result.recovered.map((r, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg bg-ok/10 p-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{r.title}</p>
                <p className="truncate text-[11px] text-ink-dim">
                  {r.dest.split("/").pop()?.split("\\").pop()} · {fmtSize(r.size)}
                  {r.season != null ? ` · S${String(r.season).padStart(2, "0")}` : ""}{r.episode != null ? `E${String(r.episode).padStart(2, "0")}` : ""}
                </p>
              </div>
            </div>
          ))}
          {result.failed.map((f, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg bg-down/10 p-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-down" />
              <div className="min-w-0">
                <p className="truncate text-ink-soft">{f.src.split("/").pop()?.split("\\").pop()} · {fmtSize(f.size)}</p>
                <p className="text-[11px] text-ink-dim">{f.reason}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
