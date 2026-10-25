import { NextRequest, NextResponse } from "next/server";
import { ENGINE_BASE, engineHeaders } from "@/lib/engine/server";
import { offlineInstancesSnapshot, patchInstanceConfigOffline } from "@/lib/engine/stateFile";
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
  if (id !== "movies" && id !== "series") return NextResponse.json({ error: "no such instance" }, { status: 404 });
  const patch = await req.json();
  if (Object.hasOwn(patch, "torrentPort")) {
    const port = patch.torrentPort;
    if (!Number.isInteger(port) || port < 1024 || port > 65535) {
      return NextResponse.json({ error: "invalid_torrent_port" }, { status: 400 });
    }
  }

  try {
    const res = await fetch(`${ENGINE_BASE}/instances/${id}`, {
      method: "PATCH",
      headers: engineHeaders({ "content-type": "application/json" }),
      body: JSON.stringify(patch),
    });
    return NextResponse.json(await res.json(), { status: res.status });
  } catch {
    // fall through to offline write
  }

  if (Object.hasOwn(patch, "torrentPort")
    && offlineInstancesSnapshot().some((instance) => instance.id !== id && instance.torrentPort === patch.torrentPort)) {
    return NextResponse.json({ error: "torrent_port_in_use" }, { status: 400 });
  }

  patchInstanceConfigOffline(id, Object.hasOwn(patch, "torrentPort")
    ? { ...patch, torrentPortUserOverride: true } : patch);
  return NextResponse.json({ ok: true, offline: true });
}
