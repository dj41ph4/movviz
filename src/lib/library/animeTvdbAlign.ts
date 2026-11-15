import { loadSeries } from "@/lib/library/store";
import { getSeries as fetchTmdbSeries } from "@/lib/metadata/tmdb";
import { tvdbConfigured } from "@/lib/metadata/tvdb";
import { BLEACH_TMDB_ID } from "@/lib/metadata/bleachEpisodeOrder";
import { yieldToEventLoop } from "@/lib/jobs/cancelScope";
import { plexConfigured, loadPlexConfig } from "@/lib/plex/store";

export interface AnimeAlignSummary {
  checked: number;
  changed: number;
  needsReview: string[];
  plexOrdersApplied: number;
}

/**
 * Brings every anime of the library onto its TVDB structure — Movviz first
 * (episodes, files moved and renamed), then Plex's episode order — the way
 * a resync click would, for titles added before any of this existed.
 *
 * Scheduled pass (`background`): never trashes anything; a show holding
 * duplicate copies is reported and waits for « Resynchroniser avec TVDB ».
 * Plex is optional: without it (or offline) the order stays pending and the
 * next Plex sync that reaches the server applies it.
 */
export async function alignAnimeLibraryOnTvdb(opts: { background: boolean; onProgress?: (done: number, total: number) => void }): Promise<AnimeAlignSummary> {
  const summary: AnimeAlignSummary = { checked: 0, changed: 0, needsReview: [], plexOrdersApplied: 0 };
  if (!tvdbConfigured()) return summary;
  const { resyncAnimeSeasonsFromTvdb } = await import("@/lib/library/autoGrabSeries");
  const all = loadSeries().filter((s) => s.tmdbId !== BLEACH_TMDB_ID);
  let done = 0;
  for (const series of all) {
    await yieldToEventLoop();
    opts.onProgress?.(++done, all.length);
    const isAnime = series.isAnime ?? (await fetchTmdbSeries(series.tmdbId).catch(() => null))?.isAnime ?? false;
    if (!isAnime) continue;
    summary.checked++;
    const result = await resyncAnimeSeasonsFromTvdb(series.id, { background: opts.background }).catch(() => null);
    if (result?.ok && !result.unchanged) summary.changed++;
    if (result && !result.ok && result.error === "needs_review") summary.needsReview.push(series.title);
  }
  if (plexConfigured()) {
    const cfg = loadPlexConfig();
    const { applyPendingPlexOrdering } = await import("@/lib/plex/librarySync");
    if (cfg.adminToken) summary.plexOrdersApplied = await applyPendingPlexOrdering(cfg, cfg.adminToken, Number.MAX_SAFE_INTEGER).catch(() => 0);
  }
  return summary;
}
