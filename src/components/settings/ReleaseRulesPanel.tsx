"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { X, Plus, Loader2 } from "lucide-react";

interface ReleaseRules {
  blockedWords: string[];
  maxMovieSizeMb: number | null;
  maxEpisodeSizeMb: number | null;
  maxSeasonSizeMb: number | null;
  codecScores: { x264: number; x265: number; av1: number };
}

const mbToGb = (mb: number | null) => (mb ? String(Math.round((mb / 1024) * 100) / 100) : "");
const gbToMb = (gb: string) => {
  const n = Number(gb.replace(",", "."));
  return gb.trim() && Number.isFinite(n) && n > 0 ? Math.round(n * 1024) : null;
};

export function ReleaseRulesPanel() {
  const t = useT();
  const [rules, setRules] = useState<ReleaseRules | null>(null);
  const [wordInput, setWordInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = () =>
    fetch("/api/settings/release-rules", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setRules(d));

  useEffect(() => { load(); }, []);

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const save = async (patch: Record<string, unknown>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/release-rules", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        setRules(await res.json());
        flashSaved();
      }
    } finally {
      setSaving(false);
    }
  };

  if (!rules) return null;

  const addWord = () => {
    const w = wordInput.trim();
    if (!w || rules.blockedWords.some((x) => x.toLowerCase() === w.toLowerCase())) return;
    setWordInput("");
    save({ blockedWords: [...rules.blockedWords, w] });
  };

  const removeWord = (w: string) => save({ blockedWords: rules.blockedWords.filter((x) => x !== w) });

  const field = "h-11 rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none transition-colors placeholder:text-ink-dim focus:border-brand/40";

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-ink-soft">{t("releaseRules.intro")}</p>

      {/* Blocked words */}
      <div className="rounded-2xl glass p-5">
        <h3 className="font-bold text-ink">{t("releaseRules.blockedWordsTitle")}</h3>
        <p className="mt-1 text-xs text-ink-dim">{t("releaseRules.blockedWordsHint")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {rules.blockedWords.map((w) => (
            <span key={w} className="flex items-center gap-1.5 rounded-full border border-white/8 bg-black/30 py-1 pl-3 pr-1.5 text-xs font-semibold text-ink-soft">
              {w}
              <button onClick={() => removeWord(w)} className="flex h-5 w-5 items-center justify-center rounded-full text-ink-dim hover:bg-down/15 hover:text-down">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <input
            value={wordInput}
            onChange={(e) => setWordInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addWord()}
            placeholder={t("releaseRules.blockedWordsPlaceholder")}
            className={cn(field, "flex-1")}
          />
          <button onClick={addWord} disabled={!wordInput.trim()} className="flex h-11 items-center gap-2 rounded-xl brand-gradient px-4 text-sm font-bold text-white disabled:opacity-40">
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Max sizes */}
      <div className="rounded-2xl glass p-5">
        <h3 className="font-bold text-ink">{t("releaseRules.maxSizesTitle")}</h3>
        <p className="mt-1 text-xs text-ink-dim">{t("releaseRules.maxSizesHint")}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <SizeField
            label={t("releaseRules.maxMovieSize")}
            value={mbToGb(rules.maxMovieSizeMb)}
            onCommit={(v) => save({ maxMovieSizeMb: gbToMb(v) })}
            className={field}
          />
          <SizeField
            label={t("releaseRules.maxEpisodeSize")}
            value={mbToGb(rules.maxEpisodeSizeMb)}
            onCommit={(v) => save({ maxEpisodeSizeMb: gbToMb(v) })}
            className={field}
          />
          <SizeField
            label={t("releaseRules.maxSeasonSize")}
            value={mbToGb(rules.maxSeasonSizeMb)}
            onCommit={(v) => save({ maxSeasonSizeMb: gbToMb(v) })}
            className={field}
          />
        </div>
      </div>

      {/* Codec scoring */}
      <div className="rounded-2xl glass p-5">
        <h3 className="font-bold text-ink">{t("releaseRules.codecScoringTitle")}</h3>
        <p className="mt-1 text-xs text-ink-dim">{t("releaseRules.codecScoringHint")}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <ScoreField
            label={t("releaseRules.codecX264")}
            value={rules.codecScores.x264}
            onCommit={(v) => save({ codecScores: { ...rules.codecScores, x264: v } })}
            className={field}
          />
          <ScoreField
            label={t("releaseRules.codecX265")}
            value={rules.codecScores.x265}
            onCommit={(v) => save({ codecScores: { ...rules.codecScores, x265: v } })}
            className={field}
          />
          <ScoreField
            label={t("releaseRules.codecAv1")}
            value={rules.codecScores.av1}
            onCommit={(v) => save({ codecScores: { ...rules.codecScores, av1: v } })}
            className={field}
          />
        </div>
      </div>

      <div className="flex h-5 items-center gap-2 text-xs">
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-ink-dim" />}
        {saved && <span className="font-semibold text-ok">{t("settings.saved")}</span>}
      </div>
    </div>
  );
}

function SizeField({ label, value, onCommit, className }: { label: string; value: string; onCommit: (v: string) => void; className: string }) {
  const [local, setLocal] = useState(value);
  useEffect(() => { setLocal(value); }, [value]);
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-ink-soft">{label}</label>
      <div className="relative">
        <input
          value={local}
          onChange={(e) => setLocal(e.target.value.replace(/[^0-9.,]/g, ""))}
          onBlur={() => onCommit(local)}
          onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
          placeholder="—"
          className={cn(className, "w-full pr-10")}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-ink-dim">Go</span>
      </div>
    </div>
  );
}

function ScoreField({ label, value, onCommit, className }: { label: string; value: number; onCommit: (v: number) => void; className: string }) {
  const [local, setLocal] = useState(String(value));
  useEffect(() => { setLocal(String(value)); }, [value]);
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-ink-soft">{label}</label>
      <input
        value={local}
        onChange={(e) => setLocal(e.target.value.replace(/[^-\d]/g, ""))}
        onBlur={() => onCommit(Number(local) || 0)}
        onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
        inputMode="numeric"
        className={className}
      />
    </div>
  );
}
