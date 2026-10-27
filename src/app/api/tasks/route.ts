import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { listTaskStatus } from "@/lib/scheduler/engine";
import { updateTaskConfig, type TaskConfig } from "@/lib/scheduler/state";
import { TASKS } from "@/lib/scheduler/tasks";
import { acquisitionInterval } from "@/lib/scheduler/interval";
import { parseTaskWindow, serverTimeZone } from "@/lib/scheduler/window";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ tasks: listTaskStatus(), timeZone: serverTimeZone() });
}

export async function PUT(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json();
  const validIds = new Set(TASKS.map((t) => t.id));
  const updates: { id: string; intervalMs?: number | null; window?: unknown }[] = Array.isArray(body) ? body : body.tasks ?? [];
  for (const u of updates) {
    if (!validIds.has(u.id)) continue;
    // Chaque champ n'est modifié que s'il est présent : envoyer seulement la plage ne
    // doit pas remettre l'intervalle à sa valeur par défaut.
    const patch: Partial<TaskConfig> = {};
    if ("intervalMs" in u) {
      const v = u.intervalMs;
      if (v != null && (!Number.isFinite(v) || v < 60000 || v > 365 * 24 * 60 * 60 * 1000)) continue;
      patch.intervalMs = v == null ? null : acquisitionInterval(u.id, v);
    }
    if ("window" in u) {
      const w = parseTaskWindow(u.window);
      // null explicite = retirer la plage ; une plage invalide est ignorée.
      if (u.window != null && !w) continue;
      patch.window = w;
    }
    if (Object.keys(patch).length > 0) updateTaskConfig(u.id, patch);
  }
  return NextResponse.json({ ok: true });
}
