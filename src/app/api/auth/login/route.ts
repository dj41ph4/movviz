import { NextRequest, NextResponse } from "next/server";
import { getUserByUsername, createSession } from "@/lib/auth/store";
import { verifyPassword } from "@/lib/auth/password";
import { setSessionCookie } from "@/lib/auth/session";
import { toPublicUser } from "@/lib/auth/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");

  const user = getUserByUsername(username);
  if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const { token, expiresAt } = createSession(user.id);
  const res = NextResponse.json({ user: toPublicUser(user) });
  setSessionCookie(res, token, expiresAt);
  return res;
}
