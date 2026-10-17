import { createHash } from "node:crypto";
import type { LibraryEpisode, LibrarySeason, LibrarySeries } from "./types";
import { BLEACH_TMDB_ID, bleachFromTmdb, detectBleachLibraryOrder } from "@/lib/metadata/bleachEpisodeOrder";

export interface BleachTrackedCoordinate {
  store: string;
  seasonNumber: number;
  episodeNumber: number;
}

/** Pure preview. No positional carry-over, filesystem writes or user decisions. */
export function planBleachRepair(series: LibrarySeries, tracked: BleachTrackedCoordinate[], stateFingerprint = "") {
  const order = detectBleachLibraryOrder(series);
  const blockers: string[] = [];
  if (series.tmdbId !== BLEACH_TMDB_ID) blockers.push("not_bleach");
  if (order !== "tmdb") blockers.push(order === "tvdb" ? "already_repaired" : "ambiguous_library_order");
  const seasons = new Map<number, LibrarySeason>();
  const moves: { fromSeason: number; fromEpisode: number; toSeason: number; toEpisode: number }[] = [];
  for (const season of series.seasons) {
    for (const episode of season.episodes) {
      if (episode.status === "downloading" || episode.status === "searching" || episode.activeInfoHash) blockers.push("active_download");
      const target = bleachFromTmdb(season.seasonNumber, episode.episodeNumber);
      if (!target) { blockers.push("unmapped_episode"); continue; }
      let destination = seasons.get(target.seasonNumber);
      if (!destination) {
        destination = {
          seasonNumber: target.seasonNumber,
          name: target.seasonNumber === 0 ? season.name : target.seasonNumber === 17 ? "Bleach: Thousand-Year Blood War" : `Bleach · ${target.seasonNumber}`,
          monitored: season.monitored,
          episodes: [],
        };
        seasons.set(target.seasonNumber, destination);
      }
      if (destination.episodes.some((e) => e.episodeNumber === target.episodeNumber)) { blockers.push("duplicate_episode"); continue; }
      // Preserve file, Plex identity, timestamps, monitoring and every optional field.
      destination.episodes.push({ ...episode, ...target } satisfies LibraryEpisode);
      moves.push({ fromSeason: season.seasonNumber, fromEpisode: episode.episodeNumber, toSeason: target.seasonNumber, toEpisode: target.episodeNumber });
    }
  }
  // No provenance is needed for the unchanged S0 and S1E1–20 prefix. Other
  // tracked coordinates might already be TVDB (Plex) despite a TMDb library;
  // moving these blindly would assign one person's watched state to TYBW.
  const ambiguous = tracked.filter((e) => e.seasonNumber !== 0 && !(e.seasonNumber === 1 && e.episodeNumber >= 1 && e.episodeNumber <= 20));
  if (ambiguous.length) blockers.push("ambiguous_user_history");
  const next: LibrarySeries = { ...series, episodeOrder: "tvdb", seasons: [...seasons.values()].sort((a, b) => a.seasonNumber - b.seasonNumber) };
  const fingerprint = createHash("sha256").update(JSON.stringify({ series, tracked, stateFingerprint })).digest("hex");
  return {
    applicable: blockers.length === 0,
    blockers: [...new Set(blockers)], fingerprint, seriesId: series.id,
    episodes: moves.length, movedEpisodes: moves.filter((m) => m.fromSeason !== m.toSeason || m.fromEpisode !== m.toEpisode).length,
    preservedFiles: moves.length ? series.seasons.flatMap((s) => s.episodes).filter((e) => e.file).length : 0,
    preservedPlexLinks: series.seasons.flatMap((s) => s.episodes).filter((e) => e.plexRatingKey).length,
    preservedTracking: tracked.length - ambiguous.length,
    ambiguousTracking: ambiguous.map((e) => ({ store: e.store, season: e.seasonNumber, episode: e.episodeNumber })),
    seasons: next.seasons.map((s) => ({ seasonNumber: s.seasonNumber, name: s.name, episodes: s.episodes.length })),
    moves, next,
  };
}
