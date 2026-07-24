"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { FolderPicker } from "./FolderPicker";
import { Trash2, Film, Tv, Loader2, Check, ShieldAlert } from "lucide-react";

interface TrashConfig {
  moviesPath: string | null;
  seriesPath: string | null;
  retentionDays: number;
  itemCount: number;
}

/**
 * When a movie/series is deleted with its files, they're moved here instead
 * of being unlinked immediately — a safety net against an accidental
 * deletion (a click) turning into an irreversible loss (the files). A daily
 * task then permanently purges anything past the configured retention.
 * Both trash folders are opt-in per category: leaving one empty keeps that
 * category's old immediate-delete behavior.
 */
export function TrashPanel() {
  const t = useT();
  const [cfg, setCfg] = useState<TrashConfig | null>(null);
  const [pathMode, setPathMode] = useState<"browse" | "write">("write");
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/system", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setPathMode(d.mode === "browse" ? "browse" : "write"))
      .catch(() => {});
    fetch("/api/settings/trash", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCfg(d));
  }, []);

  const save = async (patch: Partial<TrashConfig>, key: string) => {
    setCfg((c) => (c ? { ...c, ...patch } : c));
    setSaving(key);
    try {
      const res = await fetch("/api/settings/trash", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const updated = await res.json();
        setCfg((c) => (c ? { ...c, ...updated } : c));
      }
    } finally {
      setSaving(null);
    }
  };

  if (!cfg) return <div className="flex items-center justify-center gap-2 py-16 text-ink-dim"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
          <Trash2 className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-ink">{t("trash.title")}</h3>
          <p className="mt-0.5 text-xs text-ink-dim">{t("trash.intro")}</p>
        </div>
      </div>

      <div className="rounded-2xl glass p-5">
        <div className="mb-3 flex items-center gap-2">
          <Film className="h-4 w-4 text-brand-glow" />
          <h4 className="font-semibold text-ink">{t("trash.moviesLabel")}</h4>
          {saving === "moviesPath" && <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-dim" />}
        </div>
        <FolderPicker value={cfg.moviesPath ?? ""} onChange={(v) => save({ moviesPath: v || null }, "moviesPath")} mode={pathMode} />
        <p className="mt-1.5 text-[11px] text-ink-dim">{cfg.moviesPath ? t("trash.enabledHint") : t("trash.disabledHint")}</p>
      </div>

      <div className="rounded-2xl glass p-5">
        <div className="mb-3 flex items-center gap-2">
          <Tv className="h-4 w-4 text-cyan" />
          <h4 className="font-semibold text-ink">{t("trash.seriesLabel")}</h4>
          {saving === "seriesPath" && <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-dim" />}
        </div>
        <FolderPicker value={cfg.seriesPath ?? ""} onChange={(v) => save({ seriesPath: v || null }, "seriesPath")} mode={pathMode} />
        <p className="mt-1.5 text-[11px] text-ink-dim">{cfg.seriesPath ? t("trash.enabledHint") : t("trash.disabledHint")}</p>
      </div>

      <div className="rounded-2xl glass p-5">
        <div className="mb-3 flex items-center gap-2">
          <Trash2 className="h-4 w-4 text-ink-dim" />
          <h4 className="font-semibold text-ink">{t("trash.retentionLabel")}</h4>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            value={cfg.retentionDays}
            onChange={(e) => setCfg((c) => (c ? { ...c, retentionDays: Number(e.target.value) || 1 } : c))}
            onBlur={() => save({ retentionDays: cfg.retentionDays }, "retentionDays")}
            className="h-10 w-24 rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40"
          />
          <span className="text-sm text-ink-soft">{t("trash.days")}</span>
          {saving === "retentionDays" && <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-dim" />}
        </div>
        <p className="mt-1.5 text-[11px] text-ink-dim">{t("trash.retentionHint")}</p>
      </div>

      <div className="flex items-center gap-2 rounded-2xl glass-strong px-4 py-3 text-sm text-ink-soft">
        <Check className="h-4 w-4 text-ok" />
        {t("trash.itemCount", { count: cfg.itemCount })}
      </div>
    </div>
  );
}
