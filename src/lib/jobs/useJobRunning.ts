"use client";

import useSWR from "swr";

interface JobSummary {
  sourceId?: string;
  status: "queued" | "running" | "completed" | "failed";
}

/**
 * Whether a background job tied to this exact source (e.g. "movie-search-mv_x")
 * is still queued or running — driven by the shared job queue (see
 * src/lib/jobs/queue.ts), not local component state. A `useState` spinner
 * resets to false the moment you navigate away and back, even though the
 * search is still running server-side; this instead reflects the real
 * state, so revisiting the page shows the button spinning again if the job
 * hasn't finished yet.
 */
export function useJobRunning(sourceId: string | null, enabled = true): boolean {
  const { data } = useSWR<{ jobs: JobSummary[] }>("/api/jobs", { refreshInterval: enabled ? 2000 : 0 });
  if (!sourceId) return false;
  return (data?.jobs ?? []).some((j) => j.sourceId === sourceId && (j.status === "queued" || j.status === "running"));
}

/**
 * Same idea as useJobRunning, but for a family of source ids sharing a
 * prefix (e.g. every "season-search-{seriesId}-" job) where only one can
 * reasonably be active at a time — returns the bit after the prefix (e.g.
 * the season number) for whichever one is still queued/running, or null.
 */
export function useActiveJobSuffix(prefix: string | null, enabled = true): string | null {
  const { data } = useSWR<{ jobs: JobSummary[] }>("/api/jobs", { refreshInterval: enabled ? 2000 : 0 });
  if (!prefix) return null;
  const match = (data?.jobs ?? []).find(
    (j) => j.sourceId?.startsWith(prefix) && (j.status === "queued" || j.status === "running")
  );
  return match?.sourceId ? match.sourceId.slice(prefix.length) : null;
}
