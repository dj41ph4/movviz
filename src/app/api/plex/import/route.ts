import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { getUserByPlexId, addUser } from "@/lib/auth/store";
import { loadPlexConfig } from "@/lib/plex/store";
import { getPlexFriends } from "@/lib/plex/client";
import type { User } from "@/lib/auth/types";

export const dynamic = "force-dynamic";

/** Create a local (passwordless, Plex-only) account for every friend that isn't already imported. */
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const cfg = loadPlexConfig();
  if (!cfg.adminToken) return NextResponse.json({ error: "plex_not_connected" }, { status: 400 });

  const friends = await getPlexFriends(cfg.clientId, cfg.adminToken);
  const created: User[] = [];

  for (const friend of friends) {
    if (getUserByPlexId(friend.id)) continue;
    const user: User = {
      id: `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}${friend.id}`,
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
      createdAt: Date.now(),
    };
    addUser(user);
    created.push(user);
  }

  return NextResponse.json({ imported: created.length });
}
