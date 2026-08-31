import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { listTaskStatus } from "@/lib/scheduler/engine";
import { updateTaskConfig } from "@/lib/scheduler/state";
import { TASKS } from "@/lib/scheduler/tasks";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ tasks: listTaskStatus() });
}

export async function PUT(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json();
  const validIds = new Set(TASKS.map((t) => t.id));
  const updates: { id: string; intervalMs: number | null }[] = Array.isArray(body) ? body : body.tasks ?? [];
  for (const u of updates) {
    if (!validIds.has(u.id)) continue;
    const v = u.intervalMs;
    if (v != null && (v < 60000 || v > 365 * 24 * 60 * 60 * 1000)) continue;
    updateTaskConfig(u.id, { intervalMs: v });
  }
  return NextResponse.json({ ok: true });
}
