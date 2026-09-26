"use client";

import { useState } from "react";
import { mutate } from "swr";
import { Loader2, FolderSync } from "lucide-react";
import { useT } from "@/i18n/provider";
import { anthologyFor } from "@/lib/library/anthologyIds";

interface ReportLine {
  series: string;
  episode: string;
  to: string;
  result: "moved" | "copied" | "copied_original_locked" | "occupied" | "error";
  error?: string;
}

/** « Ranger comme dans Plex » — the Monster anthology only: moves the files
 *  into « Monster (2022)/Saison N » now and shows what happened, file by file
 *  (the error included when the system refuses). */
export function AnthologyRelocate({ tmdbId, seriesId }: { tmdbId: number; seriesId: string }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [lines, setLines] = useState<ReportLine[] | null>(null);
  const [failed, setFailed] = useState(false);
  const hit = anthologyFor(tmdbId);
  if (!hit) return null;

  const run = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch("/api/library/anthology", { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { report?: ReportLine[] };
      setLines(data.report ?? []);
      void mutate(`/api/library/series/${seriesId}`);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs leading-relaxed text-ink-dim">
        {t("title.edit.anthologyHint", { folder: hit.anthology.folder, season: hit.season })}
      </p>
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="flex h-10 items-center gap-2 rounded-xl glass px-3 text-xs font-semibold text-ink-soft transition-colors hover:text-ink disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FolderSync className="h-3.5 w-3.5" />}
        {t("title.edit.anthologyRun")}
      </button>
      {failed && <p className="text-xs text-down">{t("title.edit.anthologyFailed")}</p>}
      {lines && (
        <div className="space-y-1 rounded-xl border border-white/8 bg-black/20 p-3 text-xs">
          {lines.length === 0 && <p className="text-ink-soft">{t("title.edit.anthologyNothing")}</p>}
          {lines.map((line, i) => (
            <p key={i} className={line.result === "error" ? "break-all text-down" : "break-all text-ink-soft"}>
              <span className="font-semibold text-ink">{line.series} {line.episode}</span>{" — "}
              {t(`title.edit.anthologyResult.${line.result}`)}
              {line.error ? ` : ${line.error}` : ""}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
