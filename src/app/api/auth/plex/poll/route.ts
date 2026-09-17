import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { hasAnyUser, getUserByPlexId, addUser, updateUser, createSession } from "@/lib/auth/store";
import { setSessionCookie } from "@/lib/auth/session";
import { toPublicUser, type User } from "@/lib/auth/types";
import { loadPlexConfig, savePlexConfig } from "@/lib/plex/store";
import { checkPin, getPlexAccount, getPlexFriends } from "@/lib/plex/client";
import { syncPlexUserMedia } from "@/lib/plex/userMediaSync";

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
      // Bug réel confirmé en direct (2026-09) : Date.now()+4 caractères
      // aléatoires (~1,7M combinaisons) a produit une collision réelle entre
      // deux comptes créés à quelques instants d'écart — même `user.id`,
      // donc même clé dans plex-watch-status.json (indexé par user.id, pas
      // plexId) : les deux comptes partageaient silencieusement le même
      // historique vu. randomUUID() élimine le risque (2^122 combinaisons).
      id: `usr_${randomUUID()}`,
      username: account.username,
      passwordHash: null,
      role: isFirstUser ? "admin" : "user",
      status: "approved",
      autoApproveRequests: isFirstUser,
      // A Plex-authenticated account owns the token needed to read its
      // Discover watchlist. Enable that personal sync from the outset; an
      // imported friend without a token remains disabled until this flow.
      autoRequestFromWatchlist: true,
      discoverContinents: [],
      requestLimitMovies: null,
      requestLimitSeries: null,
      canManageRequests: false,
      plexId: account.id,
      plexToken: token,
      plexServerToken: null,
      plexManagedUserId: null,
      plexAvatar: account.thumb,
      customAvatar: null,
      createdAt: Date.now(),
    };
    addUser(user);

    if (isFirstUser) {
      savePlexConfig({ ...cfg, adminToken: token });
    }
  } else if (user.plexToken !== token) {
    // Refresh the stored token so watchlist sync keeps working after Plex rotates it.
    // The old PMS token was derived from this account token; discard it so
    // the next personal Plex request exchanges a fresh, correctly scoped one.
    user = updateUser(user.id, {
      plexToken: token,
      plexServerToken: null,
      // A friend imported from the Plex server has no token initially. The
      // first successful login from web, mobile, or TV makes its own list
      // available, so enable the sync by default. Respect an explicit opt-out
      // for accounts that already had a personal token.
      autoRequestFromWatchlist: user.plexToken ? user.autoRequestFromWatchlist : true,
    }) ?? user;
  }

  // Do not make a user wait for the scheduler after authenticating on a
  // phone or TV. The token stays server-side: this route only returns the
  // public user shape, while the import uses it internally.
  if (user.plexToken && user.autoRequestFromWatchlist !== false) {
    await syncPlexUserMedia(user).catch(() => {});
  }

  const { token: sessionToken, expiresAt } = createSession(user.id);
  const res = NextResponse.json({ done: true, user: toPublicUser(user as User) });
  setSessionCookie(res, sessionToken, expiresAt);
  return res;
}
