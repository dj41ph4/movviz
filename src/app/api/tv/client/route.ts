import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { destroySession, resolveSession } from "@/lib/auth/store";
import { toPublicUser } from "@/lib/auth/types";
import { POST as login } from "@/app/api/auth/login/route";
import { randomBytes } from "node:crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Packaged widgets have a different origin from their Movviz server. This
// bridge accepts an explicit device session ONLY: browser cookies are ignored.
// CORS never grants credentials, and delegation preserves existing route guards.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Cache-Control": "no-store",
};
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: cors });
interface DevicePin { id: number; expires: number; polling: boolean }
const state = globalThis as typeof globalThis & { __movvizTizenPins?: Map<string, DevicePin> };
const pins = state.__movvizTizenPins ??= new Map<string, DevicePin>();

async function deviceLogin(response: NextResponse) {
  const data = await response.json();
  if (!response.ok) return reply(data, response.status);
  const session = response.cookies.get(SESSION_COOKIE)?.value;
  const loggedIn = resolveSession(session);
  if (!loggedIn || loggedIn.status === "pending") {
    destroySession(session);
    return reply({ error: "account_pending" }, 403);
  }
  return reply({ done: true, user: toPublicUser(loggedIn), session, cookieName: SESSION_COOKIE });
}

export async function OPTIONS() { return new NextResponse(null, { status: 204, headers: cors }); }

export async function POST(req: NextRequest) {
  let envelope: { path?: unknown; method?: unknown; body?: unknown };
  try {
    const raw = await req.text();
    if (raw.length > 65536) return reply({ error: "request_too_large" }, 413);
    envelope = JSON.parse(raw);
    if (!envelope || typeof envelope !== "object") return reply({ error: "invalid_json" }, 400);
  } catch { return reply({ error: "invalid_json" }, 400); }
  if (typeof envelope.path !== "string" || !/^\/api\/[a-zA-Z0-9/_?=&%:.,-]+$/.test(envelope.path)) return reply({ error: "invalid_path" }, 400);
  const method = envelope.method ?? "GET";
  if (method !== "GET" && method !== "POST" && method !== "PATCH") return reply({ error: "method_not_allowed" }, 405);
  // No HTTP request to a supplied URL: dispatch a fixed set of local handlers.
  const url = new URL(envelope.path, "http://movviz.internal");
  const path = url.pathname;
  const token = req.headers.get("authorization")?.match(/^Bearer ([0-9a-f]{64}\.[0-9a-f]{64})$/)?.[1];
  const user = resolveSession(token);
  const delegated = new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Cookie: `${SESSION_COOKIE}=${token}` } : {}) },
    ...(method !== "GET" ? { body: JSON.stringify(envelope.body ?? {}) } : {}),
  });
  if (path === "/api/tv/status" && method === "GET") {
    return reply({ service: "movviz", deviceAuth: 1 });
  }
  if (path === "/api/auth/plex/tv-pin" && method === "POST") {
    for (const [key, pin] of pins) if (pin.expires <= Date.now()) pins.delete(key);
    if (pins.size >= 256) return reply({ error: "too_many_pending_logins" }, 429);
    try {
      const response = await (await import("@/app/api/auth/plex/tv-pin/route")).POST();
      const data = await response.json();
      if (!response.ok) return reply(data, response.status);
      const challenge = randomBytes(32).toString("hex");
      pins.set(challenge, { id: data.id, expires: Date.now() + 120000, polling: false });
      return reply({ ...data, challenge });
    } catch { return reply({ error: "plex_unreachable" }, 502); }
  }
  if ((path === "/api/auth/plex/poll" || path === "/api/auth/plex/cancel") && method === "POST") {
    const body = envelope.body as { id?: unknown; challenge?: unknown } | null;
    const challenge = typeof body?.challenge === "string" ? body.challenge : "";
    const pin = pins.get(challenge);
    if (!pin || pin.expires <= Date.now() || pin.id !== Number(body?.id)) {
      pins.delete(challenge); return reply({ error: "invalid_device_challenge" }, 403);
    }
    if (path.endsWith("cancel")) { pins.delete(challenge); return reply({ ok: true }); }
    if (pin.polling) return reply({ done: false });
    pin.polling = true;
    try {
      const response = await (await import("@/app/api/auth/plex/poll/route")).POST(delegated);
      if (pins.get(challenge) !== pin || pin.expires <= Date.now()) {
        destroySession(response.cookies.get(SESSION_COOKIE)?.value);
        return reply({ error: "invalid_device_challenge" }, 403);
      }
      // Never issue a device session from a pin id supplied without the
      // independent, unguessable challenge returned to its initiating widget.
      if (response.cookies.get(SESSION_COOKIE)) { pins.delete(challenge); return await deviceLogin(response); }
      const data = await response.json();
      if (!response.ok) pins.delete(challenge);
      return reply(data, response.status);
    } catch { return reply({ error: "plex_unreachable" }, 502); }
    finally { pin.polling = false; }
  }
  if (path === "/api/auth/login" && method === "POST") {
    const credentials = envelope.body as { username?: unknown; password?: unknown } | null;
    if (!credentials || typeof credentials.username !== "string" || typeof credentials.password !== "string") return reply({ error: "invalid_credentials" }, 400);
    try { return await deviceLogin(await login(delegated)); }
    catch { return reply({ error: "invalid_credentials" }, 400); }
  }
  if (!user || user.status === "pending") return reply({ error: "unauthorized" }, 401);
  if (path === "/api/auth/me" && method === "GET") return reply({ user: toPublicUser(user) });
  if (path === "/api/auth/logout" && method === "POST") {
    destroySession(token);
    return reply({ ok: true });
  }
  let response: Response;
  try {
    if (method === "PATCH") {
      if (path !== "/api/settings/preferences") return reply({ error: "route_not_supported" }, 404);
      response = await (await import("@/app/api/settings/preferences/route")).PATCH(delegated);
      return reply(await response.json(), response.status);
    }
    const engine = /^\/api\/tv\/engine\/([^/]+)\/(heartbeat|stop)$/.exec(path);
    if (method === "POST" && engine) {
      const { getSession, touchSession, endSession } = await import("@/lib/playback/engine/sessionManager");
      const session = getSession(engine[1]);
      if (!session || session.userId !== user.id || session.clientType !== "samsung-tizen") return reply({ error: "session_not_found" }, 404);
      if (engine[2] === "stop") {
        if (session.transcoderPid !== null) {
          const { stopTranscoderForPid } = await import("@/lib/playback/engine/transcoderExecutor");
          stopTranscoderForPid(session.transcoderPid);
        }
        endSession(session.sessionId);
      }
      else touchSession(session.sessionId);
      return reply({ ok: true });
    }
    if (method === "GET") {
      switch (path) {
        case "/api/settings/preferences": response = await (await import("@/app/api/settings/preferences/route")).GET(delegated); break;
        case "/api/watchlist": response = await (await import("@/app/api/watchlist/route")).GET(delegated); break;
        case "/api/interface/dashboard": response = await (await import("@/app/api/interface/dashboard/route")).GET(delegated); break;
        case "/api/dashboard/hero": response = await (await import("@/app/api/dashboard/hero/route")).GET(delegated); break;
        case "/api/dashboard/layout": response = await (await import("@/app/api/dashboard/layout/route")).GET(delegated); break;
        case "/api/metadata/images": response = await (await import("@/app/api/metadata/images/route")).GET(delegated); break;
        case "/api/metadata/season": response = await (await import("@/app/api/metadata/season/route")).GET(delegated); break;
        case "/api/metadata/person": response = await (await import("@/app/api/metadata/person/route")).GET(delegated); break;
        case "/api/metadata/genres": response = await (await import("@/app/api/metadata/genres/route")).GET(delegated); break;
        case "/api/metadata/discover": response = await (await import("@/app/api/metadata/discover/route")).GET(delegated); break;
        case "/api/metadata/row-page": response = await (await import("@/app/api/metadata/row-page/route")).GET(delegated); break;
        case "/api/metadata/logos": response = await (await import("@/app/api/metadata/logos/route")).GET(delegated); break;
        case "/api/metadata/recommendations": response = await (await import("@/app/api/metadata/recommendations/route")).GET(delegated); break;
        case "/api/tv/preview": response = await (await import("@/app/api/tv/preview/route")).GET(delegated); break;
        case "/api/library/movies": response = await (await import("@/app/api/library/movies/route")).GET(delegated); break;
        case "/api/library/series": response = await (await import("@/app/api/library/series/route")).GET(delegated); break;
        case "/api/metadata/detail": response = await (await import("@/app/api/metadata/detail/route")).GET(delegated); break;
        case "/api/metadata/search": response = await (await import("@/app/api/metadata/search/route")).GET(delegated); break;
        case "/api/metadata/rows": response = await (await import("@/app/api/metadata/rows/route")).GET(delegated); break;
        case "/api/plex/on-deck": response = await (await import("@/app/api/plex/on-deck/route")).GET(delegated); break;
        case "/api/profile/media": response = await (await import("@/app/api/profile/media/route")).GET(delegated); break;
        case "/api/watch-status": response = await (await import("@/app/api/watch-status/route")).GET(delegated); break;
        case "/api/activity/v2": response = await (await import("@/app/api/activity/v2/route")).GET(delegated); break;
        default: {
          const series = /^\/api\/library\/series\/([^/]+)$/.exec(path);
          if (!series) return reply({ error: "route_not_supported" }, 404);
          response = await (await import("@/app/api/library/series/[id]/route")).GET(delegated, { params: Promise.resolve({ id: decodeURIComponent(series[1]) }) });
        }
      }
    } else {
      if (path === "/api/library/movies") response = await (await import("@/app/api/library/movies/route")).POST(delegated);
      else if (path === "/api/library/series") response = await (await import("@/app/api/library/series/route")).POST(delegated);
      else if (path === "/api/watchlist") response = await (await import("@/app/api/watchlist/route")).POST(delegated);
      else if (path === "/api/watch/toggle") response = await (await import("@/app/api/watch/toggle/route")).POST(delegated);
      else if (path === "/api/playback/prepare") response = await (await import("@/app/api/playback/prepare/route")).POST(delegated);
      else if (path === "/api/playback/sessions") response = await (await import("@/app/api/playback/sessions/route")).POST(delegated);
      else {
        const movieSearch = /^\/api\/library\/movies\/([^/]+)\/search$/.exec(path);
        const seriesSearch = /^\/api\/library\/series\/([^/]+)\/search$/.exec(path);
        const seasonSearch = /^\/api\/library\/series\/([^/]+)\/season\/(\d+)\/search$/.exec(path);
        if (movieSearch || seriesSearch || seasonSearch) {
          const id = decodeURIComponent((movieSearch || seriesSearch || seasonSearch)![1]);
          if (movieSearch) response = await (await import("@/app/api/library/movies/[id]/search/route")).POST(delegated, { params: Promise.resolve({ id }) });
          else if (seasonSearch) response = await (await import("@/app/api/library/series/[id]/season/[season]/search/route")).POST(delegated, { params: Promise.resolve({ id, season: seasonSearch[2] }) });
          else response = await (await import("@/app/api/library/series/[id]/search/route")).POST(delegated, { params: Promise.resolve({ id }) });
          return reply(await response.json(), response.status);
        }
        const session = /^\/api\/playback\/sessions\/([^/]+)\/(heartbeat|seek|stop|ended)$/.exec(path);
        if (!session) return reply({ error: "route_not_supported" }, 404);
        const context = { params: Promise.resolve({ sessionId: decodeURIComponent(session[1]) }) };
        switch (session[2]) {
          case "heartbeat": response = await (await import("@/app/api/playback/sessions/[sessionId]/heartbeat/route")).POST(delegated, context); break;
          case "seek": response = await (await import("@/app/api/playback/sessions/[sessionId]/seek/route")).POST(delegated, context); break;
          case "ended": response = await (await import("@/app/api/playback/sessions/[sessionId]/ended/route")).POST(delegated, context); break;
          default: response = await (await import("@/app/api/playback/sessions/[sessionId]/stop/route")).POST(delegated, context);
        }
      }
    }
    return reply(await response.json(), response.status);
  } catch { return reply({ error: "request_failed" }, 500); }
}
