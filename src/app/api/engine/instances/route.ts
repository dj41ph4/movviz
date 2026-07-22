import { NextRequest, NextResponse } from "next/server";
import { ENGINE_BASE, engineHeaders } from "@/lib/engine/server";
import { offlineInstancesSnapshot } from "@/lib/engine/stateFile";
import { requireAdmin } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/**
 * Takes precedence over the generic /api/engine/[...path] proxy for this
 * exact path — when the live engine can't be reached, falls back to a
 * snapshot built from the persisted state file instead of erroring out, so
 * Settings can still show (and edit) download client config while the
 * engine is down. Settings > Clients de téléchargement is the only caller,
 * and that page is already admin-only, so this stays admin-only too.
 */
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const res = await fetch(`${ENGINE_BASE}/instances`, { headers: engineHeaders(), cache: "no-store" });
    if (res.ok) return NextResponse.json(await res.json());
  } catch {
    // fall through to offline snapshot
  }
  return NextResponse.json({ instances: offlineInstancesSnapshot(), offline: true });
}
