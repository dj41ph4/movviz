import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { enqueueJob, getJobs, isSourceActive, isJobCancelled } from "@/lib/jobs/queue";
import { syncPlexMarkers, markerSyncSourceId, type MarkerSyncResult } from "@/lib/plex/markerSync";
import { markerStats } from "@/lib/playback/markers/store";
import { loadMarkerSyncState } from "@/lib/plex/markerSyncState";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const user = requireAdmin(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const syncState = loadMarkerSyncState();
  const stats = markerStats();
  const jobs = getJobs().filter((j) => j.sourceId === markerSyncSourceId());
  const lastJob = jobs[0] ?? null;
  return NextResponse.json({
    markerSyncEnabled: true,
    stats,
    lastIncrementalAt: syncState.lastIncrementalAt,
    lastFullAt: syncState.lastFullAt,
    jobRunning: isSourceActive(markerSyncSourceId()),
    lastJob: lastJob ? { status: lastJob.status, result: lastJob.result, current: lastJob.current, total: lastJob.total } : null,
  });
}

/** Lancement manuel d'une synchronisation de markers (incrémentale ou
 *  complète). Admin only. La route rend la main IMMÉDIATEMENT : le vrai
 *  travail tourne dans la job queue Movviz existante (dédup par sourceId —
 *  un full actif + un clic incremental = pas de deuxième job). */
export async function POST(req: NextRequest) {
  const user = requireAdmin(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let mode: string | null = null;
  try {
    const body = await req.json();
    mode = typeof body?.mode === "string" ? body.mode : null;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  if (mode !== "incremental" && mode !== "full") {
    return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
  }

  if (isSourceActive(markerSyncSourceId())) {
    return NextResponse.json({ error: "already_running" }, { status: 409 });
  }

  const job = enqueueJob(
    "plexMarkerSync",
    mode === "full" ? "Synchronisation complète des intros et génériques Plex" : "Synchronisation incrémentale des intros et génériques Plex",
    0,
    async (setProgress) => {
      return syncPlexMarkers({
        mode,
        setProgress,
        isCancelled: () => false,
      }) as Promise<MarkerSyncResult>;
    },
    markerSyncSourceId()
  );

  void isJobCancelled; // (référence conservée : annulation coopérative dispo via /api/jobs)

  return NextResponse.json({ queued: true, jobId: job.id });
}
