import path from "node:path";
import { getSeries, updateSeries } from "@/lib/library/store";
import type { LibraryEpisode, LibrarySeason, LibrarySeries } from "@/lib/library/types";
import { parseRelease } from "@/lib/naming/parser";
import { getSeason } from "@/lib/metadata/tmdb";
import { getOrProbeMediaDescriptor } from "@/lib/playback/engine/mediaProbeCache";
import { withKeyLock } from "@/lib/library/locks";

export interface CombinedEpisodeCandidate {
  seasonNumber: number;
  sources: LibraryEpisode[];
  hasFinalMarker: boolean;
}

/** Only a verified persisted pair sharing the exact same file may share a
 * watched result or be skipped as one unit by Next Episode. */
export function combinedEpisodePeers(series: LibrarySeries, seasonNumber: number, episodeNumber: number): number[] {
  const season = series.seasons.find((item) => item.seasonNumber === seasonNumber);
  const current = season?.episodes.find((item) => item.episodeNumber === episodeNumber);
  const group = current?.combinedFile;
  if (!season || !current?.file || !group || group.lastEpisodeNumber !== group.firstEpisodeNumber + 1 || episodeNumber < group.firstEpisodeNumber || episodeNumber > group.lastEpisodeNumber) return [episodeNumber];
  const peers = season.episodes.filter((item) => item.episodeNumber >= group.firstEpisodeNumber && item.episodeNumber <= group.lastEpisodeNumber &&
    item.status === "available" && item.file?.path === current.file?.path &&
    item.combinedFile?.fileEpisodeNumber === group.fileEpisodeNumber &&
    item.combinedFile?.firstEpisodeNumber === group.firstEpisodeNumber &&
    item.combinedFile?.lastEpisodeNumber === group.lastEpisodeNumber);
  return peers.length === 2 ? peers.map((item) => item.episodeNumber).sort((a, b) => a - b) : [episodeNumber];
}

/** A half-downloaded season must not be mistaken for a season of double files.
 * This only admits a complete, consecutive 1..N file set against exactly 2N
 * catalog entries, with the second half truly absent and no active grabs. */
export function combinedEpisodeCandidate(series: LibrarySeries, season: LibrarySeason): CombinedEpisodeCandidate | null {
  if (series.episodeOrder === "tvdb" || series.isAnime || season.seasonNumber < 1) return null;
  const ordered = [...season.episodes].sort((a, b) => a.episodeNumber - b.episodeNumber);
  const count = ordered.length;
  if (count < 6 || count % 2 !== 0) return null;
  const sourceCount = count / 2;
  if (ordered.some((ep, i) => ep.episodeNumber !== i + 1 || ep.seasonNumber !== season.seasonNumber || ep.combinedFile || ep.activeInfoHash || ep.status === "searching" || ep.status === "downloading" || ep.status === "upcoming")) return null;
  const sources = ordered.slice(0, sourceCount);
  const missing = ordered.slice(sourceCount);
  if (missing.some((ep) => ep.file || ep.plexRatingKey || ep.status !== "missing")) return null;
  const paths = new Set<string>();
  for (const [i, ep] of sources.entries()) {
    const filePath = ep.file?.diskPath ?? ep.file?.path;
    if (ep.status !== "available" || !filePath || !path.isAbsolute(filePath)) return null;
    const parsed = parseRelease(path.basename(filePath));
    if (parsed.season !== season.seasonNumber || parsed.episode !== i + 1 || parsed.episodeEnd != null) return null;
    const key = path.normalize(filePath).toLowerCase();
    if (paths.has(key)) return null;
    paths.add(key);
  }
  const lastName = path.basename(sources[sourceCount - 1].file!.diskPath ?? sources[sourceCount - 1].file!.path);
  return { seasonNumber: season.seasonNumber, sources, hasFinalMarker: /(?:^|[.\s_-])final(?:[.\s_-]|$)/i.test(lastName) };
}

/** Durations are measured on the actual files, not inferred from size/name.
 * FINAL is a useful extra clue, but never overrides contradictory durations. */
export function durationsConfirmCombinedEpisodes(
  candidate: CombinedEpisodeCandidate,
  catalogMinutes: Array<number | null>,
  fileDurationsMs: Array<number | null>,
): boolean {
  const count = candidate.sources.length;
  if (catalogMinutes.length !== count * 2 || fileDurationsMs.length !== count) return false;
  const ratios: number[] = [];
  for (let i = 0; i < count; i++) {
    const first = catalogMinutes[i * 2];
    const second = catalogMinutes[i * 2 + 1];
    const actual = fileDurationsMs[i];
    if (!first || !second || !actual || first < 3 || second < 3 || actual < 1) return false;
    ratios.push(actual / ((first + second) * 60_000));
  }
  // With FINAL, allow one outlier (a longer finale or unusual credits). A
  // non-FINAL pack requires every file to corroborate the 2:1 hypothesis.
  const inRange = ratios.filter((ratio) => ratio >= 0.78 && ratio <= 1.22).length;
  return candidate.hasFinalMarker
    ? inRange >= count - 1 && ratios.every((ratio) => ratio >= 0.68 && ratio <= 1.32)
    : inRange === count;
}

export function mapCombinedSeason(season: LibrarySeason, candidate: CombinedEpisodeCandidate): LibrarySeason {
  return {
    ...season,
    doubleEpisodesMode: season.doubleEpisodesMode ?? "auto",
    episodes: season.episodes.map((ep) => {
      const sourceIndex = Math.ceil(ep.episodeNumber / 2) - 1;
      const source = candidate.sources[sourceIndex];
      if (!source?.file) return ep;
      return {
        ...ep,
        status: "available" as const,
        file: source.file,
        activeInfoHash: null,
        lastImportedInfoHash: source.lastImportedInfoHash,
        playbackSource: source.playbackSource,
        plexRatingKey: source.plexRatingKey,
        combinedFile: {
          fileEpisodeNumber: sourceIndex + 1,
          firstEpisodeNumber: sourceIndex * 2 + 1,
          lastEpisodeNumber: sourceIndex * 2 + 2,
        },
      };
    }),
  };
}

/** Call under the series lock (the import callback already owns it). */
export async function repairCombinedEpisodesUnderLock(seriesId: string, onlySeasonNumber?: number): Promise<number> {
  let repaired = 0;
  const original = getSeries(seriesId);
  if (!original) return 0;
  for (const season of original.seasons) {
    if ((onlySeasonNumber != null && season.seasonNumber !== onlySeasonNumber) || season.doubleEpisodesMode === "off") continue;
    const candidate = combinedEpisodeCandidate(original, season);
    if (!candidate) continue;
    try {
      if (season.doubleEpisodesMode !== "manual") {
        const meta = await getSeason(original.tmdbId, season.seasonNumber);
        if (!meta) continue;
        const byNumber = new Map(meta.episodes.map((ep) => [ep.episodeNumber, ep.runtime]));
        const catalogMinutes = season.episodes
          .slice().sort((a, b) => a.episodeNumber - b.episodeNumber)
          .map((ep) => byNumber.get(ep.episodeNumber) ?? null);
        const durations = await Promise.all(candidate.sources.map(async (ep) => {
          const filePath = ep.file!.diskPath ?? ep.file!.path;
          const descriptor = await getOrProbeMediaDescriptor(`${original.id}:s${season.seasonNumber}e${ep.episodeNumber}`, filePath, false, { priority: "background" });
          return descriptor?.durationMs ?? null;
        }));
        if (!durationsConfirmCombinedEpisodes(candidate, catalogMinutes, durations)) continue;
      }
      // Metadata/probing awaited I/O. Re-check before writing so a concurrent
      // replacement or library scan cannot be overwritten with stale paths.
      const fresh = getSeries(seriesId);
      const freshSeason = fresh?.seasons.find((s) => s.seasonNumber === season.seasonNumber);
      const freshCandidate = fresh && freshSeason ? combinedEpisodeCandidate(fresh, freshSeason) : null;
      if (!fresh || !freshCandidate || freshCandidate.sources.some((ep, i) => ep.file?.path !== candidate.sources[i].file?.path)) continue;
      const seasons = fresh.seasons.map((s) => s.seasonNumber === season.seasonNumber ? mapCombinedSeason(s, freshCandidate) : s);
      updateSeries(seriesId, { seasons });
      repaired++;
    } catch (error) {
      console.warn(`[combined-episodes] S${season.seasonNumber} ${original.title}:`, error);
    }
  }
  return repaired;
}

export function repairCombinedEpisodes(seriesId: string): Promise<number> {
  return withKeyLock(`series:${seriesId}`, () => repairCombinedEpisodesUnderLock(seriesId));
}

/** Turn one season's switch off without touching files or watch history.
 * Refuse a partial reversal if a pair has been replaced since it was mapped. */
export function removeCombinedEpisodeMappingUnderLock(seriesId: string, seasonNumber: number): { ok: true; seasons: number } | { ok: false; error: "modified_pair" | "not_found" } {
  const series = getSeries(seriesId);
  if (!series) return { ok: false, error: "not_found" };
  const target = series.seasons.find((season) => season.seasonNumber === seasonNumber);
  if (!target) return { ok: false, error: "not_found" };
  const mapped = target.episodes.some((ep) => ep.combinedFile) ? [target] : [];
  const replacements = new Map<number, LibrarySeason>();
  for (const season of mapped) {
    const count = season.episodes.length;
    if (count % 2 !== 0) return { ok: false, error: "modified_pair" };
    const sourceCount = count / 2;
    const sources = new Map<number, LibraryEpisode>();
    for (let i = 1; i <= sourceCount; i++) {
      const first = season.episodes.find((ep) => ep.episodeNumber === i * 2 - 1);
      const second = season.episodes.find((ep) => ep.episodeNumber === i * 2);
      if (!first?.file || !second?.file || first.file.path !== second.file.path ||
        first.combinedFile?.fileEpisodeNumber !== i || second.combinedFile?.fileEpisodeNumber !== i ||
        combinedEpisodePeers(series, season.seasonNumber, first.episodeNumber).length !== 2) return { ok: false, error: "modified_pair" };
      sources.set(i, first);
    }
    replacements.set(season.seasonNumber, {
      ...season,
      doubleEpisodesMode: "off",
      episodes: season.episodes.map((ep) => {
        if (ep.episodeNumber > sourceCount) return { ...ep, status: "missing" as const, file: null, plexRatingKey: null, playbackSource: null, combinedFile: undefined, lastImportedInfoHash: null };
        const source = sources.get(ep.episodeNumber)!;
        return { ...ep, status: "available" as const, file: source.file, plexRatingKey: source.plexRatingKey, playbackSource: source.playbackSource, combinedFile: undefined, lastImportedInfoHash: source.lastImportedInfoHash };
      }),
    });
  }
  updateSeries(seriesId, { seasons: series.seasons.map((season) => replacements.get(season.seasonNumber) ?? (season.seasonNumber === seasonNumber ? { ...season, doubleEpisodesMode: "off" } : season)) });
  return { ok: true, seasons: mapped.length };
}
