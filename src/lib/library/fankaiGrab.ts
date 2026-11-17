import { matchFankaiRelease } from "@/lib/metadata/fankai";
import { getSeriesByTmdbId } from "@/lib/library/store";
import type { LibraryRef, LibrarySeries } from "@/lib/library/types";

/**
 * A release picked in an indexer search that is a Fan-Kai version (« Death
 * Note Kaï - 03 - Second Kira », « Bleach Yabai Intégrale ») belongs to that
 * version's own fiche, whatever fiche or search it was picked from: its parts
 * are not the episodes of the series it is cut from. The version is added to
 * the library when it is not there yet (without an automatic search — the
 * person just chose the release), and the grab is tied to the part the name
 * gives, or to the whole version for a pack.
 *
 * Null when the name is no Fan-Kai version the wiki knows, or when the grab
 * already targets that version.
 */
export async function linkFankaiRelease(
  releaseTitle: string,
  current: LibrarySeries | null,
): Promise<{ series: LibrarySeries; ref: LibraryRef } | null> {
  const match = matchFankaiRelease(releaseTitle);
  if (!match) return null;
  const { entry, part } = match;
  let series = getSeriesByTmdbId(entry.id);
  if (!series) {
    const { addSeriesToLibrary } = await import("@/lib/library/autoGrabSeries");
    const added = await addSeriesToLibrary(entry.id, current?.qualityProfileId, undefined, { skipSearch: true });
    if (!("series" in added) || !added.series) return null;
    series = added.series;
  }
  if (current?.id === series.id) return null;
  const hasPart = part != null && series.seasons.some((s) => s.seasonNumber === 1 && s.episodes.some((e) => e.episodeNumber === part));
  return {
    series,
    ref: hasPart ? { kind: "episode", seriesId: series.id, season: 1, episode: part! } : { kind: "series", seriesId: series.id },
  };
}
