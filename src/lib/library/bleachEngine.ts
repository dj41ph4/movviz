import { BLEACH_TMDB_ID, bleachToTmdb, needsBleachRepair } from "@/lib/metadata/bleachEpisodeOrder";
import { bleachReleaseTargets } from "./bleachRelease";
import { loadPlexConfig } from "@/lib/plex/store";
import { getPlexEpisodeOrdering } from "@/lib/plex/client";
import { getSeries, updateSeries } from "@/lib/library/store";
import { decodeLibraryRef, type LibrarySeries } from "@/lib/library/types";
import { requireEpisodePlacementCapability, type EngineEpisodeTarget, type EpisodePlacement } from "@/lib/engine/episodePlacement";

export function planBleachEngineTargets(targets: { season: number; episode: number }[], releaseTitle: string, order: string): EngineEpisodeTarget[] {
  if (!["tmdbAiring", "aired", "tvdbAiring"].includes(order)) throw new Error("bleach_plex_order_unverified");
  return bleachReleaseTargets(targets, releaseTitle).map(source => {
    const library = source.library;
    const tmdb = bleachToTmdb(library.season, library.episode);
    if (!tmdb) throw new Error("bleach_episode_unmapped");
    const placement = order === "tmdbAiring" ? { season: tmdb.seasonNumber, episode: tmdb.episodeNumber } : { ...library };
    return { ...source, placement };
  });
}

export async function bleachPhysicalOrder(series: LibrarySeries): Promise<string> {
  const cfg = loadPlexConfig();
  if (!cfg.hostname || !cfg.adminToken) return "tmdbAiring";
  if (!series.plexRatingKey) throw new Error("bleach_plex_order_unverified");
  const effective = await getPlexEpisodeOrdering(cfg, series.plexRatingKey, cfg.adminToken);
  if (!effective || !["tmdbAiring", "aired", "tvdbAiring"].includes(effective.order ?? "")) throw new Error("bleach_plex_order_unverified");
  return effective.order!;
}

export async function prepareBleachGrab(libraryRef: string, releaseTitle: string, single?: EngineEpisodeTarget, multiple?: EngineEpisodeTarget[]) {
  const ref = decodeLibraryRef(libraryRef);
  const series = ref && ref.kind !== "movie" ? getSeries(ref.seriesId) : null;
  if (!ref || ref.kind === "movie" || !series || series.tmdbId !== BLEACH_TMDB_ID) return { single, multiple, targets: null };
  if (needsBleachRepair(series)) throw new Error("bleach_repair_required");
  await requireEpisodePlacementCapability();
  const libraryTargets = ref.kind === "episode" ? [{ season: ref.season, episode: ref.episode }] : multiple ?? (single ? [single] : []);
  const targets = planBleachEngineTargets(libraryTargets, releaseTitle, await bleachPhysicalOrder(series));
  if (!targets.length) throw new Error("bleach_release_coverage_unverified");
  return ref.kind === "episode" ? { single: targets[0], multiple: undefined, targets } : { single: undefined, multiple: targets, targets };
}

export function markBleachGrabTargets(seriesId: string, infoHash: string, targets: EngineEpisodeTarget[]) {
  const series = getSeries(seriesId);
  if (!series || series.tmdbId !== BLEACH_TMDB_ID) return;
  updateSeries(seriesId, { seasons: series.seasons.map(s => ({ ...s, episodes: s.episodes.map(ep => {
    const target = targets.find(t => t.library?.season === s.seasonNumber && t.library.episode === ep.episodeNumber);
    if (!target?.library || !target.placement) return ep;
    const activeEpisodePlacement: EpisodePlacement = { source: { season: target.season, episode: target.episode }, library: target.library, placement: target.placement };
    return { ...ep, status: "downloading" as const, activeInfoHash: infoHash, activeReleaseEpisode: { seasonNumber: target.season, episodeNumber: target.episode }, activeEpisodePlacement };
  }) })) });
}
