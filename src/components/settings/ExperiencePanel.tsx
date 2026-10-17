"use client";

import { useT } from "@/i18n/provider";
import { Toggle } from "@/components/ui/Toggle";
import { useTitlePageVideo } from "@/lib/settings/useTitlePageVideo";
import { useSpecialEpisodes } from "@/lib/settings/useSpecialEpisodes";
import { useDesignMode } from "@/components/appearance/AppearanceProvider";
import { DESIGN_MODES } from "@/lib/appearance/designMode";
import { cn } from "@/lib/utils";

/**
 * General viewing-experience preferences — cross-page personal toggles that
 * don't belong under "Tableau de bord" (dashboard layout/content) since
 * they affect title pages and the visibility of special seasons.
 * Split out from DashboardExperiencePanel,
 * which had been accumulating unrelated toggles under a name that only
 * ever meant "dashboard" — this tab is where anything in that same
 * "how Movviz behaves for me, not what admins configure" spirit belongs
 * going forward.
 *
 * The CDN-images toggle used to live here — moved to Réglages → Cache
 * (admin-only, CachePanel.tsx) in 2026-08: it's a server-wide bandwidth/
 * load decision (which route every user's image requests take), not a
 * personal preference, so it never belonged in a per-user panel.
 */
export function ExperiencePanel() {
  const t = useT();
  const titlePageVideo = useTitlePageVideo();
  const specialEpisodes = useSpecialEpisodes();
  const design = useDesignMode();

  return (
    <div className="space-y-6">
      <section className="rounded-2xl glass p-5" aria-labelledby="design-mode-title" aria-busy={design.saving}>
        <h3 id="design-mode-title" className="mb-1 font-bold text-ink">{t("settings.experience.designTitle")}</h3>
        <p className="mb-4 text-sm text-ink-dim">{t("settings.experience.designHint")}</p>
        <fieldset disabled={!design.loaded || design.saving}>
          <legend className="sr-only">{t("settings.experience.designTitle")}</legend>
          <div className="grid gap-3 md:grid-cols-2">
            {DESIGN_MODES.map((mode) => (
              <label key={mode} className={cn("flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border p-4", design.mode === mode ? "border-brand/50 bg-brand/10 text-ink" : "border-white/10 text-ink-soft", (!design.loaded || design.saving) && "cursor-wait opacity-70")}>
                <input type="radio" name="design-mode" value={mode} checked={design.mode === mode} onChange={() => void design.setMode(mode)} className="mt-1 accent-brand" />
                <span>
                  <span className="block text-sm font-semibold">{t(mode === "stable" ? "settings.experience.designStable" : "settings.experience.designBeta")}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-ink-dim">{t(mode === "stable" ? "settings.experience.designStableHint" : "settings.experience.designBetaHint")}</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <div className="rounded-2xl glass p-5">
        <h3 className="mb-1 font-bold text-ink">{t("settings.experience.titlePageVideoTitle")}</h3>
        <p className="mb-4 text-sm text-ink-dim">{t("settings.experience.titlePageVideoHint")}</p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink">{t("settings.experience.titlePageVideoEnabled")}</span>
          <Toggle on={titlePageVideo.enabled} onChange={() => titlePageVideo.setEnabled(!titlePageVideo.enabled)} />
        </div>
      </div>

      <div className="rounded-2xl glass p-5">
        <h3 className="mb-1 font-bold text-ink">{t("settings.experience.specialEpisodesTitle")}</h3>
        <p className="mb-4 text-sm text-ink-dim">{t("settings.experience.specialEpisodesHint")}</p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink">{t("settings.experience.specialEpisodesEnabled")}</span>
          <Toggle on={specialEpisodes.enabled} onChange={() => specialEpisodes.setEnabled(!specialEpisodes.enabled)} />
        </div>
      </div>
    </div>
  );
}
