import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { bootstrapEngine } from "@/lib/engine/bootstrap";

export const dynamic = "force-dynamic";

/**
 * Re-attempts bringing the download engine up — bootstrapEngine() already
 * pings first and only spawns when nothing answers, so calling it again is
 * exactly "restart if it's down, no-op if it's already up". Lets a config
 * fix made while offline (Settings > Clients de téléchargement) actually be
 * retried from the UI instead of requiring a full container restart.
 */
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  await bootstrapEngine();
  return NextResponse.json({ ok: true });
}
