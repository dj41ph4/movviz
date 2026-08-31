import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadUsers } from "@/lib/auth/store";
import { loadPlexConfig } from "@/lib/plex/store";
import { getPlexFriends } from "@/lib/plex/client";

export const dynamic = "force-dynamic";

/** Real accounts with access to the connected Plex server, flagged if already imported. */
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const cfg = loadPlexConfig();
  if (!cfg.adminToken) return NextResponse.json({ error: "plex_not_connected" }, { status: 400 });

  const friends = await getPlexFriends(cfg.clientId, cfg.adminToken);
  const existingPlexIds = new Set(loadUsers().map((u) => u.plexId).filter(Boolean));
  const users = friends.map((f) => ({ ...f, imported: existingPlexIds.has(f.id) }));
  return NextResponse.json({ users });
}
