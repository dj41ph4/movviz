"use client";

import { useEffect, useState } from "react";
import { useSWRConfig } from "swr";
import { toast } from "@/components/ui/Toast";
import { useI18n, useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { Toggle } from "@/components/ui/Toggle";
import {
  DASHBOARD_SECTION_IDS,
  DEFAULT_DASHBOARD_LAYOUT,
  HERO_SLIDESHOW_SPEEDS,
  type DashboardLayout,
  type DashboardSectionId,
} from "@/lib/dashboard/types";
import { DEFAULT_EASTER_WINDOW, DEFAULT_SEASON_WINDOWS, type SeasonSettings } from "@/lib/seasonal/calendar";

const FIXED_SEASONS = ["halloween", "christmas", "newYear", "valentine", "summer"] as const;
const SELECT_CLASS = "rounded-xl border border-white/8 bg-black/20 px-2 py-2 text-sm font-semibold text-ink outline-none focus:border-brand/50";
const SELECT_STYLE = { colorScheme: "dark", backgroundColor: "#0a0a12", color: "#f5f5f7" } as const;
const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/** Sélecteur jour + mois (MM-JJ) — pas de champ date, qui imposerait une année. */
function DayMonthPicker({ value, label, onChange, locale }: { value: string; label: string; onChange: (next: string) => void; locale: string }) {
  const [month, day] = value.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthName = (m: number) => new Intl.DateTimeFormat(locale, { month: "long" }).format(new Date(2026, m - 1, 1));
  return (
    <span className="inline-flex items-center gap-1.5" role="group" aria-label={label}>
      <select aria-label={label} value={day} className={SELECT_CLASS} style={SELECT_STYLE}
        onChange={(e) => onChange(`${pad(month)}-${pad(Number(e.target.value))}`)}>
        {Array.from({ length: DAYS_IN_MONTH[month - 1] }, (_, i) => i + 1).map((d) => <option key={d} value={d} style={{ backgroundColor: "#0a0a12" }}>{d}</option>)}
      </select>
      <select aria-label={label} value={month} className={SELECT_CLASS} style={SELECT_STYLE}
        onChange={(e) => { const m = Number(e.target.value); onChange(`${pad(m)}-${pad(Math.min(day, DAYS_IN_MONTH[m - 1]))}`); }}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m} style={{ backgroundColor: "#0a0a12" }}>{monthName(m)}</option>)}
      </select>
    </span>
  );
}

const SECTION_LABEL_KEY: Record<DashboardSectionId, string> = {
  continueWatching: "dashboard.continueWatching",
  becauseYouLike: "dashboard.rowRecommended",
  watchlist: "watchlist.title",
  rewatch: "dashboard.rowRewatch",
  seasonal: "dashboard.rowSeasonal",
  shortSessions: "dashboard.shortSessions",
  availableNow: "dashboard.recentlyAdded",
  announced: "dashboard.rowAnnounced",
  comingSoon: "dashboard.rowUpcoming",
  upgradesAvailable: "dashboard.upgradesAvailable",
  discover: "dashboard.rowTrending",
};

/** Video preview is either off or fully autoplaying — the former "on-hover" mode was removed: it never worked reliably, so the option has been dropped from settings entirely. */
type PreviewMode = "off" | "auto";

function previewModeOf(hero: DashboardLayout["hero"]): PreviewMode {
  return hero.trailerAutoplay ? "auto" : "off";
}

export function DashboardExperiencePanel() {
  const t = useT();
  const { locale } = useI18n();
  const { mutate } = useSWRConfig();
  const [layout, setLayout] = useState<DashboardLayout | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/dashboard/layout", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setLayout(d?.layout ?? DEFAULT_DASHBOARD_LAYOUT))
      .catch(() => setLayout(DEFAULT_DASHBOARD_LAYOUT));
  }, []);

  const save = async (patch: Partial<DashboardLayout>) => {
    if (!layout || saving) return;
    const previous = layout;
    const next = { ...layout, ...patch };
    setLayout(next);
    setSaving(true);
    try {
      const response = await fetch("/api/dashboard/layout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!response.ok) throw new Error("dashboard layout save failed");
      const saved = await response.json();
      setLayout(saved.layout);
      await mutate("/api/dashboard/layout", saved, { revalidate: false });
    } catch {
      setLayout(previous);
      toast("error", t("settings.dashboardExperience.saveError"));
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

  const seasonDates = layout?.seasonDates ?? { windows: {} };
  const saveSeasons = (next: SeasonSettings) => save({ seasonDates: next });

  if (!layout) return <div className="h-40 animate-pulse rounded-2xl glass" />;

  const preview = previewModeOf(layout.hero);
  const setPreview = (mode: PreviewMode) => {
    if (mode === "off") saveHero({ trailerAutoplay: false });
    else saveHero({ trailerAutoplay: true });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl glass p-5">
        <h3 className="mb-1 font-bold text-ink">{t("settings.dashboardExperience.trailerSearchTitle")}</h3>
        <p className="mb-4 text-sm text-ink-dim">{t("settings.dashboardExperience.trailerSearchHint")}</p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink">{t("settings.dashboardExperience.trailerSearchEnabled")}</span>
          <Toggle label={t("settings.dashboardExperience.trailerSearchEnabled")} on={layout.youtubeTrailerSearch} onChange={() => save({ youtubeTrailerSearch: !layout.youtubeTrailerSearch })} />
        </div>
      </div>

      <div className="rounded-2xl glass p-5">
        <h3 className="mb-4 font-bold text-ink">{t("settings.dashboardExperience.heroTitle")}</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink">{t("settings.dashboardExperience.heroEnabled")}</span>
            <Toggle label={t("settings.dashboardExperience.heroEnabled")} on={layout.hero.enabled} onChange={() => saveHero({ enabled: !layout.hero.enabled })} />
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
              {(["off", "auto"] as const).map((mode) => (
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
            <p className="mb-1 text-sm text-ink">{t("settings.dashboardExperience.minYearTitle")}</p>
            <p className="mb-2 text-xs text-ink-dim">{t("settings.dashboardExperience.minYearHint")}</p>
            <select
              value={layout.hero.minYear ?? 0}
              onChange={(e) => {
                const v = Number(e.target.value);
                saveHero({ minYear: v === 0 ? null : v });
              }}
              className="w-full rounded-xl border border-white/8 bg-black/20 px-3 py-2 text-sm font-semibold text-ink outline-none focus:border-brand/50 sm:w-56"
              style={{ colorScheme: "dark", backgroundColor: "#0a0a12", color: "#f5f5f7" }}
            >
              <option value={0} style={{ backgroundColor: "#0a0a12", color: "#f5f5f7" }}>{t("settings.dashboardExperience.minYearAll")}</option>
              {[1950, 1960, 1970, 1980, 1990, 2000, 2005, 2010, 2015, 2020, 2022, 2024].map((y) => (
                <option key={y} value={y} style={{ backgroundColor: "#0a0a12", color: "#f5f5f7" }}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <div>
            <p className="mb-1 text-sm text-ink">{t("settings.dashboardExperience.contentMixTitle")}</p>
            <p className="mb-2 text-xs text-ink-dim">{t("settings.dashboardExperience.contentMixHint")}</p>
            <div className="space-y-2">
              <label className="flex items-center justify-between gap-2">
                <span className="text-sm text-ink-soft">{t("settings.dashboardExperience.includeOwned")}</span>
                <Toggle label={t("settings.dashboardExperience.includeOwned")}
                  on={layout.hero.includeOwned}
                  disabled={layout.hero.includeOwned && !layout.hero.includeUnowned}
                  onChange={() => saveHero({ includeOwned: !layout.hero.includeOwned })}
                />
              </label>
              <label className="flex items-center justify-between gap-2">
                <span className="text-sm text-ink-soft">{t("settings.dashboardExperience.includeUnowned")}</span>
                <Toggle label={t("settings.dashboardExperience.includeUnowned")}
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
                <Toggle label={t(SECTION_LABEL_KEY[id])} on={section?.visible ?? true} onChange={() => toggleSection(id)} />
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl glass p-5">
        <h3 className="mb-1 font-bold text-ink">{t("settings.dashboardExperience.seasonDatesTitle")}</h3>
        <p className="mb-4 text-sm text-ink-dim">{t("settings.dashboardExperience.seasonDatesHint")}</p>
        <div className="space-y-4">
          {FIXED_SEASONS.map((id) => {
            const w = seasonDates.windows[id] ?? DEFAULT_SEASON_WINDOWS[id];
            const set = (patch: Partial<typeof w>) => saveSeasons({ ...seasonDates, windows: { ...seasonDates.windows, [id]: { ...w, ...patch } } });
            return (
              <div key={id} className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-sm font-semibold text-ink">{t(`settings.dashboardExperience.seasonName.${id}`)}</span>
                <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
                  <span>{t("settings.dashboardExperience.seasonFrom")}</span>
                  <DayMonthPicker locale={locale} value={w.start} label={t("settings.dashboardExperience.seasonFrom")} onChange={(start) => set({ start })} />
                  <span>{t("settings.dashboardExperience.seasonTo")}</span>
                  <DayMonthPicker locale={locale} value={w.end} label={t("settings.dashboardExperience.seasonTo")} onChange={(end) => set({ end })} />
                </div>
              </div>
            );
          })}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-sm font-semibold text-ink">{t("settings.dashboardExperience.seasonName.easter")}</span>
            <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
              {(["before", "after"] as const).map((side) => {
                const easter = seasonDates.easter ?? DEFAULT_EASTER_WINDOW;
                return (
                  <label key={side} className="inline-flex items-center gap-1.5">
                    <input type="number" min={0} max={60} value={easter[side]} aria-label={t(`settings.dashboardExperience.easter.${side}`)}
                      onChange={(e) => saveSeasons({ ...seasonDates, easter: { ...easter, [side]: Math.min(60, Math.max(0, Number(e.target.value) || 0)) } })}
                      className={cn(SELECT_CLASS, "w-16")} />
                    <span>{t(`settings.dashboardExperience.easter.${side}`)}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <button
            onClick={() => saveSeasons({ windows: {} })}
            className="rounded-lg border border-white/8 bg-black/20 px-3 py-1.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-white/5"
          >
            {t("settings.dashboardExperience.seasonReset")}
          </button>
        </div>
      </div>

      {saving && <p className="text-xs text-ink-dim">{t("common.saving")}</p>}
    </div>
  );
}
