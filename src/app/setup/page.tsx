"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useT, useI18n } from "@/i18n/provider";
import { LOCALES, LOCALE_META } from "@/i18n/config";
import { FlagIcon } from "@/components/ui/FlagIcon";
import { cn } from "@/lib/utils";
import { IndexerManager } from "@/components/settings/IndexerManager";
import { DownloadClients } from "@/components/settings/DownloadClients";
import { PlexSettings } from "@/components/settings/PlexSettings";
import {
  Clapperboard, Languages, KeyRound, Tv, Magnet, HardDrive, Play, PartyPopper,
  Check, Loader2, ArrowRight, ExternalLink, ChevronRight,
} from "lucide-react";

const STEPS = ["language", "tmdb", "tvdb", "indexers", "downloads", "plex", "done"] as const;
type Step = (typeof STEPS)[number];

const STEP_ICON: Record<Step, React.ElementType> = {
  language: Languages,
  tmdb: KeyRound,
  tvdb: Tv,
  indexers: Magnet,
  downloads: HardDrive,
  plex: Play,
  done: PartyPopper,
};

export default function SetupWizardPage() {
  const t = useT();
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];

  const next = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStepIndex((i) => Math.max(i - 1, 0));

  return (
    <div className="mx-auto min-h-screen max-w-[900px] px-4 py-10">
      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl brand-gradient shadow-lg">
          <Clapperboard className="h-6 w-6 text-white" strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-ink">{t("setup.title")}</h1>
        <p className="max-w-md text-sm text-ink-dim">{t("setup.subtitle")}</p>
      </div>

      <div className="mb-8 flex items-center justify-center gap-2">
        {STEPS.map((s, i) => {
          const Icon = STEP_ICON[s];
          return (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-full border text-xs font-bold transition-colors",
                  i < stepIndex ? "border-ok/40 bg-ok/15 text-ok" :
                  i === stepIndex ? "border-brand/50 bg-brand/15 text-brand-glow" :
                  "border-white/10 text-ink-dim"
                )}
              >
                {i < stepIndex ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-ink-dim/40" />}
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -16 }}
          transition={{ duration: 0.2 }}
        >
          {step === "language" && <LanguageStep />}
          {step === "tmdb" && <TmdbStep />}
          {step === "tvdb" && <TvdbStep />}
          {step === "indexers" && (
            <StepShell title={t("setup.indexersTitle")} hint={t("setup.indexersHint")}>
              <IndexerManager />
            </StepShell>
          )}
          {step === "downloads" && (
            <StepShell title={t("setup.downloadsTitle")} hint={t("setup.downloadsHint")}>
              <DownloadClients />
            </StepShell>
          )}
          {step === "plex" && (
            <StepShell title={t("setup.plexTitle")} hint={t("setup.plexHint")}>
              <PlexSettings />
            </StepShell>
          )}
          {step === "done" && (
            <div className="flex flex-col items-center gap-4 rounded-2xl glass-strong py-16 text-center">
              <PartyPopper className="h-10 w-10 text-brand-glow" />
              <h2 className="text-xl font-black text-ink">{t("setup.doneTitle")}</h2>
              <p className="max-w-sm text-sm text-ink-dim">{t("setup.doneHint")}</p>
              <button
                onClick={() => { window.location.href = "/"; }}
                className="mt-2 flex h-11 items-center gap-2 rounded-xl brand-gradient px-6 text-sm font-bold text-white"
              >
                {t("setup.goToDashboard")} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {step !== "done" && (
        <div className="mt-6 flex items-center justify-between">
          <button
            onClick={back}
            disabled={stepIndex === 0}
            className="rounded-xl glass px-4 py-2.5 text-sm font-semibold text-ink-soft disabled:opacity-30"
          >
            {t("setup.back")}
          </button>
          <div className="flex gap-2">
            <button onClick={next} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-ink-dim hover:text-ink">
              {t("setup.skip")}
            </button>
            <button onClick={next} className="flex h-11 items-center gap-2 rounded-xl brand-gradient px-6 text-sm font-bold text-white">
              {t("setup.next")} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StepShell({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-1 text-lg font-black text-ink">{title}</h2>
      <p className="mb-5 text-sm text-ink-dim">{hint}</p>
      {children}
    </div>
  );
}

function LanguageStep() {
  const t = useT();
  const { locale, setLocale } = useI18n();

  return (
    <StepShell title={t("setup.languageTitle")} hint={t("setup.languageHint")}>
      <div className="grid gap-2 sm:grid-cols-2">
        {LOCALES.map((l) => (
          <button
            key={l}
            onClick={() => setLocale(l)}
            className={cn(
              "flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors",
              l === locale ? "border-brand/40 bg-brand/12 text-brand-glow" : "border-white/8 bg-black/20 text-ink-soft hover:text-ink"
            )}
          >
            <FlagIcon locale={l} className="h-4 w-6 shrink-0 rounded-[2px]" />
            <span className="flex-1">{LOCALE_META[l].label}</span>
            {l === locale && <Check className="h-4 w-4 text-brand-glow" />}
          </button>
        ))}
      </div>
    </StepShell>
  );
}

function TmdbStep() {
  const t = useT();
  const [isDefault, setIsDefault] = useState(true);
  const [mode, setMode] = useState<"default" | "own">("default");
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);

  const check = () =>
    fetch("/api/metadata/key", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setIsDefault(d.isDefault);
        setMode(d.isDefault ? "default" : "own");
      });

  useEffect(() => { check(); }, []);

  const save = async () => {
    if (!key.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/metadata/key", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: key.trim() }),
      });
      setKey("");
      await check();
    } finally {
      setSaving(false);
    }
  };

  return (
    <StepShell title={t("setup.tmdbTitle")} hint={t("setup.tmdbHint")}>
      <div className="rounded-2xl glass p-5">
        <div className="mb-4 grid gap-2 sm:grid-cols-2">
          <button
            onClick={() => setMode("default")}
            className={cn(
              "rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors",
              mode === "default" ? "border-brand/40 bg-brand/12 text-brand-glow" : "border-white/8 bg-black/20 text-ink-soft hover:text-ink"
            )}
          >
            {t("setup.tmdbUseDefault")}
            <p className="mt-0.5 text-xs font-normal text-ink-dim">{t("setup.tmdbUseDefaultHint")}</p>
          </button>
          <button
            onClick={() => setMode("own")}
            className={cn(
              "rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors",
              mode === "own" ? "border-brand/40 bg-brand/12 text-brand-glow" : "border-white/8 bg-black/20 text-ink-soft hover:text-ink"
            )}
          >
            {t("setup.tmdbUseOwn")}
            <p className="mt-0.5 text-xs font-normal text-ink-dim">{t("setup.tmdbUseOwnHint")}</p>
          </button>
        </div>

        {mode === "default" ? (
          <div className="flex items-center gap-2 rounded-xl border border-ok/25 bg-ok/12 px-3 py-2 text-sm font-semibold text-ok">
            <Check className="h-4 w-4" /> {t("setup.tmdbDefaultActive")}
          </div>
        ) : (
          <>
            {!isDefault && (
              <div className="mb-4 flex items-center gap-2 rounded-xl border border-ok/25 bg-ok/12 px-3 py-2 text-sm font-semibold text-ok">
                <Check className="h-4 w-4" /> {t("setup.tmdbConfigured")}
              </div>
            )}
            <div className="flex gap-2">
              <input
                value={key}
                onChange={(e) => setKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && save()}
                placeholder={t("discover.tmdbKeyPlaceholder")}
                autoComplete="off"
                className="h-11 flex-1 rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40"
              />
              <button
                onClick={save}
                disabled={saving || !key.trim()}
                className="flex h-11 items-center gap-2 rounded-xl brand-gradient px-5 text-sm font-bold text-white disabled:opacity-40"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("discover.saveKey")}
              </button>
            </div>
            <a
              href="https://www.themoviedb.org/settings/api"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-glow hover:underline"
            >
              {t("setup.tmdbGetKey")} <ExternalLink className="h-3 w-3" />
            </a>
          </>
        )}
      </div>
    </StepShell>
  );
}

function TvdbStep() {
  const t = useT();
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [key, setKey] = useState("");
  const [saving, setSaving] = useState(false);

  const check = () =>
    fetch("/api/metadata/tvdb", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setConfigured(d.configured));

  useEffect(() => { check(); }, []);

  const save = async () => {
    if (!key.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/metadata/tvdb", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ apiKey: key.trim() }),
      });
      setKey("");
      await check();
    } finally {
      setSaving(false);
    }
  };

  return (
    <StepShell title={t("setup.tvdbTitle")} hint={t("setup.tvdbHint")}>
      <div className="rounded-2xl glass p-5">
        {configured && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-ok/25 bg-ok/12 px-3 py-2 text-sm font-semibold text-ok">
            <Check className="h-4 w-4" /> {t("metadata.tvdbConfigured")}
          </div>
        )}
        <div className="flex gap-2">
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder={t("metadata.tvdbKeyPlaceholder")}
            autoComplete="off"
            className="h-11 flex-1 rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40"
          />
          <button
            onClick={save}
            disabled={saving || !key.trim()}
            className="flex h-11 items-center gap-2 rounded-xl brand-gradient px-5 text-sm font-bold text-white disabled:opacity-40"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("discover.saveKey")}
          </button>
        </div>
        <a
          href="https://thetvdb.com/api-information"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-glow hover:underline"
        >
          {t("setup.tvdbGetKey")} <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </StepShell>
  );
}
