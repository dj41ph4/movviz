import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadUsers } from "@/lib/auth/store";
import { mergePlexAccountHistory, type HistoryMergeReport } from "@/lib/plex/historyMerge";

export const dynamic = "force-dynamic";

interface MergeJob {
  id: string;
  fromLocalAccountId: number;
  toUsername: string;
  apply: boolean;
  status: "running" | "done" | "failed";
  startedAt: number;
  finishedAt?: number;
  report?: HistoryMergeReport;
  error?: string;
}

const g = globalThis as typeof globalThis & { __movvizMergeJobs?: Map<string, MergeJob> };
const jobs: Map<string, MergeJob> = (g.__movvizMergeJobs ??= new Map());

/**
 * Admin: bring a Plex server account's history (e.g. a deleted Home profile,
 * listed by GET /api/plex/accounts) into a Movviz account — see
 * historyMerge.ts for the rules. Resolving hundreds of views takes longer
 * than the reverse proxy waits (504 at 60 s), so the work runs in the
 * background: POST starts it and returns its id, GET ?id= reports it.
 * Dry run unless `apply: true` is sent explicitly.
 * Body: { fromLocalAccountId: number, toUsername: string, apply?: boolean }
 */
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const fromLocalAccountId = Number(body?.fromLocalAccountId);
  const toUsername = typeof body?.toUsername === "string" ? body.toUsername.trim() : "";
  const apply = body?.apply === true;
  if (!Number.isSafeInteger(fromLocalAccountId) || fromLocalAccountId <= 0 || !toUsername) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const target = loadUsers().find((u) => u.username === toUsername);
  if (!target) return NextResponse.json({ error: "user_not_found" }, { status: 404 });

  // One run at a time per source → target: a second click never runs it twice.
  const running = [...jobs.values()].find((j) => j.status === "running" && j.fromLocalAccountId === fromLocalAccountId && j.toUsername === toUsername);
  if (running) return NextResponse.json({ id: running.id, status: running.status });

  const job: MergeJob = { id: `merge_${Date.now().toString(36)}`, fromLocalAccountId, toUsername, apply, status: "running", startedAt: Date.now() };
  jobs.set(job.id, job);
  mergePlexAccountHistory({ fromLocalAccountId, toUserId: target.id, dryRun: !apply })
    .then((report) => { job.status = "done"; job.report = report; })
    .catch((e: unknown) => { job.status = "failed"; job.error = (e as Error).message; })
    .finally(() => { job.finishedAt = Date.now(); });
  return NextResponse.json({ id: job.id, status: job.status }, { status: 202 });
}

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ jobs: [...jobs.values()].sort((a, b) => b.startedAt - a.startedAt) });
  const job = jobs.get(id);
  return job ? NextResponse.json(job) : NextResponse.json({ error: "not_found" }, { status: 404 });
}
