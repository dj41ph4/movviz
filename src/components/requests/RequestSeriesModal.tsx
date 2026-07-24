"use client";

import { useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { Tv, Loader2, Info, X, Check } from "lucide-react";
import type { MetaDetail, MetaSeasonSummary } from "@/lib/metadata/types";

export function RequestSeriesModal({
  detail,
  onClose,
  onRequested,
}: {
  detail: MetaDetail;
  onClose: () => void;
  onRequested: () => void;
}) {
  const t = useT();
  const seasons = detail.seasons?.filter((s) => s.seasonNumber > 0) ?? [];
  const [selected, setSelected] = useState<Set<number>>(new Set(seasons.map((s) => s.seasonNumber)));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const toggleSeason = (num: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(num)) next.delete(num);
      else next.add(num);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === seasons.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(seasons.map((s) => s.seasonNumber)));
    }
  };

  const handleSubmit = async () => {
    setSending(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/library/series", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tmdbId: detail.tmdbId,
          seasonNumbers: Array.from(selected),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t("requests.error"));
        return;
      }
      if (data.duplicateRequest) {
        setInfo(t("requests.alreadyPending"));
        return;
      }
      onRequested();
      onClose();
    } catch {
      setError(t("requests.error"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl glass p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
            <Tv className="h-5 w-5 text-cyan" /> {t("requests.seriesTitle")}
          </h2>
          <button onClick={onClose} aria-label={t("common.close")} className="flex h-8 w-8 items-center justify-center rounded-lg glass text-ink-dim hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-4 rounded-xl bg-surface/50 p-3">
          {detail.posterPath ? (
            <img src={`https://image.tmdb.org/t/p/w92${detail.posterPath}`} alt="" className="h-16 w-11 rounded-lg object-cover" />
          ) : (
            <div className="flex h-16 w-11 items-center justify-center rounded-lg bg-surface"><Tv className="h-5 w-5 text-ink-dim" /></div>
          )}
          <div>
            <p className="font-semibold text-ink">{detail.title}</p>
            <p className="text-xs text-ink-dim">{detail.year}</p>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-lg bg-brand/10 p-3 text-sm text-brand-glow">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{t("requests.autoApprovalInfo")}</p>
        </div>

        {/* Sélection des saisons */}
        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-dim">{t("requests.seasonSelect")}</span>
            <button onClick={toggleAll} className="text-xs font-semibold text-brand-glow hover:underline">
              {selected.size === seasons.length ? t("activity.deselectAll") : t("activity.selectAll")}
            </button>
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {seasons.map((s) => (
              <label
                key={s.seasonNumber}
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors",
                  selected.has(s.seasonNumber) ? "bg-brand/10" : "glass hover:bg-white/5"
                )}
              >
                <input
                  type="checkbox"
                  checked={selected.has(s.seasonNumber)}
                  onChange={() => toggleSeason(s.seasonNumber)}
                  className="h-4 w-4 rounded border-white/20 bg-surface text-brand-glow focus:ring-brand-glow"
                />
                <span className="min-w-0 flex-1 text-sm font-medium text-ink">{s.name}</span>
                <span className="text-xs text-ink-dim">{s.episodeCount} {t("requests.episodes")}</span>
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-bold",
                  selected.has(s.seasonNumber) ? "bg-ok/15 text-ok" : "bg-white/10 text-ink-dim"
                )}>
                  {selected.has(s.seasonNumber) ? t("requests.selected") : t("requests.notSelected")}
                </span>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <p className="mt-3 text-sm text-down">{error}</p>
        )}
        {info && (
          <p className="mt-3 text-sm text-amber">{info}</p>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg glass px-4 py-2 text-sm font-bold text-ink-soft hover:text-ink">
            {t("common.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={sending || selected.size === 0}
            className="flex items-center gap-2 rounded-lg brand-gradient px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {t("requests.submitSeasons")}
          </button>
        </div>
      </div>
    </div>
  );
}
