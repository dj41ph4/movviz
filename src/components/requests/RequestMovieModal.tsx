"use client";

import { useState } from "react";
import { useT } from "@/i18n/provider";
import { Film, Loader2, Info, X, Download } from "lucide-react";
import type { MetaDetail } from "@/lib/metadata/types";

export function RequestMovieModal({
  detail,
  onClose,
  onRequested,
}: {
  detail: MetaDetail;
  onClose: () => void;
  onRequested: () => void;
}) {
  const t = useT();
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSubmit = async () => {
    setSending(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch("/api/library/movies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tmdbId: detail.tmdbId }),
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
      <div className="w-full max-w-md rounded-2xl glass p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
            <Film className="h-5 w-5 text-brand-glow" /> {t("requests.movieTitle")}
          </h2>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-lg glass text-ink-dim hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-4 rounded-xl bg-surface/50 p-3">
          {detail.posterPath ? (
            <img src={`https://image.tmdb.org/t/p/w92${detail.posterPath}`} alt="" className="h-16 w-11 rounded-lg object-cover" />
          ) : (
            <div className="flex h-16 w-11 items-center justify-center rounded-lg bg-surface"><Film className="h-5 w-5 text-ink-dim" /></div>
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
            disabled={sending}
            className="flex items-center gap-2 rounded-lg brand-gradient px-5 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {t("requests.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
