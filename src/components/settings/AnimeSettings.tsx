"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { Check, X, Sparkles } from "lucide-react";
import { TvdbSyncAllPanel } from "@/components/settings/TvdbSyncAllPanel";

export function AnimeSettings() {
  const t = useT();
  const [tvdbConfigured, setTvdbConfigured] = useState(false);
  const [hasStoredKey, setHasStoredKey] = useState(false);
  const [useForAnime, setUseForAnime] = useState(false);
  const [specialsEnabled, setSpecialsEnabled] = useState(true);
  const [tvdbApiKey, setTvdbApiKey] = useState("");
  const [tvdbSaving, setTvdbSaving] = useState(false);
  const [tvdbTestResult, setTvdbTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const loadTvdb = () =>
    fetch("/api/metadata/tvdb", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setTvdbConfigured(d.configured);
        setHasStoredKey(d.hasStoredKey);
        setUseForAnime(d.useForAnime);
        setSpecialsEnabled(d.specialsEnabled);
      });

  useEffect(() => { loadTvdb(); }, []);

  const saveTvdb = async (patch: Record<string, unknown>) => {
    setTvdbSaving(true);
    try {
      await fetch("/api/metadata/tvdb", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      await loadTvdb();
    } finally {
      setTvdbSaving(false);
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

        <div className="mb-4 flex items-center gap-2">
          <span className={cn("flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold", tvdbConfigured ? "border-ok/25 bg-ok/12 text-ok" : "border-amber/25 bg-amber/12 text-amber")}>
            {tvdbConfigured ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
            {tvdbConfigured ? t("metadata.tvdbConfigured") : t("metadata.tvdbNotConfigured")}
          </span>
        </div>

        <div className="flex gap-2">
          <input
            value={tvdbApiKey}
            onChange={(e) => setTvdbApiKey(e.target.value)}
            placeholder={hasStoredKey ? "••••••••••••••••" : t("metadata.tvdbKeyPlaceholder")}
            className="flex-1 rounded-xl glass-strong px-3 py-2.5 text-sm text-ink outline-none"
          />
          <button
            onClick={() => { saveTvdb({ apiKey: tvdbApiKey }); setTvdbApiKey(""); }}
            disabled={tvdbSaving || !tvdbApiKey.trim()}
            className="brand-gradient text-white h-10 px-4 rounded-xl font-semibold text-sm flex items-center disabled:opacity-40"
          >
            {t("discover.saveKey")}
          </button>
        </div>
        {tvdbTestResult && (
          <p className={cn("mt-2 text-xs font-semibold", tvdbTestResult.ok ? "text-ok" : "text-down")}>
            {tvdbTestResult.ok ? t("metadata.keyValid") : t("metadata.keyInvalid")}
          </p>
        )}

        <label className="mt-4 flex items-center gap-3">
          <button
            onClick={() => saveTvdb({ useForAnime: !useForAnime })}
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
