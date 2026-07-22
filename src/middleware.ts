import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

/**
 * Routes that must work with zero session: signing in, registering, the Plex
 * OAuth handshake (pre-session by definition), and infra probes that never
 * carry a cookie (Docker HEALTHCHECK). Everything else under /api/* now
 * requires the session cookie to be present — previously /api/* was exempted
 * entirely here, and auth was left to each route calling requireUser()/
 * requireAdmin() individually. Several never did, which meant the download
 * engine, the filesystem browser and other sensitive endpoints were reachable
 * by anyone who could reach the web port, logged in or not.
 */
const PUBLIC_API_PREFIXES = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/auth/me",
  "/api/auth/plex/pin",
  "/api/auth/plex/poll",
  "/api/healthz",
  // Called by the download engine itself (import-complete, activity events),
  // never by a browser — no session cookie to check here. Each route verifies
  // the shared x-movviz-token itself instead (Edge middleware can't read the
  // token file to do that check here).
  "/api/library/import",
  "/api/activity/log",
];

function isPublicApi(pathname: string) {
  return PUBLIC_API_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/**
 * Gate every page — and now every API route — behind a session. Auth is
 * enforced by presence of a signed cookie here; the actual session validity
 * (and role checks) are re-verified server-side by each route via
 * getCurrentUser()/requireUser(), since middleware can't touch the
 * filesystem-backed session store on the Edge runtime. This is a coarse
 * outer gate — it exists so a caller with no cookie at all never reaches a
 * route, even one that forgot its own auth check, not to replace per-route
 * validation.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isStaticAsset = pathname.startsWith("/_next") || /\.[a-z0-9]+$/i.test(pathname);
  const hasCookie = !!req.cookies.get(SESSION_COOKIE)?.value;

  if (pathname.startsWith("/api")) {
    if (isStaticAsset || isPublicApi(pathname) || hasCookie) return NextResponse.next();
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (isStaticAsset || pathname === "/login") return NextResponse.next();

  if (!hasCookie) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
