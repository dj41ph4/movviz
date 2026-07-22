import { NextRequest, NextResponse } from "next/server";
import { hasAnyUser, getUserByPlexId, addUser, updateUser, createSession } from "@/lib/auth/store";
import { setSessionCookie } from "@/lib/auth/session";
import { toPublicUser, type User } from "@/lib/auth/types";
import { loadPlexConfig, savePlexConfig } from "@/lib/plex/store";
import { checkPin, getPlexAccount, getPlexFriends } from "@/lib/plex/client";

export const dynamic = "force-dynamic";

/**
 * Polled by the login page after it sends the user to Plex's auth page.
 * Once Plex reports an authToken for this pin, resolve who they are and
 * either sign them into their existing account, auto-provision one (if they
 * have access to the configured Plex server), or make them the very first
 * admin (if Movviz has no accounts yet).
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const pinId = Number(body.id);
  if (!pinId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const cfg = loadPlexConfig();
  const token = await checkPin(cfg.clientId, pinId);
  if (!token) return NextResponse.json({ done: false });

  const account = await getPlexAccount(cfg.clientId, token);
  if (!account) return NextResponse.json({ error: "plex_account_lookup_failed" }, { status: 502 });

  let user = getUserByPlexId(account.id);

  if (!user) {
    const isFirstUser = !hasAnyUser();

    if (!isFirstUser) {
      // Only auto-provision accounts that actually have access to the configured server.
      const friends = cfg.adminToken ? await getPlexFriends(cfg.clientId, cfg.adminToken) : [];
      const hasAccess = friends.some((f) => f.id === account.id);
      if (!hasAccess) {
        return NextResponse.json({ error: "no_plex_access" }, { status: 403 });
      }
    }

    user = {
      id: `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      username: account.username,
      passwordHash: null,
      role: isFirstUser ? "admin" : "user",
      status: "approved",
      autoApproveRequests: isFirstUser,
      autoRequestFromWatchlist: false,
      discoverContinents: [],
      requestLimitMovies: null,
      requestLimitSeries: null,
      canManageRequests: false,
      plexId: account.id,
      plexToken: token,
      plexManagedUserId: null,
      plexAvatar: account.thumb,
      createdAt: Date.now(),
    };
    addUser(user);

    if (isFirstUser) {
      savePlexConfig({ ...cfg, adminToken: token });
    }
  } else if (user.plexToken !== token) {
    // Refresh the stored token so watchlist sync keeps working after Plex rotates it.
    user = updateUser(user.id, { plexToken: token }) ?? user;
  }

  const { token: sessionToken, expiresAt } = createSession(user.id);
  const res = NextResponse.json({ done: true, user: toPublicUser(user as User) });
  setSessionCookie(res, sessionToken, expiresAt);
  return res;
}
