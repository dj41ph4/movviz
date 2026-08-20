"use client";

import { useEffect, useState } from "react";
import { useT, useI18n } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { X, Plus, Loader2, SlidersHorizontal } from "lucide-react";

interface ReleaseRules {
  blockedWords: string[];
  allowedWords: string[];
  maxMovieSizeMb: number | null;
  maxEpisodeSizeMb: number | null;
  maxSeasonSizeMb: number | null;
  maxSeriesSizeMb: number | null;
  codecScores: { x264: number; x265: number; av1: number };
  sizePreference: "smaller" | "balanced" | "quality";
  preferredLanguageUpgrade: string | null;
  preferredVideoCodec: string | null;
  preferredAudioCodec: string | null;
  preferredResolution: string | null;
  autoUpgradeEnabled: boolean;
  dashboardUpgradeScanEnabled: boolean;
}

const VIDEO_CODEC_OPTIONS = ["x264", "x265", "AV1"] as const;
const AUDIO_CODEC_OPTIONS = ["DTS", "TrueHD", "Atmos", "AAC", "AC3", "EAC3", "FLAC", "OPUS"] as const;
const LANGUAGE_BY_LOCALE: Record<string, readonly string[]> = {
  fr: ["VF", "VFQ", "MULTI · VF", "VOSTFR", "VOST", "VO"],
  en: ["EN", "MULTI · EN", "VO", "VOSTFR"],
  de: ["GER", "MULTI · GER", "VO"],
  it: ["ITA", "MULTI · ITA", "VO"],
  nl: ["NL", "MULTI · NL", "VO"],
};
const FALLBACK_LANGUAGES = ["VF", "VFQ", "MULTI · VF", "VOSTFR", "VOST", "VO"] as const;
const RESOLUTION_OPTIONS = ["720p", "1080p", "2160p", "4320p"] as const;

const mbToGb = (mb: number | null) => (mb ? String(Math.round((mb / 1024) * 100) / 100) : "");
const gbToMb = (gb: string) => {
  const n = Number(gb.replace(",", "."));
  return gb.trim() && Number.isFinite(n) && n > 0 ? Math.round(n * 1024) : null;
};

export function ReleaseRulesPanel() {
  const t = useT();
  const { locale } = useI18n();
  const languageOptions = (LANGUAGE_BY_LOCALE[locale] ?? FALLBACK_LANGUAGES) as readonly string[];
  const [rules, setRules] = useState<ReleaseRules | null>(null);
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

  const field = "w-full rounded-xl glass-strong px-3 py-2.5 text-sm text-ink outline-none placeholder:text-ink-dim";

  return (
    <div className="rounded-2xl glass p-5 space-y-4">
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/12 text-brand-glow">
          <SlidersHorizontal className="h-5 w-5" />
        </span>
        <div>
          <h3 className="font-bold text-ink">{t("settings.tabQualite")}</h3>
          <p className="mt-0.5 max-w-3xl text-xs text-ink-dim">{t("releaseRules.intro")}</p>
        </div>
      </div>

      {/* Blocked words */}
      <WordListEditor
        title={t("releaseRules.blockedWordsTitle")}
        hint={t("releaseRules.blockedWordsHint")}
        placeholder={t("releaseRules.blockedWordsPlaceholder")}
        words={rules.blockedWords}
        field={field}
        onAdd={(w) => save({ blockedWords: [...rules.blockedWords, w] })}
        onRemove={(w) => save({ blockedWords: rules.blockedWords.filter((x) => x !== w) })}
        duplicates={(w) => rules.blockedWords.some((x) => x.toLowerCase() === w.toLowerCase())}
      />

      {/* Allowed words — cancel a blocked-word match (e.g. "VOSTFR+FRENCH") */}
      <WordListEditor
        title={t("releaseRules.allowedWordsTitle")}
        hint={t("releaseRules.allowedWordsHint")}
        placeholder={t("releaseRules.allowedWordsPlaceholder")}
        words={rules.allowedWords}
        field={field}
        onAdd={(w) => save({ allowedWords: [...rules.allowedWords, w] })}
        onRemove={(w) => save({ allowedWords: rules.allowedWords.filter((x) => x !== w) })}
        duplicates={(w) => rules.allowedWords.some((x) => x.toLowerCase() === w.toLowerCase())}
      />

      {/* Max sizes */}
      <div className="rounded-2xl glass p-5">
        <h3 className="font-bold text-ink">{t("releaseRules.maxSizesTitle")}</h3>
        <p className="mt-1 text-xs text-ink-dim">{t("releaseRules.maxSizesHint")}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <SizeField
            label={t("releaseRules.maxSeriesSize")}
            value={mbToGb(rules.maxSeriesSizeMb)}
            onCommit={(v) => save({ maxSeriesSizeMb: gbToMb(v) })}
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

      {/* Size/quality selection policy — independent of the codec scoring
          above (see releaseRules.ts's sizePreference doc comment): that
          nudges general relevance, this only decides which already-
          qualifying release actually gets grabbed. */}
      <div className="rounded-2xl glass p-5">
        <h3 className="font-bold text-ink">{t("releaseRules.sizePreferenceTitle")}</h3>
        <p className="mt-1 text-xs text-ink-dim">{t("releaseRules.sizePreferenceHint")}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {(["smaller", "balanced", "quality"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => save({ sizePreference: opt })}
              className={cn(
                "rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors",
                rules.sizePreference === opt ? "border-brand/40 bg-brand/12 text-brand-glow" : "border-white/8 bg-black/20 text-ink-soft hover:text-ink"
              )}
            >
              {t(`releaseRules.sizePreference${opt.charAt(0).toUpperCase()}${opt.slice(1)}`)}
              <p className="mt-0.5 text-xs font-normal text-ink-dim">
                {t(`releaseRules.sizePreference${opt.charAt(0).toUpperCase()}${opt.slice(1)}Hint`)}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Language upgrade target — deliberately symmetric, no direction hardcoded (see searchAndReplace.ts). */}
      <div className="rounded-2xl glass p-5">
        <h3 className="font-bold text-ink">{t("releaseRules.languageUpgradeTitle")}</h3>
        <p className="mt-1 text-xs text-ink-dim">{t("releaseRules.languageUpgradeHint")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => save({ preferredLanguageUpgrade: null })}
            className={cn(
              "rounded-xl px-3 py-2 text-xs font-bold transition-colors",
              rules.preferredLanguageUpgrade === null ? "brand-gradient text-white" : "glass-strong text-ink-soft hover:text-ink"
            )}
          >
            {t("releaseRules.languageUpgradeDisabled")}
          </button>
          {languageOptions.map((lang: string) => (
            <button
              key={lang}
              onClick={() => save({ preferredLanguageUpgrade: lang })}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-bold font-mono transition-colors",
                rules.preferredLanguageUpgrade === lang ? "brand-gradient text-white" : "glass-strong text-ink-soft hover:text-ink"
              )}
            >
              {lang}
            </button>
          ))}
        </div>
      </div>

      {/* Video codec target */}
      <div className="rounded-2xl glass p-5">
        <h3 className="font-bold text-ink">{t("releaseRules.videoCodecTitle")}</h3>
        <p className="mt-1 text-xs text-ink-dim">{t("releaseRules.videoCodecHint")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => save({ preferredVideoCodec: null })}
            className={cn(
              "rounded-xl px-3 py-2 text-xs font-bold transition-colors",
              rules.preferredVideoCodec === null ? "brand-gradient text-white" : "glass-strong text-ink-soft hover:text-ink"
            )}
          >
            {t("releaseRules.codecDisabled")}
          </button>
          {VIDEO_CODEC_OPTIONS.map((codec) => (
            <button
              key={codec}
              onClick={() => save({ preferredVideoCodec: codec })}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-bold font-mono transition-colors",
                rules.preferredVideoCodec === codec ? "brand-gradient text-white" : "glass-strong text-ink-soft hover:text-ink"
              )}
            >
              {codec}
            </button>
          ))}
        </div>
      </div>

      {/* Audio codec target */}
      <div className="rounded-2xl glass p-5">
        <h3 className="font-bold text-ink">{t("releaseRules.audioCodecTitle")}</h3>
        <p className="mt-1 text-xs text-ink-dim">{t("releaseRules.audioCodecHint")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => save({ preferredAudioCodec: null })}
            className={cn(
              "rounded-xl px-3 py-2 text-xs font-bold transition-colors",
              rules.preferredAudioCodec === null ? "brand-gradient text-white" : "glass-strong text-ink-soft hover:text-ink"
            )}
          >
            {t("releaseRules.codecDisabled")}
          </button>
          {AUDIO_CODEC_OPTIONS.map((codec) => (
            <button
              key={codec}
              onClick={() => save({ preferredAudioCodec: codec })}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-bold font-mono transition-colors",
                rules.preferredAudioCodec === codec ? "brand-gradient text-white" : "glass-strong text-ink-soft hover:text-ink"
              )}
            >
              {codec}
            </button>
          ))}
        </div>
      </div>

      {/* Resolution target */}
      <div className="rounded-2xl glass p-5">
        <h3 className="font-bold text-ink">{t("releaseRules.resolutionTitle")}</h3>
        <p className="mt-1 text-xs text-ink-dim">{t("releaseRules.resolutionHint")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => save({ preferredResolution: null })}
            className={cn(
              "rounded-xl px-3 py-2 text-xs font-bold transition-colors",
              rules.preferredResolution === null ? "brand-gradient text-white" : "glass-strong text-ink-soft hover:text-ink"
            )}
          >
            {t("releaseRules.codecDisabled")}
          </button>
          {RESOLUTION_OPTIONS.map((res) => (
            <button
              key={res}
              onClick={() => save({ preferredResolution: res })}
              className={cn(
                "rounded-xl px-3 py-2 text-xs font-bold font-mono transition-colors",
                rules.preferredResolution === res ? "brand-gradient text-white" : "glass-strong text-ink-soft hover:text-ink"
              )}
            >
              {res}
            </button>
          ))}
        </div>
      </div>

      {/* Auto-upgrade toggle */}
      <div className="rounded-2xl glass p-5">
        <h3 className="font-bold text-ink">{t("releaseRules.autoUpgradeTitle")}</h3>
        <p className="mt-1 text-xs text-ink-dim">{t("releaseRules.autoUpgradeHint")}</p>
        <div className="mt-4 flex items-center justify-between gap-4">
          <span className="text-xs text-ink-soft">{rules.autoUpgradeEnabled ? t("common.enabled") : t("common.disabled")}</span>
          <button
            onClick={() => save({ autoUpgradeEnabled: !rules.autoUpgradeEnabled })}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors",
              rules.autoUpgradeEnabled ? "brand-gradient" : "bg-white/10"
            )}
          >
            <span className={cn(
              "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
              rules.autoUpgradeEnabled && "translate-x-5"
            )} />
          </button>
        </div>
      </div>

      {/* Dashboard upgrade scan toggle */}
      <div className="rounded-2xl glass p-5">
        <h3 className="font-bold text-ink">{t("releaseRules.dashboardScanTitle")}</h3>
        <p className="mt-1 text-xs text-ink-dim">{t("releaseRules.dashboardScanHint")}</p>
        <div className="mt-4 flex items-center justify-between gap-4">
          <span className="text-xs text-ink-soft">{rules.dashboardUpgradeScanEnabled ? t("common.enabled") : t("common.disabled")}</span>
          <button
            onClick={() => save({ dashboardUpgradeScanEnabled: !rules.dashboardUpgradeScanEnabled })}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors",
              rules.dashboardUpgradeScanEnabled ? "brand-gradient" : "bg-white/10"
            )}
          >
            <span className={cn(
              "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
              rules.dashboardUpgradeScanEnabled && "translate-x-5"
            )} />
          </button>
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

function WordListEditor({
  title,
  hint,
  placeholder,
  words,
  field,
  onAdd,
  onRemove,
  duplicates,
}: {
  title: string;
  hint: string;
  placeholder: string;
  words: string[];
  field: string;
  onAdd: (w: string) => void;
  onRemove: (w: string) => void;
  duplicates: (w: string) => boolean;
}) {
  const [input, setInput] = useState("");
  const add = () => {
    const w = input.trim();
    if (!w || duplicates(w)) return;
    setInput("");
    onAdd(w);
  };
  return (
    <div className="rounded-2xl glass p-5">
      <h3 className="font-bold text-ink">{title}</h3>
      <p className="mt-1 text-xs text-ink-dim">{hint}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {words.map((w) => (
          <span key={w} className="flex items-center gap-1.5 rounded-full border border-white/8 bg-black/30 py-1 pl-3 pr-1.5 text-xs font-semibold text-ink-soft">
            {w}
            <button onClick={() => onRemove(w)} className="flex h-5 w-5 items-center justify-center rounded-full text-ink-dim hover:bg-down/15 hover:text-down">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={placeholder}
          className={cn(field, "flex-1")}
        />
        <button onClick={add} disabled={!input.trim()} className="flex h-11 items-center gap-2 rounded-xl brand-gradient px-4 text-sm font-bold text-white disabled:opacity-40">
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
