import { BLEACH_TMDB_ID, bleachToTmdb, needsBleachRepair, isBleachSequelTitle } from "@/lib/metadata/bleachEpisodeOrder";
import { parseRelease } from "@/lib/naming/parser";
import { loadPlexConfig } from "@/lib/plex/store";
import { getPlexEpisodeOrdering } from "@/lib/plex/client";
import { getSeries, updateSeries } from "@/lib/library/store";
import { decodeLibraryRef, type LibrarySeries } from "@/lib/library/types";
import { requireEpisodePlacementCapability, type EngineEpisodeTarget, type EpisodePlacement } from "@/lib/engine/episodePlacement";

export function planBleachEngineTargets(targets: { season: number; episode: number }[], releaseTitle: string, order: string): EngineEpisodeTarget[] {
  if (!["tmdbAiring", "aired", "tvdbAiring"].includes(order)) throw new Error("bleach_plex_order_unverified");
  const parsed = parseRelease(releaseTitle);
  const sequel = isBleachSequelTitle(releaseTitle);
  let part = parsed.season ?? 1;
  if (/the[ ._-]*separation|ketsubetsu|訣別/i.test(releaseTitle)) part = 2;
  if (/the[ ._-]*conflict|soukoku|相剋/i.test(releaseTitle)) part = 3;
  if (/the[ ._-]*calamity|kashin|禍進/i.test(releaseTitle)) part = 4;
  const offsets = [0, 13, 26, 40], counts = [13, 13, 14, Infinity];
  return targets.flatMap(library => {
    const tmdb = bleachToTmdb(library.season, library.episode);
    if (!tmdb) throw new Error("bleach_episode_unmapped");
    let source = { ...library };
    if (sequel) {
      if (library.season !== 17) return [];
      if (parsed.season !== 17) {
        if (part < 1 || part > 4) throw new Error("bleach_release_order_unverified");
        const local = library.episode - offsets[part - 1];
        if (local < 1 || local > counts[part - 1]) return [];
        // A standalone cour uses its own SxxE01.. numbering. An explicitly
        // cumulative single episode remains cumulative, never guessed for packs.
        const cumulative = parsed.episode != null && parsed.episode > offsets[part - 1];
        source = { season: parsed.season ?? 1, episode: cumulative ? library.episode : local };
      }
    } else if (parsed.season != null && parsed.season !== library.season && !/(?:int[eé]grale|complete[ ._-]*series|all[ ._-]*seasons|S0?1[ ._-]*(?:to|a|à|-)[ ._-]*S?1[67])/i.test(releaseTitle)) return [];
    const placement = order === "tmdbAiring" ? { season: tmdb.seasonNumber, episode: tmdb.episodeNumber } : { ...library };
    return [{ ...source, library: { ...library }, placement }];
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
