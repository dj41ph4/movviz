import assert from "node:assert/strict";
import { after, test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

// Import stores only after isolating their config directory. Never write into
// the operator's actual accounts/history while testing device authentication.
const config = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-tizen-test-"));
process.env.MOVVIZ_CONFIG_DIR = config;
const { POST, OPTIONS } = await import("../src/app/api/tv/client/route.ts");
const { addUser, createSession, resolveSession, destroySession } = await import("../src/lib/auth/store.ts");
const { hashPassword } = await import("../src/lib/auth/password.ts");
const { flushPendingJsonWritesSync } = await import("../src/lib/fsJsonCache.ts");
const { createSession: engineSession, getSession, endSession } = await import("../src/lib/playback/engine/sessionManager.ts");
const { proxy } = await import("../src/proxy.ts");
const user = {
  id: "tizen-test-user", username: "tv-test", passwordHash: hashPassword("tv-test-password"), role: "user" as const,
  status: "approved" as const, autoApproveRequests: false, autoRequestFromWatchlist: false, discoverContinents: [],
  requestLimitMovies: null, requestLimitSeries: null, canManageRequests: false, plexId: null, plexToken: null,
  plexManagedUserId: null, plexAvatar: null, customAvatar: null, createdAt: Date.now(),
};
addUser(user);
const session = createSession(user.id).token;
function request(body: unknown, token?: string, cookie?: string) {
  return new NextRequest("http://localhost/api/tv/client", {
    method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(cookie ? { Cookie: `movviz_session=${cookie}` } : {}) },
    body: JSON.stringify(body),
  });
}
after(() => {
  destroySession(session); flushPendingJsonWritesSync();
  // Known flat fixture directory: remove only its own files, no recursive rm.
  for (const entry of fs.readdirSync(config, { withFileTypes: true })) if (entry.isFile()) fs.unlinkSync(path.join(config, entry.name));
  try { fs.rmdirSync(config); } catch { /* leave nested test artifacts if any */ }
});

test("Tizen preflight reaches the route through proxy and never grants cookie credentials", async () => {
  const preflight = new NextRequest("http://localhost/api/tv/client", { method: "OPTIONS" });
  assert.equal(proxy(preflight).headers.get("x-middleware-next"), "1");
  const result = await OPTIONS(); assert.equal(result.status, 204);
  assert.equal(result.headers.get("Access-Control-Allow-Origin"), "*");
  assert.equal(result.headers.has("Access-Control-Allow-Credentials"), false);
});
test("Tizen bridge rejects anonymous requests and ignores browser session cookies", async () => {
  assert.equal((await POST(request({ path: "/api/auth/me" }))).status, 401);
  assert.equal((await POST(request({ path: "/api/auth/me" }, undefined, session))).status, 401);
  assert.equal((await POST(request({ path: "/api/auth/me" }, "0".repeat(64) + "." + "0".repeat(64)))).status, 401);
});
test("Tizen login returns a usable session without leaking credentials or Plex tokens", async () => {
  const result = await POST(request({ path: "/api/auth/login", method: "POST", body: { username: user.username, password: "tv-test-password" } }));
  assert.equal(result.status, 200); const data = await result.json();
  assert.equal(resolveSession(data.session)?.id, user.id);
  assert.equal(data.user.passwordHash, undefined); assert.equal(data.user.plexToken, undefined);
  assert.equal(result.headers.has("set-cookie"), false);
  const me = await POST(request({ path: "/api/auth/me" }, data.session)); assert.equal((await me.json()).user.id, user.id);
  const logout = await POST(request({ path: "/api/auth/logout", method: "POST" }, data.session)); assert.equal(logout.status, 200);
  assert.equal(resolveSession(data.session), null);
});
test("Tizen bridge rejects pending accounts, unsafe paths, unsupported and destructive routes", async () => {
  addUser({ ...user, id: "pending", username: "pending", status: "pending" });
  const result = await POST(request({ path: "/api/auth/login", method: "POST", body: { username: "pending", password: "tv-test-password" } }));
  assert.equal(result.status, 403); assert.equal((await result.json()).session, undefined);
  for (const target of ["https://example.com", "//example.com/api/auth/me", "/api/auth/me#fragment"]) {
    assert.equal((await POST(request({ path: target }, session))).status, 400);
  }
  assert.equal((await POST(request({ path: "/api/library/movies", method: "DELETE" }, session))).status, 405);
  assert.equal((await POST(request({ path: "/api/users" }, session))).status, 404);
});
test("Tizen cannot touch or stop another user's engine session", async () => {
  const plan = { mode: "DIRECT_PLAY" as const, containerAction: "COPY" as const, videoAction: "COPY" as const, audioAction: "COPY" as const, subtitleAction: "NONE" as const, reasons: [] };
  const mine = engineSession({ userId: user.id, deviceId: "tv", clientType: "samsung-tizen", mediaId: "film", mode: "DIRECT_PLAY", videoAction: "COPY", audioAction: "COPY", subtitleAction: "NONE", plan });
  const other = engineSession({ userId: "another-user", deviceId: "tv2", clientType: "samsung-tizen", mediaId: "film2", mode: "DIRECT_PLAY", videoAction: "COPY", audioAction: "COPY", subtitleAction: "NONE", plan });
  try {
    assert.equal((await POST(request({ path: `/api/tv/engine/${other.sessionId}/stop`, method: "POST" }, session))).status, 404);
    assert.ok(getSession(other.sessionId));
    assert.equal((await POST(request({ path: `/api/tv/engine/${mine.sessionId}/heartbeat`, method: "POST" }, session))).status, 200);
    assert.equal((await POST(request({ path: `/api/tv/engine/${mine.sessionId}/stop`, method: "POST" }, session))).status, 200);
    assert.equal(getSession(mine.sessionId), null);
  } finally { endSession(mine.sessionId); endSession(other.sessionId); }
});

test("Device Plex polling requires its own unexpired challenge bound to the pin", async () => {
  const pins = (globalThis as typeof globalThis & { __movvizTizenPins: Map<string, { id: number; expires: number; polling: boolean }> }).__movvizTizenPins;
  for (const body of [{ id: 42 }, { id: 42, challenge: "unknown" }]) {
    assert.equal((await POST(request({ path: "/api/auth/plex/poll", method: "POST", body }))).status, 403);
  }
  pins.set("expired", { id: 42, expires: Date.now() - 1, polling: false });
  assert.equal((await POST(request({ path: "/api/auth/plex/poll", method: "POST", body: { id: 42, challenge: "expired" } }))).status, 403);
  pins.set("bound", { id: 42, expires: Date.now() + 60000, polling: false });
  assert.equal((await POST(request({ path: "/api/auth/plex/poll", method: "POST", body: { id: 43, challenge: "bound" } }))).status, 403);
  pins.set("cancel", { id: 42, expires: Date.now() + 60000, polling: false });
  assert.equal((await POST(request({ path: "/api/auth/plex/cancel", method: "POST", body: { id: 42, challenge: "cancel" } }))).status, 200);
  assert.equal(pins.has("cancel"), false);
  assert.equal((await POST(request({ path: "/api/auth/plex/poll", method: "POST", body: { id: 42, challenge: "cancel" } }))).status, 403);
});

test("Device preferences and watchlist keep authenticated account separation", async () => {
  addUser({ ...user, id: "tizen-second", username: "tv-second" }); const second = createSession("tizen-second").token;
  try {
    assert.equal((await POST(request({ path: "/api/settings/preferences", method: "PATCH", body: { locale: "de", userId: "tizen-second" } }, session))).status, 200);
    assert.equal((await (await POST(request({ path: "/api/settings/preferences" }, session))).json()).prefs.locale, "de");
    assert.notEqual((await (await POST(request({ path: "/api/settings/preferences" }, second))).json()).prefs.locale, "de");
    assert.equal((await POST(request({ path: "/api/watchlist", method: "POST", body: { tmdbId: 27205, type: "movie", title: "Inception", userId: "tizen-second" } }, session))).status, 201);
    assert.equal((await (await POST(request({ path: "/api/watchlist" }, session))).json()).items.length, 1);
    assert.equal((await (await POST(request({ path: "/api/watchlist" }, second))).json()).items.length, 0);
    assert.equal((await POST(request({ path: "/api/library/movies", method: "PATCH", body: {} }, session))).status, 404);
  } finally { destroySession(second); }
});

test("Device progress uses owned sessions from open to seek, stop and resume", async () => {
  const opened = await POST(request({ path: "/api/playback/sessions", method: "POST", body: { ratingKey: "fixture-film", mediaId: "fixture-film", mediaType: "movie", durationMs: 600000, tmdbId: 27205, title: "Inception" } }, session));
  assert.equal(opened.status, 200); const progress = await opened.json();
  const heartbeat = await POST(request({ path: `/api/playback/sessions/${progress.sessionId}/heartbeat`, method: "POST", body: { sequence: 1, positionMs: 120000, isPlaying: true, playbackRate: 1 } }, session));
  assert.equal(heartbeat.status, 200);
  assert.equal((await POST(request({ path: `/api/playback/sessions/${progress.sessionId}/seek`, method: "POST", body: { toMs: 180000 } }, session))).status, 200);
  assert.equal((await POST(request({ path: `/api/playback/sessions/${progress.sessionId}/stop`, method: "POST", body: { positionMs: 180000 } }, session))).status, 200);
});
