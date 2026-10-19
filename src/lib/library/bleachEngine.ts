import { parseRelease } from "@/lib/naming/parser";
import { BLEACH_TMDB_ID, bleachToTmdb, bleachCourForEpisode, needsBleachRepair } from "@/lib/metadata/bleachEpisodeOrder";
import { bleachFilePresentation } from "@/lib/metadata/bleachPlexIdentity";
import { bleachReleaseTargets } from "./bleachRelease";
import { loadPlexConfig } from "@/lib/plex/store";
import { getPlexEpisodeOrdering } from "@/lib/plex/client";
import { getSeries, updateSeries } from "@/lib/library/store";
import { decodeLibraryRef, type LibrarySeries } from "@/lib/library/types";
import { requireEpisodePlacementCapability, type EngineEpisodeTarget, type EpisodePlacement } from "@/lib/engine/episodePlacement";

export function planBleachEngineTargets(targets: { season: number; episode: number }[], releaseTitle: string, order: string, separateFolders = false): EngineEpisodeTarget[] {
  if (!["tmdbAiring", "aired", "tvdbAiring"].includes(order)) throw new Error("bleach_plex_order_unverified");
  const parsed = parseRelease(releaseTitle), range = /\bS(\d{1,2})\s*(?:[-–]|to|a|à)\s*S?(\d{1,2})\b/i.test(releaseTitle);
  const absoluteSource = (t: EngineEpisodeTarget) => t.season === 1 && t.library != null && t.library.season !== 1;
  const sources = bleachReleaseTargets(targets, releaseTitle);
  const absolutePack = sources.some(absoluteSource);
  return sources.map(source => {
    const library = source.library;
    const tmdb = bleachToTmdb(library.season, library.episode);
    if (!tmdb) throw new Error("bleach_episode_unmapped");
    const placement = separateFolders && library.season !== 17
      ? { ...library }
      : order === "tmdbAiring" ? { season: tmdb.seasonNumber, episode: tmdb.episodeNumber } : { ...library };
    if (separateFolders) {
      const sequel = library.season === 17;
      const cour = sequel ? bleachCourForEpisode(library.episode) : null;
      if (sequel && !cour) throw new Error("bleach_episode_unmapped");
      return { ...source, placement: cour ? { season: cour.part, episode: library.episode - cour.offset } : placement, presentation: bleachFilePresentation(sequel ? "tybw" : "original") };
    }
    return { ...source, placement };
  }).map(target => {
    const lib = target.library;
    if (!lib) return target;
    // Season-less files are filed by absolute index only when the release itself
    // is not season-qualified (a "Bleach.S03.COMPLETE" keeps local numbering).
    if (lib.season === 17) return target.season === 17 ? { ...target, absolute: lib.episode } : target;
    const abs = bleachToTmdb(lib.season, lib.episode);
    const qualified = parsed.season != null && !range && !absolutePack;
    return abs && !qualified ? { ...target, absolute: abs.episodeNumber } : target;
  });
}

export async function bleachPhysicalOrder(series: LibrarySeries): Promise<string> {
  const cfg = loadPlexConfig();
  if (!cfg.hostname || !cfg.adminToken) return "tvdbAiring";
  const originalKey = series.bleachPlexKeys?.original ?? series.plexRatingKey;
  // A first acquisition has no Plex show to inspect yet. Use the same 16
  // season aired order Movviz presents, so an absolute S01E001-S01E366 pack
  // is filed into Season 01 through Season 16 instead of one giant Season 01.
  if (!originalKey) return "tvdbAiring";
  const effective = await getPlexEpisodeOrdering(cfg, originalKey, cfg.adminToken);
  if (!effective || effective.seriesPart === "tybw" || !["tmdbAiring", "aired", "tvdbAiring"].includes(effective.order ?? "")) throw new Error("bleach_plex_order_unverified");
  return effective.order!;
}

export async function prepareBleachGrab(libraryRef: string, releaseTitle: string, single?: EngineEpisodeTarget, multiple?: EngineEpisodeTarget[]) {
  const ref = decodeLibraryRef(libraryRef);
  const series = ref && ref.kind !== "movie" ? getSeries(ref.seriesId) : null;
  if (!ref || ref.kind === "movie" || !series || series.tmdbId !== BLEACH_TMDB_ID) return { single, multiple, targets: null };
  if (needsBleachRepair(series)) throw new Error("bleach_repair_required");
  await requireEpisodePlacementCapability(true);
  const libraryTargets = ref.kind === "episode" ? [{ season: ref.season, episode: ref.episode }] : multiple ?? (single ? [single] : []);
  // Standalone TYBW has its own 1-based cours even while the original Plex
  // show's configured order may be TMDb's single season or TVDB's 16 seasons.
  const order = libraryTargets.every(t => t.season === 17) ? "tmdbAiring" : await bleachPhysicalOrder(series);
  const targets = planBleachEngineTargets(libraryTargets, releaseTitle, order, true);
  if (!targets.length) throw new Error("bleach_release_coverage_unverified");
  return ref.kind === "episode" ? { single: targets[0], multiple: undefined, targets } : { single: undefined, multiple: targets, targets };
}

export function markBleachGrabTargets(seriesId: string, infoHash: string, targets: EngineEpisodeTarget[]) {
  const series = getSeries(seriesId);
  if (!series || series.tmdbId !== BLEACH_TMDB_ID) return;
  updateSeries(seriesId, { seasons: series.seasons.map(s => ({ ...s, episodes: s.episodes.map(ep => {
    const target = targets.find(t => t.library?.season === s.seasonNumber && t.library.episode === ep.episodeNumber);
    if (!target?.library || !target.placement) return ep;
    const activeEpisodePlacement: EpisodePlacement = { source: { season: target.season, episode: target.episode }, library: target.library, placement: target.placement, ...(target.presentation ? { presentation: target.presentation } : {}) };
    return { ...ep, status: "downloading" as const, activeInfoHash: infoHash, activeReleaseEpisode: { seasonNumber: target.season, episodeNumber: target.episode }, activeEpisodePlacement };
  }) })) });
}
