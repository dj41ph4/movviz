import type { NextRequest, NextResponse } from "next/server";
import { resolveSession } from "./store";
import type { User } from "./types";
import { SESSION_COOKIE } from "./constants";

export { SESSION_COOKIE };

export function getCurrentUser(req: NextRequest): User | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  return resolveSession(token);
}

/** Vrai si le navigateur a joint Movviz en HTTPS (directement ou derrière un proxy inverse). */
function arrivedOverHttps(req: NextRequest | undefined): boolean {
  if (!req) return false;
  const forwarded = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  return forwarded ? forwarded === "https" : req.nextUrl.protocol === "https:";
}

export function setSessionCookie(res: NextResponse, token: string, expiresAt: number, req?: NextRequest) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    expires: new Date(expiresAt),
    // En HTTPS, le cookie ne repart jamais en clair. Une connexion faite en HTTP (réseau local, développement)
    // garde le comportement d'origine, sinon le navigateur refuserait le cookie.
    ...(arrivedOverHttps(req) ? { secure: true } : {}),
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}
