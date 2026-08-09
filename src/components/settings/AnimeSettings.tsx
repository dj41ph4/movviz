"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";
import { TvdbSyncAllPanel } from "@/components/settings/TvdbSyncAllPanel";

export function AnimeSettings() {
  const t = useT();
  const [useForAnime, setUseForAnime] = useState(false);
  const [specialsEnabled, setSpecialsEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadTvdb = () =>
    fetch("/api/metadata/tvdb", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setUseForAnime(d.useForAnime);
        setSpecialsEnabled(d.specialsEnabled);
      });

  useEffect(() => { loadTvdb(); }, []);

  const saveTvdb = async (patch: Record<string, unknown>) => {
    setSaving(true);
    try {
      await fetch("/api/metadata/tvdb", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      await loadTvdb();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl glass p-5">
        <div className="mb-5 flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
            <Sparkles className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-bold text-ink">{t("anime.title")}</h3>
            <p className="mt-0.5 text-xs text-ink-dim">{t("anime.intro")}</p>
          </div>
        </div>

        <label className="flex items-center gap-3">
          <button
            onClick={() => saveTvdb({ useForAnime: !useForAnime })}
            disabled={saving}
            className={cn("relative h-6 w-11 rounded-full transition-colors", useForAnime ? "brand-gradient" : "bg-white/10")}
          >
            <span className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", useForAnime && "translate-x-5")} />
          </button>
          <span className="text-sm font-semibold text-ink">{t("metadata.useTvdbForAnime")}</span>
        </label>
        <p className="mt-1 text-xs text-ink-dim">{t("metadata.useTvdbForAnimeHint")}</p>

        <label className="mt-4 flex items-center gap-3">
          <button
            onClick={() => saveTvdb({ specialsEnabled: !specialsEnabled })}
            disabled={saving}
            className={cn("relative h-6 w-11 rounded-full transition-colors", specialsEnabled ? "brand-gradient" : "bg-white/10")}
          >
            <span className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", specialsEnabled && "translate-x-5")} />
          </button>
          <span className="text-sm font-semibold text-ink">{t("anime.specialsEnabled")}</span>
        </label>
        <p className="mt-1 text-xs text-ink-dim">{t("anime.specialsEnabledHint")}</p>
      </div>

      <TvdbSyncAllPanel />
    </div>
  );
}
