"use client";

import { useState } from "react";
import useSWR from "swr";
import { useT, useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { TmdbImage } from "@/components/media/TmdbImage";
import { Loader2, Check, RotateCcw } from "lucide-react";

interface TitleImageOption {
  filePath: string;
  width: number;
  height: number;
  language: string | null;
  voteAverage: number;
}

type Kind = "backdrop" | "logo";

/**
 * Backdrop/logo picker — an alternate TMDb pick per title. Same cosmetic-edit
 * permission as tags (PATCH .../[id] is requireUser, not requireAdmin), so
 * this stays visible to every user even inside a modal whose other fields
 * (monitored, quality profile, aliases, location) are admin-gated by the
 * caller. Lives inline (no modal chrome of its own) so it can sit as one
 * section of EditTitleModal instead of a second, separate entry point.
 */
export function ArtworkFields({
  type, id, tmdbId, currentBackdropPath, currentLogoPath, onChange,
}: {
  type: "movie" | "series";
  id: string;
  tmdbId: number;
  currentBackdropPath?: string | null;
  currentLogoPath?: string | null;
  onChange: () => void;
}) {
  const t = useT();
  const { locale } = useI18n();
  const [tab, setTab] = useState<Kind>("backdrop");
  const [saving, setSaving] = useState<string | null>(null);
  const [localBackdrop, setLocalBackdrop] = useState(currentBackdropPath);
  const [localLogo, setLocalLogo] = useState(currentLogoPath);

  const { data, isLoading } = useSWR<{ backdrops: TitleImageOption[]; logos: TitleImageOption[] }>(
    `/api/metadata/images?tmdbId=${tmdbId}&type=${type}&locale=${locale}`
  );
  const options = tab === "backdrop" ? data?.backdrops ?? [] : data?.logos ?? [];
  const current = tab === "backdrop" ? localBackdrop : localLogo;
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
      if (tab === "backdrop") setLocalBackdrop(filePath);
      else setLocalLogo(filePath);
      onChange();
    } finally {
      setSaving(null);
    }
  };

  return (
    <div>
      <div className="mb-3 flex gap-2">
        {(["backdrop", "logo"] as const).map((k) => (
          <button
            key={k}
            type="button"
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

      {isLoading ? (
        <div className="flex h-32 items-center justify-center text-ink-dim">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <button
            type="button"
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
              type="button"
              key={opt.filePath}
              onClick={() => choose(opt.filePath)}
              disabled={saving != null}
              className={cn(
                "relative aspect-video overflow-hidden rounded-xl border-2 bg-surface transition-colors disabled:opacity-60",
                current === opt.filePath ? "border-brand" : "border-white/8 hover:border-white/20"
              )}
            >
              <TmdbImage
                path={opt.filePath}
                size="w342"
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
  );
}
