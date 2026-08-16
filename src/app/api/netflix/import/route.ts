import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { startNetflixImportJob, getNetflixImportJob } from "@/lib/netflix/importJobs";

export const dynamic = "force-dynamic";

// Netflix's own export can run to several thousand rows for a long-time
// account, but the file itself is plain text (title,date) — this is a
// generous ceiling against abuse, not a realistic size.
const MAX_CSV_LENGTH = 5 * 1024 * 1024;

/**
 * Netflix → Movviz (demande explicite user). Strictly per-user: the CSV the
 * caller uploads is only ever matched against THEIR OWN watched status
 * (requireUser → user.id), never mixed with another account's.
 *
 * Starts a BACKGROUND job and returns immediately (demande explicite user:
 * "en arrière-plan... que je puisse quitter la page pendant
 * l'importation") — a real Netflix history can run to thousands of rows,
 * each needing a TMDb lookup; holding one HTTP request open for that would
 * time out long before it finishes. GET polls progress separately.
 */
export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const csv = typeof body?.csv === "string" ? body.csv : "";
  if (!csv) return NextResponse.json({ error: "csv_required" }, { status: 400 });
  if (csv.length > MAX_CSV_LENGTH) return NextResponse.json({ error: "file_too_large" }, { status: 413 });

  const started = startNetflixImportJob(user, csv);
  if (!started) return NextResponse.json({ error: "already_running" }, { status: 409 });
  return NextResponse.json({ ok: true });
}

/** Poll the current (or most recently finished) import for this user —
 *  keyed by user.id, not a client-remembered job id, so reopening this
 *  settings page (even after navigating away, or a reload) immediately
 *  resumes showing progress. `null` job = nothing has ever been imported
 *  this server run. */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ job: getNetflixImportJob(user.id) });
}
