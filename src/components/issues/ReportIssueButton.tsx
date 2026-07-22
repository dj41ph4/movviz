"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import type { IssueType } from "@/lib/issues/types";
import { Flag, X, Loader2, Check } from "lucide-react";

const ISSUE_TYPES: IssueType[] = ["video", "audio", "subtitle", "other"];

export function ReportIssueButton({
  libraryType, libraryId, className,
}: {
  libraryType: "movie" | "series";
  libraryId: string;
  className?: string;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [issueType, setIssueType] = useState<IssueType>("video");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!description.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/issues", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ libraryType, libraryId, issueType, description: description.trim() }),
      });
      setDone(true);
      setTimeout(() => { setOpen(false); setDone(false); setDescription(""); }, 1200);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}
        className={cn("flex h-9 w-9 items-center justify-center rounded-xl glass-strong text-ink-soft transition-colors hover:text-amber", className)}
        title={t("issues.report")}
      >
        <Flag className="h-3.5 w-3.5" />
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setOpen(false)}>
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl glass-strong p-5"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-ink">{t("issues.report")}</h3>
              <button onClick={() => setOpen(false)} className="text-ink-dim hover:text-ink"><X className="h-4 w-4" /></button>
            </div>

            {done ? (
              <div className="flex flex-col items-center gap-2 py-6 text-ok">
                <Check className="h-6 w-6" />
                <p className="text-sm font-semibold">{t("issues.reported")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-1 rounded-xl glass p-1">
                  {ISSUE_TYPES.map((it) => (
                    <button
                      key={it}
                      onClick={() => setIssueType(it)}
                      className={cn("flex-1 rounded-lg px-2 py-2 text-xs font-semibold transition-colors", issueType === it ? "brand-gradient text-white" : "text-ink-soft hover:text-ink")}
                    >
                      {t(`issues.type.${it}`)}
                    </button>
                  ))}
                </div>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t("issues.descriptionPlaceholder")}
                  rows={4}
                  className="w-full resize-none rounded-xl border border-white/8 bg-black/30 px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-dim focus:border-brand/40"
                />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setOpen(false)} className="rounded-xl glass px-4 py-2 text-sm font-semibold text-ink-soft hover:text-ink">{t("blocklist.cancel")}</button>
                  <button
                    onClick={submit}
                    disabled={saving || !description.trim()}
                    className="flex items-center gap-2 rounded-xl brand-gradient px-5 py-2 text-sm font-bold text-white disabled:opacity-40"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />} {t("issues.submit")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
