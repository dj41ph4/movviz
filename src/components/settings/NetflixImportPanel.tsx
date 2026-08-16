"use client";

import { useRef, useState } from "react";
import { useT } from "@/i18n/provider";
import { toast } from "@/components/ui/Toast";
import { cn } from "@/lib/utils";
import { Upload, Loader2, Check, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

interface NetflixImportResult {
  totalRows: number;
  moviesMatched: number;
  episodesMatched: number;
  unmatched: string[];
}

/**
 * Netflix → Movviz (demande explicite user). Netflix has no public API for
 * viewing history — the only legitimate way in is the CSV each user
 * downloads themselves from their own Netflix account (Compte → Activité
 * de visionnage → Télécharger tout). Strictly per-user, non-admin (every
 * Movviz account configures its own history) — matches into the exact same
 * watched-status system Plex sync already feeds (src/lib/netflix/
 * importHistory.ts), then pushes onward to this user's own linked Plex
 * account if there is one.
 */
export function NetflixImportPanel() {
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<NetflixImportResult | null>(null);
  const [showUnmatched, setShowUnmatched] = useState(false);

  const pickFile = () => fileInputRef.current?.click();

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setFileName(file.name);
    setCsv(await file.text());
  };

  const runImport = async () => {
    if (!csv || importing) return;
    setImporting(true);
    setResult(null);
    try {
      const r = await fetch("/api/netflix/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csv }),
      });
      if (r.ok) {
        const data: NetflixImportResult = await r.json();
        setResult(data);
        toast("success", t("settings.netflix.importDone", { movies: String(data.moviesMatched), episodes: String(data.episodesMatched) }));
      } else {
        toast("error", t("settings.netflix.importFailed"));
      }
    } catch {
      toast("error", t("settings.netflix.importFailed"));
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <div>
        <h2 className="text-lg font-bold text-ink">{t("settings.netflix.title")}</h2>
        <p className="mt-1 max-w-2xl text-sm text-ink-dim">{t("settings.netflix.description")}</p>
      </div>

      <div className="mt-5 rounded-xl border border-white/8 bg-black/20 p-4">
        <p className="mb-3 text-xs text-ink-dim">{t("settings.netflix.howTo")}</p>

        <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={onFileChange} className="hidden" />

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={pickFile}
            className="glass-strong flex h-10 items-center gap-2 rounded-xl px-4 text-sm font-bold text-ink-soft transition-colors hover:text-ink"
          >
            <Upload className="h-4 w-4" />
            {fileName ?? t("settings.netflix.chooseFile")}
          </button>
          <button
            onClick={runImport}
            disabled={!csv || importing}
            className="brand-gradient flex h-10 items-center gap-2 rounded-xl px-5 text-sm font-bold text-white disabled:opacity-40"
          >
            {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("settings.netflix.import")}
          </button>
        </div>

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
