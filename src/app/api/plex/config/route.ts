import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadPlexConfig, savePlexConfig } from "@/lib/plex/store";

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
  });
}

export async function PUT(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json();
  const cfg = loadPlexConfig();
  savePlexConfig({
    ...cfg,
    hostname: String(body.hostname ?? cfg.hostname),
    port: Number(body.port) || cfg.port,
    useSsl: !!body.useSsl,
    syncLibrary: body.syncLibrary ?? cfg.syncLibrary,
    watchlistSyncEnabled: body.watchlistSyncEnabled ?? cfg.watchlistSyncEnabled,
  });
  return NextResponse.json({ ok: true });
}
