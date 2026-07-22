import { NextRequest, NextResponse } from "next/server";
import { ENGINE_BASE, engineHeaders } from "@/lib/engine/server";
import { patchInstanceConfigOffline } from "@/lib/engine/stateFile";
import { requireAdmin } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Edits a download client's config. When the live engine is reachable this
 * just proxies through as before and applies immediately. When it's not
 * (crashed, still starting, mis-configured), the patch is written straight
 * to the engine's state file instead of failing outright — the engine picks
 * it up the next time it starts, so a broken config (wrong folder, bad
 * PUID/PGID-owned path, etc.) can be fixed and retried from Settings
 * without shell access to the NAS.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const patch = await req.json();

  try {
    const res = await fetch(`${ENGINE_BASE}/instances/${id}`, {
      method: "PATCH",
      headers: engineHeaders({ "content-type": "application/json" }),
      body: JSON.stringify(patch),
    });
    if (res.ok) return NextResponse.json(await res.json());
  } catch {
    // fall through to offline write
  }

  patchInstanceConfigOffline(id, patch);
  return NextResponse.json({ ok: true, offline: true });
}
