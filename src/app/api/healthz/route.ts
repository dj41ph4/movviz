import { NextResponse } from "next/server";
import { jsonPersistenceHealthy } from "@/lib/fsJsonCache";
import { getAppVersion } from "@/lib/updates/version";

export const dynamic = "force-dynamic";

/**
 * Plain liveness check for Docker's HEALTHCHECK (and any load balancer/NAS
 * container manager probing the same way) - unauthenticated on purpose,
 * since the probe never carries a session cookie. Checks server responsiveness
 * and sustained JSON persistence failure. Detailed diagnostics (engine/
 * TMDb/indexers/disk) live at /api/health, gated behind requireAdmin.
 */
export async function GET() {
  const ok = jsonPersistenceHealthy();
  return NextResponse.json({ ok, version: getAppVersion() }, { status: ok ? 200 : 503 });
}
