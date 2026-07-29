import { NextRequest, NextResponse } from "next/server";
import { ENGINE_BASE, engineHeaders } from "@/lib/engine/server";
import { requireAdmin } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/**
 * GET — read current client type from the engine.
 * POST — switch to a different torrent backend (webtorrent|native).
 * Changing the client type tears down all instances and recreates them
 * with the new backend — active downloads are lost and must be re-added.
 */
export async function GET() {
  try {
    const res = await fetch(`${ENGINE_BASE}/client-type`, {
      headers: engineHeaders(),
      cache: "no-store",
    });
    if (res.ok) return NextResponse.json(await res.json());
  } catch {}
  return NextResponse.json({ clientType: "webtorrent", offline: true });
}

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { clientType } = await req.json();
  if (clientType !== "webtorrent" && clientType !== "native") {
    return NextResponse.json({ error: "invalid client type" }, { status: 400 });
  }
  try {
    const res = await fetch(`${ENGINE_BASE}/client-type`, {
      method: "POST",
      headers: engineHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ clientType }),
      cache: "no-store",
    });
    if (res.ok) return NextResponse.json(await res.json());
    return NextResponse.json({ error: "engine rejected switch" }, { status: 502 });
  } catch {
    return NextResponse.json({ error: "engine unreachable" }, { status: 502 });
  }
}
