"use client";

import { useT } from "@/i18n/provider";
import { Toggle } from "@/components/ui/Toggle";
import { useTitlePageVideo } from "@/lib/settings/useTitlePageVideo";
import { useSpecialEpisodes } from "@/lib/settings/useSpecialEpisodes";
import { useCardTrailerZoom } from "@/lib/settings/useCardTrailerZoom";
import { TrailerHeader } from "@/components/media/TrailerHeader";

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
  const cardTrailerZoom = useCardTrailerZoom();

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
        <h3 className="mb-1 font-bold text-ink">{t("settings.experience.cardTrailerZoomTitle")}</h3>
        <p className="mb-4 text-sm text-ink-dim">{t("settings.experience.cardTrailerZoomHint")}</p>
        <div className="flex items-center gap-4">
          <input aria-label={t("settings.experience.cardTrailerZoomTitle")} type="range" min="-100" max="100" step="1" value={cardTrailerZoom.offset} onChange={(event) => cardTrailerZoom.setOffset(Number(event.target.value))} className="w-full accent-brand" />
          <output className="w-14 text-right text-sm font-bold text-ink">{cardTrailerZoom.offset > 0 ? `+${cardTrailerZoom.offset}` : cardTrailerZoom.offset}</output>
        </div>
        <div className="mt-5 overflow-hidden rounded-xl border border-white/10">
          <div className="aspect-video">
            <TrailerHeader backdropPath={null} size="w780" trailerKeys={["opI0klN3-Pw"]} title="Avengers : Doomsday" trigger="immediate" cardTrailerZoomOffset={cardTrailerZoom.offset} largeViewport className="h-full w-full" />
          </div>
          <p className="px-3 py-2 text-xs text-ink-dim">Avengers : Doomsday — aperçu de réglage en direct</p>
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
