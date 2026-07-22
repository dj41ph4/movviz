import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

const HEX64 = /^[0-9a-f]{64}$/;

function isValidSessionCookie(value: string | undefined): boolean {
  if (!value) return false;
  // Signed format: 64 hex chars + "." + 64 hex chars
  const dot = value.indexOf(".");
  if (dot > 0) {
    return dot === 64 && value.length === 129 && HEX64.test(value.slice(0, dot)) && HEX64.test(value.slice(dot + 1));
  }
  // Legacy format: exactly 64 hex chars
  return value.length === 64 && HEX64.test(value);
}

const PUBLIC_API_PREFIXES = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/auth/plex/pin",
  "/api/auth/plex/poll",
  "/api/healthz",
  "/api/library/import",
  "/api/activity/log",
];

function isPublicApi(pathname: string) {
  return PUBLIC_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isStaticAsset = pathname.startsWith("/_next") || /\.[a-z0-9]+$/i.test(pathname);
  const cookie = req.cookies.get(SESSION_COOKIE)?.value;

  if (pathname.startsWith("/api")) {
    if (isStaticAsset || isPublicApi(pathname) || isValidSessionCookie(cookie)) return NextResponse.next();
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (isStaticAsset || pathname === "/login") return NextResponse.next();

  if (!isValidSessionCookie(cookie)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
