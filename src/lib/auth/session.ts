import type { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "./store";
import type { User } from "./types";
import { SESSION_COOKIE } from "./constants";

export { SESSION_COOKIE };

export function getCurrentUser(req: NextRequest): User | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  return resolveSession(token);
}

export function setSessionCookie(res: NextResponse, token: string, expiresAt: number) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}
