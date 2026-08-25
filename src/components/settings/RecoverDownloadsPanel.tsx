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

/** Batch size for the recover run — a full-scan single request over a big
 *  download folder times out and its giant response freezes the UI. The run
 *  is split server-side into chunks of this many files, re-invoked until
 *  hasMore is false, and each chunk's result is merged progressively. */
const BATCH_SIZE = 20;
/** Hard safety valve against a misbehaving server looping forever. */
const MAX_BATCHES = 10_000;

interface RecoverResult {
  recovered: Array<{ title: string; src: string; dest: string; size: number; season?: number; episode?: number }>;
  failed: Array<{ src: string; size: number; reason: string }>;
  duplicates: Array<{ src: string; size: number }>;
  summary: string;
}

export function RecoverDownloadsPanel() {
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [result, setResult] = useState<RecoverResult | null>(null);
  const [cleaning, setCleaning] = useState(false);
  const [cleaningUnmatched, setCleaningUnmatched] = useState(false);

  const NO_MATCH_REASON = "Aucune correspondance trouvée dans la bibliothèque";
  const unmatched = result?.failed.filter((f) => f.reason === NO_MATCH_REASON) ?? [];

  const merge = (acc: RecoverResult, chunk: RecoverResult): RecoverResult => {
    // Dedupe by src — instance-level failures ("instance:xyz") are re-reported
    // by every batch since they're not file paths and can't be tracked in
    // `processed`; a same-src duplicate in the state would also double-count
    // in the UI and in the "Effacer" buttons.
    const bySrc = <T extends { src: string }>(list: T[]): T[] => {
      const seen = new Set<string>();
      return list.filter((x) => (seen.has(x.src) ? false : (seen.add(x.src), true)));
    };
    return {
      recovered: bySrc([...acc.recovered, ...chunk.recovered]),
      failed: bySrc([...acc.failed, ...chunk.failed]),
      duplicates: bySrc([...acc.duplicates, ...chunk.duplicates]),
      summary: acc.summary,
    };
  };

  const run = async () => {
    if (!(await confirmDialog("Scanner le dossier de téléchargement à la recherche de fichiers non importés ? Les fichiers seront renommés et déplacés vers la bibliothèque.", { tone: "default" }))) return;
    setLoading(true);
    setProgress(null);
    setResult(null);
    try {
      // Chunked run: each request handles at most BATCH_SIZE files and
      // returns the paths it touched; the next request skips them (the
      // server is idempotent per path). `processed` grows across batches.
      const acc: RecoverResult = { recovered: [], failed: [], duplicates: [], summary: "" };
      let processed: string[] = [];
      let hasMore = true;
      let batches = 0;
      while (hasMore && batches < MAX_BATCHES) {
        batches++;
        setProgress(`Lot ${batches} — ${acc.recovered.length + acc.failed.length + acc.duplicates.length} fichier(s) examiné(s)`);
        const res = await fetch("/api/maintenance/recover-downloads", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ batchSize: BATCH_SIZE, processed }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Erreur moteur");
        const chunk = data as RecoverResult & { attempted?: string[]; hasMore?: boolean };
        const next = merge(acc, chunk);
        acc.recovered = next.recovered;
        acc.failed = next.failed;
        acc.duplicates = next.duplicates;
        processed = processed.concat(chunk.attempted ?? []);
        hasMore = !!chunk.hasMore;
      }
      acc.summary = `${acc.recovered.length} récupéré(s), ${acc.failed.length} ignoré(s), ${acc.duplicates.length} doublon(s)`;
      setResult(acc);
      toast("success", acc.summary);
    } catch (e) {
      setResult({ recovered: [], failed: [], duplicates: [], summary: (e as Error).message ?? "Erreur moteur" });
      toast("error", (e as Error).message ?? "Erreur moteur");
    } finally {
      setLoading(false);
      setProgress(null);
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

  // Only the exact "no match at all" reason is offered for deletion — other
  // failure reasons (season not detected, destination outside the library,
  // engine unreachable...) are transient or still fixable (e.g. adding the
  // show to the library later lets the next scan match it), so deleting on
  // those would be destroying a file the next run could still recover.
  const cleanUnmatched = async () => {
    if (!unmatched.length) return;
    if (!(await confirmDialog(`Supprimer ${unmatched.length} fichier(s) sans correspondance dans la bibliothèque ? Ces fichiers ne correspondent à aucun film/série suivi — action irréversible.`, { tone: "danger" }))) return;
    setCleaningUnmatched(true);
    try {
      const res = await fetch("/api/maintenance/recover-downloads", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ files: unmatched.map((f) => f.src) }),
      });
      const data = await res.json() as { deleted?: number };
      if (data.deleted) {
        setResult((prev) => prev ? { ...prev, failed: prev.failed.filter((f) => f.reason !== NO_MATCH_REASON) } : null);
        toast("success", `${data.deleted} fichier(s) sans correspondance supprimé(s)`);
      }
    } finally {
      setCleaningUnmatched(false);
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
        {unmatched.length ? (
          <button
            onClick={cleanUnmatched}
            disabled={cleaningUnmatched}
            title="Ces fichiers ne correspondent à aucun film/série suivi dans la bibliothèque"
            className="flex h-10 items-center gap-2 rounded-xl bg-down/15 px-4 text-sm font-semibold text-down transition-colors hover:bg-down/25 disabled:opacity-50"
          >
            {cleaningUnmatched ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Effacer {unmatched.length} sans correspondance
          </button>
        ) : null}
      </div>

      {result && (
        <div className="mt-4 space-y-2 text-sm">
          <p className="font-semibold text-ink-soft">{result.summary}</p>
          {loading && progress && <p className="text-xs text-ink-dim">{progress}</p>}
          {result.recovered.slice(0, 30).map((r, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg bg-ok/10 p-2">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
              <div className="min-w-0 flex-1">
                <p className="break-words font-medium text-ink">{r.title}</p>
                <p className="break-all text-[11px] text-ink-dim">
                  {r.dest.split("/").pop()?.split("\\").pop()} · {fmtSize(r.size)}
                  {r.season != null ? ` · S${String(r.season).padStart(2, "0")}` : ""}{r.episode != null ? `E${String(r.episode).padStart(2, "0")}` : ""}
                </p>
              </div>
            </div>
          ))}
          {result.recovered.length > 30 && (
            <p className="text-xs text-ink-dim">… et {result.recovered.length - 30} autre(s) récupéré(s)</p>
          )}
          {result.failed.slice(0, 30).map((f, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg bg-down/10 p-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-down" />
              <div className="min-w-0">
                <p className="break-all text-ink-soft">{f.src.split("/").pop()?.split("\\").pop()} · {fmtSize(f.size)}</p>
                <p className="text-[11px] text-ink-dim">{f.reason}</p>
              </div>
            </div>
          ))}
          {result.failed.length > 30 && (
            <p className="text-xs text-ink-dim">… et {result.failed.length - 30} autre(s) ignoré(s)</p>
          )}
        </div>
      )}
    </div>
  );
}
