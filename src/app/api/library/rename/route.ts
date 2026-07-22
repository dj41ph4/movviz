import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import {
  startRenameScan,
  isRenameScanRunning,
  getRenameCandidates,
  getRenameLanguage,
  getRenameLog,
  startRenameExecute,
  isRenameExecuteRunning,
  getRenameExecuteLog,
  getRenameExecuteResults,
  getLatestRenameExecuteJob,
} from "@/lib/library/renameJob";
import { getJobsByType } from "@/lib/jobs/queue";

export const dynamic = "force-dynamic";

/** GET — returns current scan status + results if done, plus the execute job's own status/log/results if one is running or just finished */
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const jobs = getJobsByType("libraryRename");
  const latestJob = jobs.find((j) => j.sourceId !== "libraryRenameExecute") ?? null;
  const running = isRenameScanRunning();

  const execJob = getLatestRenameExecuteJob();
  const execRunning = isRenameExecuteRunning();

  return NextResponse.json({
    running,
    job: latestJob ? {
      id: latestJob.id,
      status: latestJob.status,
      current: latestJob.current,
      total: latestJob.total,
      error: latestJob.error,
    } : null,
    candidates: latestJob?.status === "completed" ? getRenameCandidates() : [],
    language: getRenameLanguage(),
    log: getRenameLog(),
    execute: {
      running: execRunning,
      job: execJob ? {
        id: execJob.id,
        status: execJob.status,
        current: execJob.current,
        total: execJob.total,
        error: execJob.error,
      } : null,
      log: getRenameExecuteLog(),
      result: execJob?.status === "completed" ? getRenameExecuteResults() : null,
    },
  });
}

/** POST — scan or execute, both as background jobs (many TMDb lookups + filesystem moves, can run long on large libraries) */
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const action = body.action as string | undefined;
  const language = (body.language as string) ?? "fr-FR";

  if (action === "scan") {
    if (isRenameScanRunning()) {
      return NextResponse.json({ error: "A scan is already running" }, { status: 409 });
    }
    startRenameScan(language);
    return NextResponse.json({ queued: true });
  }

  if (action === "execute") {
    const selections: { id: string; type: "movie" | "series" }[] = body.selections ?? [];
    if (!Array.isArray(selections) || selections.length === 0) {
      return NextResponse.json({ error: "No selections provided" }, { status: 400 });
    }
    if (isRenameExecuteRunning()) {
      return NextResponse.json({ error: "A rename is already running" }, { status: 409 });
    }
    startRenameExecute(selections, language);
    return NextResponse.json({ queued: true });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
