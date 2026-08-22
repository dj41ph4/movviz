import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadPlexConfig, savePlexConfig } from "@/lib/plex/store";
import { safePlexUrl } from "@/lib/plex/safeUrl";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const cfg = loadPlexConfig();
  return NextResponse.json({
    hostname: cfg.hostname,
    port: cfg.port,
    useSsl: cfg.useSsl,
    connected: !!cfg.adminToken,
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
