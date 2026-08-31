"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { mutate } from "swr";
import { useT, useI18n } from "@/i18n/provider";
import { LOCALES, LOCALE_META } from "@/i18n/config";
import { FlagIcon } from "@/components/ui/FlagIcon";
import { cn } from "@/lib/utils";
import { IndexerManager } from "@/components/settings/IndexerManager";
import { DownloadClients } from "@/components/settings/DownloadClients";
import { PlexSettings } from "@/components/settings/PlexSettings";
import { AiSettingsPanel } from "@/components/settings/AiSettingsPanel";
import { AnimatedLogo } from "@/components/fx/AnimatedLogo";
import { useTheme } from "@/lib/theme/useTheme";
import { useCurrentUser } from "@/lib/auth/useCurrentUser";
import { resetSwrCache } from "@/lib/swrCacheReset";
import type { ThemeMode } from "@/lib/theme/theme";
import type { WizardTrackedField } from "@/lib/setup/wizardProvenance";
import {
  Clapperboard, Languages, KeyRound, Tv, Magnet, HardDrive, Play, PartyPopper, ShieldCheck,
  Check, Loader2, ArrowRight, ExternalLink, ChevronRight, Sun, Moon, MonitorSmartphone,
  Smartphone, Monitor, Server, Cpu, Sparkles, Tablet, Gamepad2, Bot, UserPlus,
} from "lucide-react";
import { DASHBOARD_MODES, DEFAULT_DASHBOARD_LAYOUT, type DashboardLayout } from "@/lib/dashboard/types";
import { DEVICE_TYPES, type DeviceType } from "@/lib/setup/deviceTypes";

const STEPS = ["account", "language", "appearance", "hardware", "personalization", "tmdb", "tvdb", "ai", "indexers", "downloads", "plex", "done"] as const;
type Step = (typeof STEPS)[number];

const STEP_ICON: Record<Step, React.ElementType> = {
  account: UserPlus,
  language: Languages,
  appearance: Sun,
  hardware: Cpu,
  personalization: MonitorSmartphone,
  tmdb: KeyRound,
  tvdb: Tv,
  ai: Bot,
  indexers: Magnet,
  downloads: HardDrive,
  plex: Play,
  done: PartyPopper,
};

const WIZARD_INTRO_SEEN_KEY = "movviz-wizard-intro-seen";
const WIZARD_INTRO_AUTO_DISMISS_MS = 2400;

/**
 * First-launch-only intro — the sidebar's own logo+wordmark animation
 * (AnimatedLogo + .text-logo-flow, both already prefers-reduced-motion-aware)
 * full-screen for a beat, fading out before the wizard itself appears.
 * Deliberately not shown again once dismissed: a localStorage flag is purely
 * cosmetic here (no server-side wizard-completion state to track), so it's
 * fine if it's lost on a different browser/profile — worst case, someone
 * sees the intro twice.
 */
function WizardIntro({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, WIZARD_INTRO_AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <motion.div
      key="wizard-intro"
      onClick={onDone}
      className="fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center gap-4 bg-void"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
    >
      <AnimatedLogo size="lg" />
      <div className="text-logo-flow text-3xl font-black tracking-tight">Movviz</div>
    </motion.div>
  );
}

export default function SetupWizardPage() {
  return (
    <Suspense fallback={null}>
      <SetupWizardPageInner />
    </Suspense>
  );
}

function SetupWizardPageInner() {
  const t = useT();
  const searchParams = useSearchParams();
  // "Relancer l'assistant → Optimisation intelligente" (Settings) links here
  // with ?mode=smart — see HardwareStep for what that changes.
  const smartMode = searchParams.get("mode") === "smart";
  const [stepIndex, setStepIndex] = useState(0);

  // The "account" step only makes sense for a truly fresh install (or after
  // a factory reset): a signed-in user re-running the wizard from Settings
  // already has an account and must never be asked to create another one.
  const currentUser = useCurrentUser();
  // Bug fix (confirmed live): deriving `steps` straight from `currentUser`
  // on every render shifts every index by one the moment the account is
  // created mid-wizard — currentUser flips null → real user right here, on
  // this same mounted page, which would silently swap the "account" step
  // out of the array while `stepIndex` still pointed at the position that
  // was valid a moment ago (landing one step early, skipping "language").
  // Decide once, the first time currentUser resolves out of its `undefined`
  // (loading) state, and never re-derive it afterward for this mount.
  const [needsAccountStep, setNeedsAccountStep] = useState<boolean | null>(null);
  useEffect(() => {
    if (currentUser === undefined || needsAccountStep !== null) return;
    setNeedsAccountStep(currentUser === null);
  }, [currentUser, needsAccountStep]);
  const steps = needsAccountStep === false ? STEPS.filter((s) => s !== "account") : STEPS;
  const step = steps[stepIndex];

  // Starts false on both server and first client render (no hydration
  // mismatch), then flips true post-mount if this browser hasn't seen it yet.
  const [showIntro, setShowIntro] = useState(false);
  useEffect(() => {
    if (!localStorage.getItem(WIZARD_INTRO_SEEN_KEY)) setShowIntro(true);
  }, []);
  const dismissIntro = () => {
    localStorage.setItem(WIZARD_INTRO_SEEN_KEY, "1");
    setShowIntro(false);
  };

  const next = () => setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  const back = () => setStepIndex((i) => Math.max(i - 1, 0));

  // Still resolving whether this browser already has a session — render
  // nothing rather than flashing the account-creation step for a returning
  // signed-in user (or the reverse) for one frame.
  if (needsAccountStep === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-ink-dim" />
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-[900px] px-4 py-10">
      <AnimatePresence>{showIntro && <WizardIntro onDone={dismissIntro} />}</AnimatePresence>

      <div className="mb-8 flex flex-col items-center gap-3 text-center">
        <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl brand-gradient shadow-lg">
          <Clapperboard className="h-6 w-6 text-white" strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-black tracking-tight text-ink">{t("setup.title")}</h1>
        <p className="max-w-md text-sm text-ink-dim">{t("setup.subtitle")}</p>
      </div>

      <div className="mb-8 flex items-center justify-center gap-2">
        {steps.map((s, i) => {
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
              {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-ink-dim/40" />}
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
          {step === "account" && <AccountStep onCreated={next} />}
          {step === "language" && <LanguageStep />}
          {step === "appearance" && <AppearanceStep />}
          {step === "hardware" && <HardwareStep smartMode={smartMode} />}
          {step === "personalization" && <PersonalizationStep />}
          {step === "tmdb" && <TmdbStep />}
          {step === "tvdb" && <TvdbStep />}
          {step === "ai" && (
            <StepShell title={t("setup.aiTitle")} hint={t("setup.aiHint")}>
              <AiSettingsPanel showDebugLog={false} />
            </StepShell>
          )}
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
              <div className="flex w-full max-w-sm flex-col gap-2.5 rounded-2xl glass p-4 text-left">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-brand-glow" />
                  <h3 className="text-sm font-bold text-ink">{t("setup.doneUsersTitle")}</h3>
                </div>
                <p className="text-xs leading-relaxed text-ink-dim">{t("setup.doneUsersHint")}</p>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {step !== "done" && step !== "account" && (
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

/**
 * Mandatory first step on a fresh install (or after a factory reset): no
 * account exists yet, so nothing past this point can work — every other
 * settings panel in the wizard (AI, download clients, Plex) calls an
 * admin-only API and silently renders empty/stuck without a session. Reuses
 * /api/auth/register (same endpoint as /login's own registration form) —
 * the very first account created always becomes admin. Skipped entirely for
 * a signed-in user re-running the wizard (see `steps` filter above).
 */
function AccountStep({ onCreated }: { onCreated: () => void }) {
  const t = useT();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!username.trim() || !password) return;
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.error === "username_taken" ? t("auth.usernameTaken")
          : data.error === "username_too_short" ? t("auth.usernameTooShort")
          : data.error === "password_too_short" ? t("auth.passwordTooShort")
          : t("auth.invalidCredentials")
        );
        return;
      }
      // Bug fix (confirmed live): the login page's resetSwrCache() is
      // revalidate:false by design — it clears every cache entry to
      // undefined and relies on the NEXT page's fresh hook mount to refetch
      // (a real navigation always follows it there). This wizard never
      // navigates away — SetupWizardPageInner's own useCurrentUser() stays
      // mounted across the step change — so clearing "/api/auth/me" left it
      // stuck on `undefined` forever with nothing left to trigger a refetch,
      // which made the loading-guard above spin indefinitely right after
      // account creation. Clear every other per-user cache (same reasoning
      // as the login page: a stale watch status/preferences/etc. must never
      // leak into the session that's about to exist), then explicitly
      // revalidate the one key this very page depends on right now.
      await resetSwrCache();
      await mutate("/api/auth/me");
      onCreated();
    } finally {
      setBusy(false);
    }
  };

  return (
    <StepShell title={t("setup.accountTitle")} hint={t("setup.accountHint")}>
      <div className="space-y-3 rounded-2xl glass p-5">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-ink-soft">{t("auth.username")}</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="h-11 w-full rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40"
            autoComplete="username"
            autoFocus
          />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-ink-soft">{t("auth.password")}</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="h-11 w-full rounded-xl border border-white/8 bg-black/30 px-3 text-sm text-ink outline-none focus:border-brand/40"
            autoComplete="new-password"
          />
        </div>
        {error && <p className="text-xs font-semibold text-down">{error}</p>}
        <button
          onClick={submit}
          disabled={busy || !username.trim() || !password}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl brand-gradient text-sm font-bold text-white disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
          {t("auth.createAccount")}
        </button>
      </div>
    </StepShell>
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

const THEME_OPTIONS: { id: ThemeMode; icon: typeof Sun; labelKey: string }[] = [
  { id: "light", icon: Sun, labelKey: "profile.themeLight" },
  { id: "dark", icon: Moon, labelKey: "profile.themeDark" },
  { id: "auto", icon: MonitorSmartphone, labelKey: "profile.themeAuto" },
];

function AppearanceStep() {
  const t = useT();
  const { mode, setThemeMode } = useTheme();

  return (
    <StepShell title={t("setup.appearanceTitle")} hint={t("setup.appearanceHint")}>
      <div className="grid gap-2 sm:grid-cols-3">
        {THEME_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = mode === opt.id;
          return (
            <button
              key={opt.id}
              onClick={() => setThemeMode(opt.id)}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border px-4 py-4 text-sm font-semibold transition-colors",
                active ? "border-brand/40 bg-brand/12 text-brand-glow" : "border-white/8 bg-black/20 text-ink-soft hover:text-ink"
              )}
            >
              <Icon className="h-5 w-5" />
              {t(opt.labelKey)}
              {active && <Check className="h-4 w-4 text-brand-glow" />}
            </button>
          );
        })}
      </div>
    </StepShell>
  );
}

interface HardwarePreset {
  id: string;
  icon: typeof Tv;
  labelKey: string;
  consequenceKey: string;
  codecScores: { x264: number; x265: number; av1: number };
  maxMovieSizeMb: number | null;
  maxEpisodeSizeMb: number | null;
  maxSeasonSizeMb: number | null;
}

/**
 * Presets only ever write to the SAME existing scoring fields the Qualité
 * settings tab already exposes (releaseRules.codecScores + size caps) — no
 * second scoring engine, just sane starting points for the one that already
 * exists. Provenance is recorded so "Relancer l'assistant" (LOT4.2) can later
 * tell a wizard-set value apart from one the user has since edited by hand.
 */
const HARDWARE_PRESETS: HardwarePreset[] = [
  {
    id: "tv",
    icon: Tv,
    labelKey: "setup.hardwareTv",
    consequenceKey: "setup.hardwareTvConsequence",
    codecScores: { x264: 0, x265: 12, av1: 16 },
    maxMovieSizeMb: null,
    maxEpisodeSizeMb: null,
    maxSeasonSizeMb: null,
  },
  {
    id: "phone",
    icon: Smartphone,
    labelKey: "setup.hardwarePhone",
    consequenceKey: "setup.hardwarePhoneConsequence",
    codecScores: { x264: 0, x265: 14, av1: 20 },
    maxMovieSizeMb: 4096,
    maxEpisodeSizeMb: 1024,
    maxSeasonSizeMb: 8192,
  },
  {
    id: "pc",
    icon: Monitor,
    labelKey: "setup.hardwarePc",
    consequenceKey: "setup.hardwarePcConsequence",
    codecScores: { x264: 0, x265: 8, av1: 14 },
    maxMovieSizeMb: null,
    maxEpisodeSizeMb: null,
    maxSeasonSizeMb: null,
  },
  {
    id: "nas",
    icon: HardDrive,
    labelKey: "setup.hardwareNas",
    consequenceKey: "setup.hardwareNasConsequence",
    codecScores: { x264: 0, x265: 16, av1: 22 },
    maxMovieSizeMb: 8192,
    maxEpisodeSizeMb: 2048,
    maxSeasonSizeMb: 16384,
  },
  {
    id: "server",
    icon: Server,
    labelKey: "setup.hardwareServer",
    consequenceKey: "setup.hardwareServerConsequence",
    codecScores: { x264: 0, x265: 6, av1: 10 },
    maxMovieSizeMb: null,
    maxEpisodeSizeMb: null,
    maxSeasonSizeMb: null,
  },
];

function HardwareStep({ smartMode }: { smartMode: boolean }) {
  const t = useT();
  const [selected, setSelected] = useState<HardwarePreset | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [locked, setLocked] = useState<Set<WizardTrackedField>>(new Set());

  useEffect(() => {
    if (!smartMode) return;
    fetch("/api/setup/wizard-provenance", { cache: "no-store" })
      .then((r) => r.json())
      .then((prov: Record<string, "wizard" | "manual">) => {
        setLocked(new Set(Object.entries(prov).filter(([, v]) => v === "manual").map(([k]) => k as WizardTrackedField)));
      });
  }, [smartMode]);

  const apply = async () => {
    if (!selected) return;
    setApplying(true);
    try {
      const patch: Record<string, unknown> = { source: "wizard" };

      // Smart re-optimization: a field the user has since edited by hand in
      // the Qualité settings tab is never silently overwritten here — only
      // fields still carrying "wizard" provenance (or never touched at all)
      // get the new preset's value.
      const codecKeys = ["codecScores.x264", "codecScores.x265", "codecScores.av1"] as const;
      if (!smartMode || codecKeys.some((k) => !locked.has(k))) {
        if (!smartMode) {
          patch.codecScores = selected.codecScores;
        } else {
          const current = await fetch("/api/settings/release-rules", { cache: "no-store" }).then((r) => r.json());
          patch.codecScores = {
            x264: locked.has("codecScores.x264") ? current.codecScores.x264 : selected.codecScores.x264,
            x265: locked.has("codecScores.x265") ? current.codecScores.x265 : selected.codecScores.x265,
            av1: locked.has("codecScores.av1") ? current.codecScores.av1 : selected.codecScores.av1,
          };
        }
      }
      if (!smartMode || !locked.has("maxMovieSizeMb")) patch.maxMovieSizeMb = selected.maxMovieSizeMb;
      if (!smartMode || !locked.has("maxEpisodeSizeMb")) patch.maxEpisodeSizeMb = selected.maxEpisodeSizeMb;
      if (!smartMode || !locked.has("maxSeasonSizeMb")) patch.maxSeasonSizeMb = selected.maxSeasonSizeMb;

      await fetch("/api/settings/release-rules", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      });
      setApplied(selected.id);
    } finally {
      setApplying(false);
    }
  };

  return (
    <StepShell title={t("setup.hardwareTitle")} hint={smartMode ? t("setup.hardwareSmartHint") : t("setup.hardwareHint")}>
      <div className="grid gap-2 sm:grid-cols-3">
        {HARDWARE_PRESETS.map((p) => {
          const Icon = p.icon;
          const active = selected?.id === p.id;
          return (
            <button
              key={p.id}
              onClick={() => { setSelected(p); setApplied(null); }}
              className={cn(
                "flex flex-col items-center gap-2 rounded-xl border px-4 py-4 text-sm font-semibold transition-colors",
                active ? "border-brand/40 bg-brand/12 text-brand-glow" : "border-white/8 bg-black/20 text-ink-soft hover:text-ink"
              )}
            >
              <Icon className="h-5 w-5" />
              {t(p.labelKey)}
            </button>
          );
        })}
      </div>

      {selected && (
        <div className="mt-4 rounded-xl border border-brand/25 bg-brand/8 p-4">
          <div className="flex items-start gap-2.5">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-glow" />
            <p className="text-sm text-ink-soft">{t(selected.consequenceKey)}</p>
          </div>
          <button
            onClick={apply}
            disabled={applying || applied === selected.id}
            className="mt-3 flex h-9 items-center gap-2 rounded-xl brand-gradient px-4 text-xs font-bold text-white disabled:opacity-60"
          >
            {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : applied === selected.id ? <Check className="h-3.5 w-3.5" /> : null}
            {applied === selected.id ? t("setup.hardwareApplied") : t("setup.hardwareApply")}
          </button>
        </div>
      )}
    </StepShell>
  );
}

const DEVICE_ICON: Record<DeviceType, React.ElementType> = {
  tv4k: Tv,
  smartphone: Smartphone,
  tablet: Tablet,
  pc: Monitor,
  console: Gamepad2,
  remoteServer: Server,
};

/**
 * LOT7 — two independent, purely-descriptive personalization questions:
 * which devices the household watches on (multi-select, stored via
 * devicePreferences.ts — no auto-selection logic wired to it yet, see LOT6
 * `versions[]` for the data a future version would use), and the Dashboard
 * Experience preferences already exposed in Réglages (LOT5.6) — surfaced
 * here too so a new install can pick its dashboard style up front instead
 * of only discovering the setting later.
 */
function PersonalizationStep() {
  const t = useT();
  const [devices, setDevices] = useState<Set<DeviceType>>(new Set());
  const [layout, setLayout] = useState<DashboardLayout | null>(null);

  useEffect(() => {
    fetch("/api/setup/device-preferences", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setDevices(new Set(d.devices ?? [])));
    fetch("/api/dashboard/layout", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setLayout(d.layout ?? DEFAULT_DASHBOARD_LAYOUT));
  }, []);

  const toggleDevice = (id: DeviceType) => {
    const next = new Set(devices);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDevices(next);
    fetch("/api/setup/device-preferences", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ devices: [...next] }),
    });
  };

  const saveLayout = (patch: Partial<DashboardLayout>) => {
    if (!layout) return;
    const next = { ...layout, ...patch };
    setLayout(next);
    fetch("/api/dashboard/layout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(next),
    });
  };

  return (
    <StepShell title={t("setup.personalizationTitle")} hint={t("setup.personalizationHint")}>
      <div className="space-y-6">
        <div>
          <p className="mb-2 text-sm font-semibold text-ink">{t("setup.devicesQuestion")}</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {DEVICE_TYPES.map((id) => {
              const Icon = DEVICE_ICON[id];
              const active = devices.has(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleDevice(id)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border px-4 py-4 text-sm font-semibold transition-colors",
                    active ? "border-brand/40 bg-brand/12 text-brand-glow" : "border-white/8 bg-black/20 text-ink-soft hover:text-ink"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {t(`setup.devices.${id}`)}
                  {active && <Check className="h-3.5 w-3.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {layout && (
          <div>
            <p className="mb-2 text-sm font-semibold text-ink">{t("setup.dashboardModeQuestion")}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {DASHBOARD_MODES.map((mode) => (
                <button
                  key={mode}
                  onClick={() => saveLayout({ mode })}
                  className={cn(
                    "rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors",
                    layout.mode === mode ? "border-brand/40 bg-brand/12 text-brand-glow" : "border-white/8 bg-black/20 text-ink-soft hover:text-ink"
                  )}
                >
                  {t(`settings.dashboardExperience.mode.${mode}`)}
                </button>
              ))}
            </div>
          </div>
        )}
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
