import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { ENGINE_BASE, engineHeaders, ENGINE_TIMEOUT_MS } from "@/lib/engine/server";
import { releaseAllDownloadClaims } from "@/lib/library/downloadState";
import { eventBus } from "@/lib/events/EventBus";

export const dynamic = "force-dynamic";

/**
 * Empties the whole queue, including active/in-progress torrents — unlike
 * clear-finished, which only drops completed/seeding ones. Reuses the
 * engine's existing per-torrent DELETE (which already removes an active
 * torrent cleanly) instead of a bulk engine endpoint, so each removal still
 * releases its library download claim the same way a manual delete would.
 */
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const deleteData = req.nextUrl.searchParams.get("deleteData") === "1";

  let torrents: { infoHash: string }[];
  try {
    const listRes = await fetch(`${ENGINE_BASE}/torrents`, {
      headers: engineHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS),
    });
    if (!listRes.ok) return NextResponse.json({ error: "engine_unreachable" }, { status: 503 });
    ({ torrents } = (await listRes.json()) as { torrents: { infoHash: string }[] });
  } catch {
    return NextResponse.json({ error: "engine_unreachable" }, { status: 503 });
  }

  let removed = 0;
  for (const t of torrents) {
    try {
      const res = await fetch(`${ENGINE_BASE}/torrents/${t.infoHash}?deleteData=${deleteData ? 1 : 0}`, {
        method: "DELETE",
        headers: engineHeaders(),
        signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS),
      });
      if (res.ok) {
        removed++;
        releaseAllDownloadClaims(t.infoHash);
      }
    } catch {
      // Keep going — one stuck torrent shouldn't stop the rest from clearing.
    }
  }
  if (removed > 0) eventBus.emit({ type: "download_changed" });
  return NextResponse.json({ removed });
}
