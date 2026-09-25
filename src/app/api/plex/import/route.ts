import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireAdmin } from "@/lib/auth/guard";
import { getUserByPlexId, addUser } from "@/lib/auth/store";
import { loadPlexConfig } from "@/lib/plex/store";
import { getPlexServerAccounts } from "@/lib/plex/serverAccounts";
import type { User } from "@/lib/auth/types";

export const dynamic = "force-dynamic";

/** Create a local (passwordless, Plex-only) account for every Plex account
 *  with access to the server that isn't already imported. */
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const cfg = loadPlexConfig();
  if (!cfg.adminToken) return NextResponse.json({ error: "plex_not_connected" }, { status: 400 });

  const friends = await getPlexServerAccounts();
  if (friends === null) return NextResponse.json({ error: "plex_unreachable" }, { status: 502 });
  const created: User[] = [];

  for (const friend of friends) {
    if (getUserByPlexId(friend.id)) continue;
    const user: User = {
      // randomUUID() — cette route avait été oubliée lors de la correction
      // de la collision réelle d'id de compte (2026-09, voir
      // auth/plex/poll/route.ts pour le détail complet).
      id: `usr_${randomUUID()}`,
      username: friend.username,
      passwordHash: null,
      role: "user",
      status: "approved",
      autoApproveRequests: false,
      autoRequestFromWatchlist: false,
      discoverContinents: [],
      requestLimitMovies: null,
      requestLimitSeries: null,
      canManageRequests: false,
      plexId: friend.id,
      plexToken: null,
      plexManagedUserId: null,
      plexAvatar: friend.thumb,
      customAvatar: null,
      createdAt: Date.now(),
    };
    addUser(user);
    created.push(user);
  }

  return NextResponse.json({ imported: created.length, total: friends.length });
}
