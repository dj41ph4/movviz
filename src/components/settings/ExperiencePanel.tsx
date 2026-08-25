"use client";

import { useT } from "@/i18n/provider";
import { Toggle } from "@/components/ui/Toggle";
import { useTitlePageVideo } from "@/lib/settings/useTitlePageVideo";
import { useSpecialEpisodes } from "@/lib/settings/useSpecialEpisodes";
import { useEnhancedTrailerSources } from "@/lib/settings/useEnhancedTrailerSources";

/**
 * General viewing-experience preferences — cross-page personal toggles that
 * don't belong under "Tableau de bord" (dashboard layout/content) since
 * they affect other parts of the app entirely (title pages, series
 * watched-tracking everywhere). Split out from DashboardExperiencePanel,
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
  const enhancedTrailerSources = useEnhancedTrailerSources();

  return (
    <div className="space-y-6">
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

      <div className="rounded-2xl glass p-5">
        <h3 className="mb-1 font-bold text-ink">{t("settings.experience.enhancedTrailerSourcesTitle")}</h3>
        <p className="mb-4 text-sm text-ink-dim">{t("settings.experience.enhancedTrailerSourcesHint")}</p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink">{t("settings.experience.enhancedTrailerSourcesEnabled")}</span>
          <Toggle on={enhancedTrailerSources.enabled} onChange={() => enhancedTrailerSources.setEnabled(!enhancedTrailerSources.enabled)} />
        </div>
      </div>
    </div>
  );
}
