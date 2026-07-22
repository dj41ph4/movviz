import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Plain liveness check for Docker's HEALTHCHECK (and any load balancer/NAS
 * container manager probing the same way) - unauthenticated on purpose,
 * since the probe never carries a session cookie. Just "is the Next.js
 * server answering", nothing else. The detailed admin diagnostics (engine/
 * TMDb/indexers/disk) live at /api/health, gated behind requireAdmin.
 */
export async function GET() {
  return NextResponse.json({ ok: true });
}
