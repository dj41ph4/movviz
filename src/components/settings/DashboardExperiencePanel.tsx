"use client";

import { useEffect, useState } from "react";
import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { useGpu } from "@/lib/gpu/GpuProvider";
import {
  DASHBOARD_MODES,
  DASHBOARD_SECTION_IDS,
  DEFAULT_DASHBOARD_LAYOUT,
  HERO_SLIDESHOW_SPEEDS,
  type DashboardLayout,
  type DashboardMode,
  type DashboardSectionId,
} from "@/lib/dashboard/types";

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onChange}
      disabled={disabled}
      className={cn("relative h-6 w-11 shrink-0 rounded-full transition-colors", on && !disabled ? "brand-gradient" : "bg-white/10", disabled && "cursor-not-allowed opacity-40")}
    >
      <span className={cn("absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform", on && "translate-x-5")} />
    </button>
  );
}

const SECTION_LABEL_KEY: Record<DashboardSectionId, string> = {
  becauseYouLike: "dashboard.rowRecommended",
  availableNow: "dashboard.recentlyAdded",
  comingSoon: "dashboard.rowUpcoming",
  upgradesAvailable: "dashboard.upgradesAvailable",
  discover: "dashboard.rowTrending",
};

/** Video preview is either off, on-hover, or fully autoplaying — never both trailerAutoplay and playOnHover independently toggled, which would produce a confusing state (autoplay already implies "no need to hover"). */
type PreviewMode = "off" | "hover" | "auto";

function previewModeOf(hero: DashboardLayout["hero"]): PreviewMode {
  if (hero.trailerAutoplay) return "auto";
  if (hero.playOnHover) return "hover";
  return "off";
}

export function DashboardExperiencePanel() {
  const t = useT();
  const gpu = useGpu();
  const [layout, setLayout] = useState<DashboardLayout | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard/layout", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setLayout(d?.layout ?? DEFAULT_DASHBOARD_LAYOUT));
  }, []);

  const save = async (patch: Partial<DashboardLayout>) => {
    if (!layout) return;
    const next = { ...layout, ...patch };
    setLayout(next);
    setSaving(true);
    try {
      await fetch("/api/dashboard/layout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
    } finally {
      setSaving(false);
    }
  };

  const saveHero = (patch: Partial<DashboardLayout["hero"]>) => {
    if (!layout) return;
    save({ hero: { ...layout.hero, ...patch } });
  };

  const toggleSection = (id: DashboardSectionId) => {
    if (!layout) return;
    const sections = layout.sections.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s));
    save({ sections });
  };

  if (!layout) return <div className="h-40 animate-pulse rounded-2xl glass" />;

  const preview = previewModeOf(layout.hero);
  const setPreview = (mode: PreviewMode) => {
    if (mode === "off") saveHero({ trailerAutoplay: false, playOnHover: false });
    else if (mode === "hover") saveHero({ trailerAutoplay: false, playOnHover: true });
    else saveHero({ trailerAutoplay: true, playOnHover: true });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl glass p-5">
        <h3 className="mb-1 font-bold text-ink">{t("settings.dashboardExperience.animationsTitle")}</h3>
        <p className="mb-4 text-sm text-ink-dim">{t("settings.dashboardExperience.animationsHint")}</p>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-ink">{t("settings.dashboardExperience.animationsEnabled")}</span>
          <Toggle
            on={!gpu.reduceAnimations}
            onChange={() => gpu.setReduceAnimations(!gpu.reduceAnimations)}
          />
        </div>
      </div>

      <div className="rounded-2xl glass p-5">
        <h3 className="mb-1 font-bold text-ink">{t("settings.dashboardExperience.modeTitle")}</h3>
        <p className="mb-4 text-sm text-ink-dim">{t("settings.dashboardExperience.modeHint")}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {DASHBOARD_MODES.map((mode) => (
            <button
              key={mode}
              onClick={() => save({ mode })}
              className={cn(
                "relative rounded-xl border p-4 text-left transition-colors",
                layout.mode === mode ? "border-brand/50 bg-brand/10" : "border-white/8 bg-black/20 hover:bg-white/5"
              )}
            >
              {layout.mode === mode && <Check className="absolute right-3 top-3 h-4 w-4 text-brand-glow" />}
              <p className="font-semibold text-ink">{t(`settings.dashboardExperience.mode.${mode}`)}</p>
              <p className="mt-1 text-xs text-ink-dim">{t(`settings.dashboardExperience.modeDesc.${mode}`)}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl glass p-5">
        <h3 className="mb-4 font-bold text-ink">{t("settings.dashboardExperience.sectionsTitle")}</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink">{t("settings.dashboardExperience.showStats")}</span>
            <Toggle on={layout.showStats} onChange={() => save({ showStats: !layout.showStats })} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink">{t("settings.dashboardExperience.showDownloads")}</span>
            <Toggle on={layout.showDownloads} onChange={() => save({ showDownloads: !layout.showDownloads })} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink">{t("settings.dashboardExperience.showTasks")}</span>
            <Toggle on={layout.showTasks} onChange={() => save({ showTasks: !layout.showTasks })} />
          </div>
        </div>
      </div>

      {layout.mode === "cinema" && (
        <>
          <div className="rounded-2xl glass p-5">
            <h3 className="mb-4 font-bold text-ink">{t("settings.dashboardExperience.heroTitle")}</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-ink">{t("settings.dashboardExperience.heroEnabled")}</span>
                <Toggle on={layout.hero.enabled} onChange={() => saveHero({ enabled: !layout.hero.enabled })} />
              </div>

              <div>
                <p className="mb-2 text-sm text-ink">{t("settings.dashboardExperience.slideshowSpeed")}</p>
                <div className="flex flex-wrap gap-2">
                  {HERO_SLIDESHOW_SPEEDS.map((secs) => (
                    <button
                      key={secs}
                      onClick={() => saveHero({ slideshowSpeedSec: secs })}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors",
                        layout.hero.slideshowSpeedSec === secs ? "border-brand/50 bg-brand/10 text-brand-glow" : "border-white/8 bg-black/20 text-ink-soft hover:bg-white/5"
                      )}
                    >
                      {secs === 60 ? "1 min" : `${secs}s`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-sm text-ink">{t("settings.dashboardExperience.videoPreview")}</p>
                <p className="mb-2 text-xs text-ink-dim">{t("settings.dashboardExperience.videoPreviewHint")}</p>
                <div className="flex flex-wrap gap-2">
                  {(["off", "hover", "auto"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setPreview(mode)}
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors",
                        preview === mode ? "border-brand/50 bg-brand/10 text-brand-glow" : "border-white/8 bg-black/20 text-ink-soft hover:bg-white/5"
                      )}
                    >
                      {t(`settings.dashboardExperience.videoPreviewMode.${mode}`)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1 text-sm text-ink">{t("settings.dashboardExperience.contentMixTitle")}</p>
                <p className="mb-2 text-xs text-ink-dim">{t("settings.dashboardExperience.contentMixHint")}</p>
                <div className="space-y-2">
                  <label className="flex items-center justify-between gap-2">
                    <span className="text-sm text-ink-soft">{t("settings.dashboardExperience.includeOwned")}</span>
                    <Toggle
                      on={layout.hero.includeOwned}
                      disabled={layout.hero.includeOwned && !layout.hero.includeUnowned}
                      onChange={() => saveHero({ includeOwned: !layout.hero.includeOwned })}
                    />
                  </label>
                  <label className="flex items-center justify-between gap-2">
                    <span className="text-sm text-ink-soft">{t("settings.dashboardExperience.includeUnowned")}</span>
                    <Toggle
                      on={layout.hero.includeUnowned}
                      disabled={layout.hero.includeUnowned && !layout.hero.includeOwned}
                      onChange={() => saveHero({ includeUnowned: !layout.hero.includeUnowned })}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl glass p-5">
            <h3 className="mb-4 font-bold text-ink">{t("settings.dashboardExperience.rowsTitle")}</h3>
            <div className="space-y-3">
              {DASHBOARD_SECTION_IDS.map((id) => {
                const section = layout.sections.find((s) => s.id === id);
                return (
                  <div key={id} className="flex items-center justify-between">
                    <span className="text-sm text-ink">{t(SECTION_LABEL_KEY[id])}</span>
                    <Toggle on={section?.visible ?? true} onChange={() => toggleSection(id)} />
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {saving && <p className="text-xs text-ink-dim">{t("common.saving")}</p>}
    </div>
  );
}
