import { NextRequest, NextResponse } from "next/server";
import { ENGINE_BASE, engineHeaders } from "@/lib/engine/server";
import { getEngineCrashLog } from "@/lib/engine/crashLog";
import { requireAdmin } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/**
 * Takes precedence over the generic /api/engine/[...path] proxy for this
 * exact path. When the live engine can be reached, its own ring buffer
 * (engine/src/logger.mjs) is the more complete source. When it can't —
 * exactly the case that matters most, a crash before the engine's HTTP API
 * ever bound — falls back to the raw stdout/stderr the web app itself
 * captured while spawning it (see src/lib/engine/bootstrap.ts), so a
 * startup failure is still visible from Settings > Diagnostics.
 */
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const res = await fetch(`${ENGINE_BASE}/logs`, { headers: engineHeaders(), cache: "no-store" });
    if (res.ok) return NextResponse.json(await res.json());
  } catch {
    // fall through to the crash log
  }
  return NextResponse.json({ logs: getEngineCrashLog(), offline: true });
}
