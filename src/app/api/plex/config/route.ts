import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadPlexConfig, savePlexConfig } from "@/lib/plex/store";
import { safePlexUrl } from "@/lib/plex/safeUrl";
import { testPlexServer } from "@/lib/plex/client";

export const dynamic = "force-dynamic";

// « connected » = une liaison existe (jeton). « reachable » = le serveur répond VRAIMENT (sonde /identity, 6 s max, mémorisée 20 s).
const g = globalThis as typeof globalThis & { __movvizPlexReach?: { key: string; ok: boolean; at: number } };
async function plexReachable(cfg: ReturnType<typeof loadPlexConfig>): Promise<boolean | null> {
  if (!cfg.hostname || !cfg.adminToken) return null;
  const key = `${cfg.useSsl}:${cfg.hostname}:${cfg.port}`;
  const hit = g.__movvizPlexReach;
  if (hit && hit.key === key && Date.now() - hit.at < 20_000) return hit.ok;
  const ok = await testPlexServer(cfg);
  g.__movvizPlexReach = { key, ok, at: Date.now() };
  return ok;
}

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const cfg = loadPlexConfig();
  return NextResponse.json({
    hostname: cfg.hostname,
    port: cfg.port,
    useSsl: cfg.useSsl,
    connected: !!cfg.adminToken,
    reachable: await plexReachable(cfg),
    syncLibrary: cfg.syncLibrary,
    watchlistSyncEnabled: cfg.watchlistSyncEnabled,
    markerSyncEnabled: cfg.markerSyncEnabled,
    // Jamais le token Plex ici — GET n'expose que des booléens/URL.
  });
}

export async function PUT(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json();
  const cfg = loadPlexConfig();
  const hostname = String(body.hostname ?? cfg.hostname).trim();
  if (!safePlexUrl(hostname)) {
    return NextResponse.json({ error: "invalid hostname (localhost / loopback / link-local are rejected)" }, { status: 400 });
  }
  savePlexConfig({
    ...cfg,
    hostname,
    port: Number(body.port) || cfg.port,
    useSsl: !!body.useSsl,
    syncLibrary: body.syncLibrary ?? cfg.syncLibrary,
    watchlistSyncEnabled: body.watchlistSyncEnabled ?? cfg.watchlistSyncEnabled,
    markerSyncEnabled: body.markerSyncEnabled ?? cfg.markerSyncEnabled,
  });
  return NextResponse.json({ ok: true });
}
