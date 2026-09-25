import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadUsers } from "@/lib/auth/store";
import { loadPlexConfig } from "@/lib/plex/store";
import { getPlexServerAccounts } from "@/lib/plex/serverAccounts";

export const dynamic = "force-dynamic";

/** Real accounts with access to the connected Plex server, flagged if already imported. */
export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const cfg = loadPlexConfig();
  if (!cfg.adminToken) return NextResponse.json({ error: "plex_not_connected" }, { status: 400 });

  const friends = await getPlexServerAccounts();
  if (friends === null) return NextResponse.json({ error: "plex_unreachable" }, { status: 502 });
  const existingPlexIds = new Set(loadUsers().map((u) => u.plexId).filter(Boolean));
  const users = friends.map((f) => ({ ...f, imported: existingPlexIds.has(f.id) }));
  return NextResponse.json({ users });
}
