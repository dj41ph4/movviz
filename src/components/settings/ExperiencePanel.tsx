"use client";

import { cn } from "@/lib/utils";
import { useT } from "@/i18n/provider";
import { Toggle } from "@/components/ui/Toggle";
import { useTitlePageVideo } from "@/lib/settings/useTitlePageVideo";
import { useSpecialEpisodes } from "@/lib/settings/useSpecialEpisodes";
import { useGpu } from "@/lib/gpu/GpuProvider";

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
  const gpu = useGpu();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl glass p-5">
        <h3 className="mb-1 font-bold text-ink">{t("settings.experience.smoothModeTitle")}</h3>
        <p className="mb-4 text-sm text-ink-dim">{t("settings.experience.smoothModeHint")}</p>
        <div role="radiogroup" aria-label={t("settings.experience.smoothModeTitle")} className="grid gap-2 sm:grid-cols-3">
          {(["full", "balanced", "smooth"] as const).map((level) => {
            const active = gpu.effectsLevel === level;
            return (
              <button
                key={level}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => gpu.setEffectsLevel(level)}
                className={cn(
                  "rounded-xl border px-4 py-3 text-left transition-colors ring-focus",
                  active ? "border-brand/40 bg-brand/12" : "border-white/8 bg-black/20 hover:border-white/20"
                )}
              >
                <span className={cn("block text-sm font-bold", active ? "text-brand-glow" : "text-ink")}>{t(`settings.experience.effects.${level}`)}</span>
                <span className="mt-1 block text-xs leading-relaxed text-ink-dim">{t(`settings.experience.effects.${level}Hint`)}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl glass p-5">
        <h3 className="mb-1 font-bold text-ink">{t("settings.experience.titlePageVideoTitle")}</h3>
        <p className="mb-4 text-sm text-ink-dim">{t("settings.experience.titlePageVideoHint")}</p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink">{t("settings.experience.titlePageVideoEnabled")}</span>
          <Toggle label={t("settings.experience.titlePageVideoEnabled")} on={titlePageVideo.enabled} disabled={!titlePageVideo.loaded} onChange={() => titlePageVideo.setEnabled(!titlePageVideo.enabled)} />
        </div>
      </div>

      <div className="rounded-2xl glass p-5">
        <h3 className="mb-1 font-bold text-ink">{t("settings.experience.specialEpisodesTitle")}</h3>
        <p className="mb-4 text-sm text-ink-dim">{t("settings.experience.specialEpisodesHint")}</p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink">{t("settings.experience.specialEpisodesEnabled")}</span>
          <Toggle label={t("settings.experience.specialEpisodesEnabled")} on={specialEpisodes.enabled} onChange={() => specialEpisodes.setEnabled(!specialEpisodes.enabled)} />
        </div>
      </div>
    </div>
  );
}
