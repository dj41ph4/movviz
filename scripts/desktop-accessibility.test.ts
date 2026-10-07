import assert from "node:assert/strict";
import { test, after } from "node:test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { desktopTextScaleOrDefault } from "../src/lib/accessibility/textScale.ts";

const require = createRequire(import.meta.url);
const postcss = require("postcss");
const typography = require("./postcss-desktop-text-scale.cjs");

test("text scaling preserves responsive nesting, theme cascade and the original declarations", async () => {
  const source = '@layer utilities{.label{font-size:12px;width:40px}.wide{@media(min-width:1200px){font-size:16px}}}html[data-movviz-appearance="beta"] .label{font:500 13px/1.2 sans-serif}';
  const result = await postcss([typography()]).process(source, { from: undefined });
  const root = postcss.parse(result.css);
  const enlarged: string[] = [];
  root.walkAtRules("media", (rule: { params: string; toString(): string; remove(): void }) => {
    if (rule.params === "(min-width: 1024px)") { enlarged.push(rule.toString()); rule.remove(); }
  });
  assert.equal(root.toString(), source);
  assert.ok(enlarged.some(rule => rule.includes('@media(min-width:1200px){font-size:calc(16px')));
  assert.ok(enlarged.some(rule => rule.includes('[data-movviz-appearance="beta"] .label') && rule.includes('calc(13px')));
  for (const rule of enlarged) postcss.parse(rule).walkDecls("width", () => assert.fail("media geometry changed"));
});

test("legacy and invalid profile values keep the standard rendering", () => {
  for (const value of [undefined, null, "120", 99, 125, {}, NaN]) assert.equal(desktopTextScaleOrDefault(value), 100);
});

const sandbox = await fs.mkdtemp(path.join(os.tmpdir(), "movviz-desktop-accessibility-"));
process.env.MOVVIZ_CONFIG_DIR = sandbox;
const { addUser, createSession, getUserById } = await import("../src/lib/auth/store.ts");
const { GET, PUT } = await import("../src/app/api/profile/accessibility/route.ts");
const { SESSION_COOKIE } = await import("../src/lib/auth/session.ts");
const { NextRequest } = require("next/server");
const account = (id: string, role: "user" | "admin" = "user") => ({
  id, username: id, passwordHash: null, role, status: "approved" as const,
  autoApproveRequests: false, autoRequestFromWatchlist: false, discoverContinents: [],
  requestLimitMovies: null, requestLimitSeries: null, canManageRequests: false,
  plexId: null, plexToken: null, plexManagedUserId: null, plexAvatar: null, customAvatar: null, createdAt: Date.now(),
});
addUser(account("reader-a"));
addUser(account("reader-b"));
addUser(account("reader-admin", "admin"));
const token = createSession("reader-a").token;
const adminToken = createSession("reader-admin").token;
function request(session: string | null, body?: unknown) {
  return new NextRequest("http://localhost/api/profile/accessibility", {
    method: body === undefined ? "GET" : "PUT",
    headers: { ...(session ? { cookie: `${SESSION_COOKIE}=${session}` } : {}), "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test("preference belongs only to the authenticated profile and persists for another client", async () => {
  assert.equal((await GET(request(null))).status, 401);
  assert.deepEqual(await (await GET(request(token))).json(), { desktopTextScale: 100 });
  assert.equal((await PUT(request(token, { desktopTextScale: 120, userId: "reader-b" }))).status, 200);
  assert.equal(getUserById("reader-b")?.desktopTextScale, undefined);
  assert.deepEqual(await (await GET(request(token))).json(), { desktopTextScale: 120 });
  assert.equal((await PUT(request(token, { desktopTextScale: "110" }))).status, 400);
  assert.equal(getUserById("reader-a")?.desktopTextScale, 120);
  assert.equal((await PUT(request(adminToken, { desktopTextScale: 110, userId: "reader-a" }))).status, 200);
  assert.equal(getUserById("reader-a")?.desktopTextScale, 120);
  assert.equal(getUserById("reader-admin")?.desktopTextScale, 110);
  await new Promise(resolve => setTimeout(resolve, 450));
  const stored = JSON.parse(await fs.readFile(path.join(sandbox, "users.json"), "utf8"));
  assert.equal(stored.find((user: { id: string }) => user.id === "reader-a").desktopTextScale, 120);
  assert.equal((await PUT(request(token, { desktopTextScale: 100 }))).status, 200);
  assert.deepEqual(await (await GET(request(token))).json(), { desktopTextScale: 100 });
});

after(async () => {
  await new Promise(resolve => setTimeout(resolve, 450));
  const resolved = path.resolve(sandbox);
  if (!resolved.startsWith(path.resolve(os.tmpdir()) + path.sep) || !path.basename(resolved).startsWith("movviz-desktop-accessibility-")) throw new Error("unsafe_test_cleanup");
  await fs.rm(resolved, { recursive: true, force: true });
});
