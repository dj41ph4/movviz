import assert from "node:assert/strict";
import { after, test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

// Isoler le dossier de config avant d'importer les stores : le test ne doit
// jamais toucher la vraie clé TMDB ni les vrais comptes.
const config = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-auth-guard-test-"));
process.env.MOVVIZ_CONFIG_DIR = config;
delete process.env.MOVVIZ_TMDB_API_KEY;

const { proxy } = await import("../src/proxy.ts");
const keyRoute = await import("../src/app/api/metadata/key/route.ts");
const keyTestRoute = await import("../src/app/api/metadata/key/test/route.ts");
const { addUser, createSession } = await import("../src/lib/auth/store.ts");

after(() => fs.rmSync(config, { recursive: true, force: true }));

// Un cookie inventé a la bonne forme : le proxy (qui ne lit pas le disque) le
// laisse passer, c'est donc à chaque route de vérifier la session.
const FORGED = "0".repeat(64);
const URL = "http://localhost/api/metadata/key";

function req(method: string, cookie?: string, body?: unknown) {
  return new NextRequest(URL, {
    method,
    headers: { ...(cookie ? { cookie: `movviz_session=${cookie}` } : {}), "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

test("a forged session cookie still gets past the format-only proxy", () => {
  assert.equal(proxy(req("PUT", FORGED)).headers.get("x-middleware-next"), "1");
});

test("the TMDB key cannot be replaced, cleared or tested without an admin session", async () => {
  assert.equal((await keyRoute.PUT(req("PUT", FORGED, { apiKey: "attacker" }))).status, 403);
  assert.equal((await keyRoute.DELETE(req("DELETE", FORGED))).status, 403);
  assert.equal((await keyRoute.GET(req("GET", FORGED))).status, 401);
  assert.equal((await keyTestRoute.GET(req("GET", FORGED))).status, 403);

  const plain = addUser({ id: "u-plain", username: "plain", role: "user", status: "approved", createdAt: Date.now() } as never);
  const plainSession = createSession(plain.id).token;
  assert.equal((await keyRoute.PUT(req("PUT", plainSession, { apiKey: "user" }))).status, 403);

  const admin = addUser({ id: "u-admin", username: "admin", role: "admin", status: "approved", createdAt: Date.now() } as never);
  const adminSession = createSession(admin.id).token;
  assert.equal((await keyRoute.GET(req("GET", adminSession))).status, 200);
});

// Garde-fou : toute route API qui modifie quelque chose doit vérifier
// l'appelant elle-même. Les seules exceptions sont les routes d'authentification
// (elles créent la session) et celles qui ont leur propre jeton.
const AUTH_MARKERS = /requireAdmin|requireUser|getCurrentUser|getEngineToken|requireExtensionUser|resolveSession|Bearer/;
const EXEMPT = new Set([
  "auth/login", "auth/logout", "auth/register",
  "auth/plex/pin", "auth/plex/tv-pin", "auth/plex/poll",
]);

function routeFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? routeFiles(p) : e.name === "route.ts" ? [p] : [];
  });
}

test("every mutating API route checks its caller itself", () => {
  const apiDir = path.join(process.cwd(), "src/app/api");
  const unguarded = routeFiles(apiDir)
    .map((f) => ({ f, rel: path.relative(apiDir, path.dirname(f)).split(path.sep).join("/"), src: fs.readFileSync(f, "utf8") }))
    .filter(({ rel, src }) => !EXEMPT.has(rel) && /export async function (PUT|POST|PATCH|DELETE)\b/.test(src) && !AUTH_MARKERS.test(src))
    .map(({ rel }) => rel);
  assert.deepEqual(unguarded, []);
});
