"use client";

import { useT } from "@/i18n/provider";
import { cn } from "@/lib/utils";
import { Toggle } from "@/components/ui/Toggle";
import { useTitlePageVideo } from "@/lib/settings/useTitlePageVideo";
import { useSpecialEpisodes } from "@/lib/settings/useSpecialEpisodes";
import { useCdnImages } from "@/lib/settings/useCdnImages";
import { useLocalNetworkPriority } from "@/lib/settings/useLocalNetworkPriority";

/**
 * General viewing-experience preferences — cross-page personal toggles that
 * don't belong under "Tableau de bord" (dashboard layout/content) since
 * they affect other parts of the app entirely (title pages, series
 * watched-tracking everywhere). Split out from DashboardExperiencePanel,
 * which had been accumulating unrelated toggles under a name that only
 * ever meant "dashboard" — this tab is where anything in that same
 * "how Movviz behaves for me, not what admins configure" spirit belongs
 * going forward.
 */
export function ExperiencePanel() {
  const t = useT();
  const titlePageVideo = useTitlePageVideo();
  const specialEpisodes = useSpecialEpisodes();
  const cdnImages = useCdnImages();
  const localNetworkPriority = useLocalNetworkPriority();

  return (
    <div className="space-y-6">
      <div className="rounded-2xl glass p-5">
        <h3 className="mb-1 font-bold text-ink">{t("settings.experience.cdnImagesTitle")}</h3>
        <p className="mb-4 text-sm text-ink-dim">{t("settings.experience.cdnImagesHint")}</p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink">{t("settings.experience.cdnImagesEnabled")}</span>
          <Toggle on={cdnImages.enabled} onChange={() => cdnImages.setEnabled(!cdnImages.enabled)} />
        </div>
        <div className={cn("mt-4 border-t border-white/8 pt-4", !cdnImages.enabled && "opacity-40")}>
          <p className="mb-3 text-xs text-ink-dim">{t("settings.experience.localNetworkPriorityHint")}</p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink">{t("settings.experience.localNetworkPriorityTitle")}</span>
            <Toggle
              on={localNetworkPriority.enabled}
              disabled={!cdnImages.enabled}
              onChange={() => localNetworkPriority.setEnabled(!localNetworkPriority.enabled)}
            />
          </div>
        </div>
      </div>

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
