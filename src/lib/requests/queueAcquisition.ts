import { searchAndGrabMovie } from "@/lib/library/autoGrab";
import { searchAndGrabSeries } from "@/lib/library/autoGrabSeries";
import { getMovie, getSeries } from "@/lib/library/store";
import { activeJobForSource, enqueueJob, isJobCancelled } from "@/lib/jobs/queue";
import type { LibraryMovie, LibrarySeries } from "@/lib/library/types";
import { BLEACH_TMDB_ID } from "@/lib/metadata/bleachEpisodeOrder";
import { scopedBleachSeries, type BleachSeriesPart } from "@/lib/library/bleachScope";

/** An explicit download survives the client's HTTP timeout/navigation. */
export function queueAcquisition(type: "movie" | "series", item: LibraryMovie | LibrarySeries, seriesPart?: BleachSeriesPart) {
  const stored = type === "movie" ? getMovie(item.id) : getSeries(item.id);
  const fresh = stored && "seasons" in stored && stored.tmdbId === BLEACH_TMDB_ID ? scopedBleachSeries(stored, seriesPart) : stored;
  if (!fresh?.monitored) return null;
  const missing = "seasons" in fresh
    ? fresh.seasons.some((s) => s.monitored && s.episodes.some((e) => e.monitored && e.status === "missing"))
    : fresh.status === "missing";
  if (!missing) return null;

  const sourceId = `acquisition-${type}-${item.id}${seriesPart ? `-${seriesPart}` : ""}`;
  const active = activeJobForSource(sourceId);
  if (active) return { queued: true as const, jobId: active.id };
  const job = enqueueJob("qualityUpgrade", `Recherche : ${fresh.title}`, 1, async (setProgress, { jobId }) => {
    // Search functions re-read under their per-title lock: a concurrent manual
    // season grab/import must never cause another download of the same episodes.
    const result = type === "movie"
      ? await searchAndGrabMovie(item.id)
      : await searchAndGrabSeries(item.id, { shouldCancel: () => isJobCancelled(jobId), seriesPart });
    if ("error" in result) throw new Error(result.error);
    setProgress(1, 1);
    return result;
  }, sourceId, { heavy: true });
  return { queued: true as const, jobId: job.id };
}
