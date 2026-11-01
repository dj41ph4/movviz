import { initializeFreshDefaults } from "@/lib/setup/freshDefaults";
import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { hasAnyUser, getUserByUsername, addUser, createSession } from "@/lib/auth/store";
import { hashPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { toPublicUser, type User } from "@/lib/auth/types";
import { emitNotification } from "@/lib/notifications/store";
import { privacyConsentRequired, hasCurrentInstanceConsent, recordUserConsent } from "@/lib/privacy/consent";

export const dynamic = "force-dynamic";

/**
 * The very first account created on a fresh install becomes admin
 * automatically (and auto-approves its own requests, since there's no one
 * else to ask). Every account after that is a regular user by default.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");

  if (username.length < 3) {
    return NextResponse.json({ error: "username_too_short" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: "password_too_short" }, { status: 400 });
  }
  if (getUserByUsername(username)) {
    return NextResponse.json({ error: "username_taken" }, { status: 409 });
  }

  const isFirstUser = !hasAnyUser();
  // Consentement actif exigé par le paquet UGREEN : jamais déduit de l'usage. Le premier compte peut
  // l'avoir déjà donné (connexion Plex, via /api/privacy/consent) ; les suivants le cochent à l'inscription.
  const consentGiven = body.privacyConsent === true || (isFirstUser && hasCurrentInstanceConsent());
  if (privacyConsentRequired() && !consentGiven) {
    return NextResponse.json({ error: "privacy_consent_required" }, { status: 400 });
  }
  const user: User = {
    // randomUUID() — voir le commentaire dans auth/plex/poll/route.ts pour
    // la collision réelle qu'a produite l'ancien schéma faible.
    id: `usr_${randomUUID()}`,
    username,
    passwordHash: hashPassword(password),
    role: isFirstUser ? "admin" : "user",
    status: isFirstUser ? "approved" : "pending",
    autoApproveRequests: isFirstUser,
    autoRequestFromWatchlist: false,
      discoverContinents: [],
      requestLimitMovies: null,
      requestLimitSeries: null,
      canManageRequests: false,
      plexId: null,
      plexToken: null,
      plexManagedUserId: null,
      plexAvatar: null,
      customAvatar: null,
    createdAt: Date.now(),
  };
  addUser(user);
  if (privacyConsentRequired()) recordUserConsent(user.id);
  if (isFirstUser) { try { initializeFreshDefaults(user.id); } catch (error) { console.error("[setup] defaults:", error); } }
  if (user.status === "pending") {
    emitNotification("user_registered", `${username} a demandé un compte`, "/users", { username });
  }

  const { token, expiresAt } = createSession(user.id);
  const res = NextResponse.json({ user: toPublicUser(user) }, { status: 201 });
  setSessionCookie(res, token, expiresAt);
  return res;
}
