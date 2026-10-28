import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { clearSessionCookie } from "@/lib/auth/session";
import { CONFIG_DIR, loadUsers } from "@/lib/auth/store";
import { ENGINE_BASE, engineHeaders } from "@/lib/engine/server";
import { hasUnfinishedJobs } from "@/lib/jobs/queue";
import { listActiveHeartbeatSessions } from "@/lib/playback/progressStore";
import { prepareJsonReset, finishJsonReset, resetAllCaches } from "@/lib/fsJsonCache";
import { beginFactoryReset, endFactoryReset } from "@/lib/system/resetBarrier";
import { inspectResetStores, stageResetStores } from "@/lib/system/resetStores";
import { clearResetMemory, resetHasBackgroundActivity } from "@/lib/system/resetMemory";
import { clearUserContextForReset, validateUserContextForReset } from "@/lib/userContext/database";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const userIds = loadUsers().map((user) => user.id);
  if (listActiveHeartbeatSessions().length) return NextResponse.json({ error: "reset_busy" }, { status: 409 });
  if (!beginFactoryReset()) return NextResponse.json({ error: "reset_busy" }, { status: 409 });
  let writesStopped = false;
  try {
    if (hasUnfinishedJobs() || resetHasBackgroundActivity()) return NextResponse.json({ error: "reset_busy" }, { status: 409 });
    writesStopped = true;
    await prepareJsonReset();
    const targets = inspectResetStores(CONFIG_DIR, userIds);
    validateUserContextForReset();
    const engineResponse = await fetch(`${ENGINE_BASE}/factory-reset`, {
      method: "POST", headers: engineHeaders(), cache: "no-store", signal: AbortSignal.timeout(120_000),
    });
    if (!engineResponse.ok) return NextResponse.json({ error: "reset_engine_unavailable" }, { status: 409 });
    const staged = stageResetStores(CONFIG_DIR, targets);
    try { clearUserContextForReset(); }
    catch (error) { staged.rollback(); throw error; }
    clearResetMemory();
    staged.commit();
    resetAllCaches();
    const response = NextResponse.json({ ok: true });
    clearSessionCookie(response);
    return response;
  } catch (error) {
    console.error("[factory-reset]", error);
    return NextResponse.json({ error: "reset_failed" }, { status: 500 });
  } finally {
    if (writesStopped) finishJsonReset();
    endFactoryReset();
  }
}
