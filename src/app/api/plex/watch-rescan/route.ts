import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadUsers } from "@/lib/auth/store";
import { enqueueJob, getJobs, isJobCancelled, isSourceActive, JobCancelledError } from "@/lib/jobs/queue";
import { fullRescanUserWatchStatus } from "@/lib/plex/watchSync";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SOURCE_ID = "plex-watch-full-rescan";

/** Status for the Plex Settings button. The actual work always lives in the
 * shared job queue so navigation never abandons a large watched-state scan. */
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const job = getJobs().find((candidate) => candidate.sourceId === SOURCE_ID) ?? null;
  return NextResponse.json({
    running: isSourceActive(SOURCE_ID),
    job: job ? {
      id: job.id,
      status: job.status,
      current: job.current,
      total: job.total,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error,
      result: job.result,
    } : null,
  });
}

/**
 * Force a complete, authoritative watched-state reconciliation for every
 * locally linked Plex owner. This is deliberately separate from the normal
 * incremental/history path: it is an opt-in repair operation and returns
 * immediately after it has been queued.
 */
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (isSourceActive(SOURCE_ID)) return NextResponse.json({ error: "already_running" }, { status: 409 });

  const targets = loadUsers().filter((user) => !!user.plexId || !!user.plexManagedUserId);
  if (targets.length === 0) return NextResponse.json({ error: "no_plex_users" }, { status: 400 });

  const job = enqueueJob(
    "maintenance",
    "Resynchronisation complète des vues Plex",
    targets.length,
    async (setProgress, ctx) => {
      const results: Array<{ userId: string; username: string; ok: boolean; watchedCount?: number; unwatchedCount?: number; error?: string }> = [];
      for (let index = 0; index < targets.length; index++) {
        if (isJobCancelled(ctx.jobId)) throw new JobCancelledError();
        const user = targets[index];
        const result = await fullRescanUserWatchStatus(user);
        results.push({ userId: user.id, username: user.username, ...result });
        setProgress(index + 1, targets.length);
      }
      return {
        users: results,
        succeeded: results.filter((result) => result.ok).length,
        failed: results.filter((result) => !result.ok).length,
      };
    },
    SOURCE_ID,
  );
  return NextResponse.json({ queued: true, jobId: job.id });
}
