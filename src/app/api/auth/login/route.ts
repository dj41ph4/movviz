import { NextRequest, NextResponse } from "next/server";
import { getUserByUsername, createSession } from "@/lib/auth/store";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { toPublicUser } from "@/lib/auth/types";
import { clientIp, loginBlockedFor, recordLoginFailure, recordLoginSuccess } from "@/lib/auth/rateLimit";

export const dynamic = "force-dynamic";

// Empreinte factice : un pseudo inexistant coûte le même calcul scrypt qu'un mot de passe erroné,
// pour ne pas révéler par le temps de réponse quels pseudos existent.
let decoyHash: string | null = null;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const ip = clientIp(req);

  const wait = loginBlockedFor(ip, username);
  if (wait > 0) {
    return NextResponse.json({ error: "too_many_attempts", retryAfter: wait }, { status: 429, headers: { "Retry-After": String(wait) } });
  }

  const user = getUserByUsername(username);
  const stored = user?.passwordHash ?? (decoyHash ??= hashPassword("movviz-decoy-password"));
  const valid = verifyPassword(password, stored);
  if (!user || !user.passwordHash || !valid) {
    recordLoginFailure(ip, username);
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  recordLoginSuccess(ip, username);
  const { token, expiresAt } = createSession(user.id);
  const res = NextResponse.json({ user: toPublicUser(user) });
  setSessionCookie(res, token, expiresAt, req);
  return res;
}
