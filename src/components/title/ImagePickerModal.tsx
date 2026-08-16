"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import useSWR from "swr";
import { useT, useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { X, Loader2, Check, RotateCcw } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface TitleImageOption {
  filePath: string;
  width: number;
  height: number;
  language: string | null;
  voteAverage: number;
}

type Kind = "backdrop" | "logo";

/**
 * Lets any user swap a title's backdrop/logo for an alternate TMDb pick —
 * same cosmetic-edit permission as tags (PATCH .../[id] is requireUser, not
 * requireAdmin). Only for titles already in the library: a title not yet
 * added has no persistent record to attach the choice to.
 */
export function ImagePickerModal({
  type, id, tmdbId, currentBackdropPath, currentLogoPath,
  onClose, onChange,
}: {
  type: "movie" | "series";
  id: string;
  tmdbId: number;
  currentBackdropPath?: string | null;
  currentLogoPath?: string | null;
  onClose: () => void;
  onChange: () => void;
}) {
  const t = useT();
  const { locale } = useI18n();
  const [tab, setTab] = useState<Kind>("backdrop");
  const [saving, setSaving] = useState<string | null>(null);

  const { data, isLoading } = useSWR<{ backdrops: TitleImageOption[]; logos: TitleImageOption[] }>(
    `/api/metadata/images?tmdbId=${tmdbId}&type=${type}&locale=${locale}`,
    fetcher
  );
  const options = tab === "backdrop" ? data?.backdrops ?? [] : data?.logos ?? [];
  const current = tab === "backdrop" ? currentBackdropPath : currentLogoPath;
  const libEndpoint = type === "movie" ? "/api/library/movies" : "/api/library/series";
  const field = tab === "backdrop" ? "customBackdropPath" : "customLogoPath";

  const choose = async (filePath: string | null) => {
    setSaving(filePath ?? "__default__");
    try {
      await fetch(`${libEndpoint}/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [field]: filePath }),
      });
      onChange();
    } finally {
      setSaving(null);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[8vh] backdrop-blur-sm" onClick={onClose}>
      <div
        className="mx-4 max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-void shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-4">
          <h2 className="text-lg font-bold text-ink">{t("title.artwork.modalTitle")}</h2>
          <button onClick={onClose} aria-label={t("common.close")} className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl glass-strong text-ink-dim hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-2 px-6 pt-4">
          {(["backdrop", "logo"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors",
                tab === k ? "brand-gradient text-white" : "glass text-ink-soft hover:text-ink"
              )}
            >
              {k === "backdrop" ? t("title.artwork.tabBackdrop") : t("title.artwork.tabLogo")}
            </button>
          ))}
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="flex h-32 items-center justify-center text-ink-dim">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <button
                onClick={() => choose(null)}
                disabled={saving != null}
                className={cn(
                  "relative flex aspect-video items-center justify-center rounded-xl border-2 bg-black/30 text-xs font-semibold text-ink-dim transition-colors",
                  !current ? "border-brand" : "border-white/8 hover:border-white/20"
                )}
              >
                {saving === "__default__" ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                  <span className="flex items-center gap-1.5"><RotateCcw className="h-3.5 w-3.5" /> {t("title.artwork.useDefault")}</span>
                )}
                {!current && <Check className="absolute right-1.5 top-1.5 h-4 w-4 text-brand-glow" />}
              </button>
              {options.map((opt) => (
                <button
                  key={opt.filePath}
                  onClick={() => choose(opt.filePath)}
                  disabled={saving != null}
                  className={cn(
                    "relative aspect-video overflow-hidden rounded-xl border-2 bg-surface transition-colors disabled:opacity-60",
                    current === opt.filePath ? "border-brand" : "border-white/8 hover:border-white/20"
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/tmdb/w342${opt.filePath}`}
                    alt=""
                    loading="lazy"
                    className={cn("h-full w-full", tab === "logo" ? "object-contain bg-black/40 p-2" : "object-cover")}
                  />
                  {saving === opt.filePath && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <Loader2 className="h-4 w-4 animate-spin text-white" />
                    </div>
                  )}
                  {current === opt.filePath && <Check className="absolute right-1.5 top-1.5 h-4 w-4 text-brand-glow drop-shadow" />}
                </button>
              ))}
              {!isLoading && options.length === 0 && (
                <p className="col-span-full py-6 text-center text-sm text-ink-dim">{t("title.artwork.empty")}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
