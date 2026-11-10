import assert from "node:assert/strict";
import { after, test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";

// Dossier de config isolé : jamais les vrais comptes.
const config = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-security-test-"));
process.env.MOVVIZ_CONFIG_DIR = config;

const login = await import("../src/app/api/auth/login/route.ts");
const { addUser } = await import("../src/lib/auth/store.ts");
const { hashPassword } = await import("../src/lib/auth/password.ts");
const { safeEqual } = await import("../src/lib/auth/rateLimit.ts");
const { sameIndexerSite } = await import("../src/lib/indexers/grabPayload.ts");
const person = await import("../src/app/api/metadata/person/route.ts");
const trending = await import("../src/app/api/metadata/trending/route.ts");
const catalog = await import("../src/app/api/indexers/catalog/route.ts");
const engineProxy = await import("../src/app/api/engine/[...path]/route.ts");

after(() => fs.rmSync(config, { recursive: true, force: true }));

addUser({ id: "u-sec", username: "alice", passwordHash: hashPassword("correct-horse"), role: "admin", status: "approved", createdAt: Date.now() } as never);

function attempt(username: string, password: string, ip: string) {
  return login.POST(new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": ip },
    body: JSON.stringify({ username, password }),
  }));
}

test("a correct password still signs in, and a few mistakes never lock the owner out", async () => {
  for (let i = 0; i < 5; i++) assert.equal((await attempt("alice", "wrong", "10.0.0.1")).status, 401);
  const ok = await attempt("alice", "correct-horse", "10.0.0.1");
  assert.equal(ok.status, 200);
  assert.ok(ok.cookies.get("movviz_session")?.value);
});

test("repeated failures are blocked, without touching another address", async () => {
  for (let i = 0; i < 8; i++) assert.equal((await attempt("alice", "wrong", "10.0.0.2")).status, 401);
  const blocked = await attempt("alice", "correct-horse", "10.0.0.2");
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get("retry-after")) > 0);
  assert.equal((await attempt("alice", "correct-horse", "10.0.0.3")).status, 200);
});

test("an unknown username answers exactly like a wrong password", async () => {
  const res = await attempt("nobody", "whatever", "10.0.0.4");
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { error: "invalid_credentials" });
});

test("safeEqual compares secrets without throwing on odd input", () => {
  assert.equal(safeEqual("abc", "abc"), true);
  assert.equal(safeEqual("abc", "abd"), false);
  assert.equal(safeEqual("abc", "abcd"), false);
  assert.equal(safeEqual(null, "abc"), false);
  assert.equal(safeEqual(undefined, undefined), false);
});

test("indexer credentials only follow a download URL on the indexer's own site", () => {
  assert.equal(sameIndexerSite("https://c411.org/api/download/1", "https://c411.org/api"), true);
  assert.equal(sameIndexerSite("https://dl.c411.org/t/1.torrent", "https://api.c411.org/api"), true);
  assert.equal(sameIndexerSite("http://192.168.1.10:9696/1/download?link=x", "http://192.168.1.10:9696/1/api"), true);
  assert.equal(sameIndexerSite("http://prowlarr:9696/1/download", "http://prowlarr:9696/1/api"), true);
  assert.equal(sameIndexerSite("https://evil.example/steal", "https://c411.org/api"), false);
  assert.equal(sameIndexerSite("http://192.168.1.11/steal", "http://192.168.1.10:9696"), false);
  assert.equal(sameIndexerSite("not a url", "https://c411.org/api"), false);
  assert.equal(sameIndexerSite("https://anything.example/x", null), true);
});

const FORGED = "0".repeat(64);
const forged = (url: string, method = "GET") => new NextRequest(url, { method, headers: { cookie: `movviz_session=${FORGED}` } });

test("a forged cookie no longer reads metadata or the indexer catalogue", async () => {
  assert.equal((await person.GET(forged("http://localhost/api/metadata/person?id=1"))).status, 401);
  assert.equal((await trending.GET(forged("http://localhost/api/metadata/trending"))).status, 401);
  assert.equal((await catalog.GET(forged("http://localhost/api/indexers/catalog"))).status, 401);
});

test("the engine proxy refuses dot segments before forwarding anything", async () => {
  const res = await engineProxy.GET(forged("http://localhost/api/engine/torrents/../factory-reset"), { params: Promise.resolve({ path: ["torrents", "..", "factory-reset"] }) });
  assert.equal(res.status, 404);
});

test("the session cookie is Secure over HTTPS and unchanged over plain HTTP", async () => {
  const over = (proto?: string) => login.POST(new NextRequest("http://localhost/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.9", ...(proto ? { "x-forwarded-proto": proto } : {}) },
    body: JSON.stringify({ username: "alice", password: "correct-horse" }),
  }));
  assert.match((await over("https")).headers.get("set-cookie") ?? "", /;\s*Secure/i);
  assert.doesNotMatch((await over("http")).headers.get("set-cookie") ?? "", /;\s*Secure/i);
  assert.doesNotMatch((await over()).headers.get("set-cookie") ?? "", /;\s*Secure/i);
});

test("management actions are refused to a regular account and still open to an admin", async () => {
  const { createSession } = await import("../src/lib/auth/store.ts");
  addUser({ id: "u-plain-sec", username: "bob", passwordHash: null, role: "user", status: "approved", createdAt: Date.now() } as never);
  const as = (id: string, url: string, method: string) => new NextRequest(url, { method, headers: { cookie: `movviz_session=${createSession(id).token}`, "content-type": "application/json" }, body: method === "GET" ? undefined : "{}" });
  const params = { params: Promise.resolve({ id: "missing", versionId: "v" }) };
  const movieSearch = await import("../src/app/api/library/movies/[id]/search/route.ts");
  const optimize = await import("../src/app/api/library/movies/[id]/optimize/route.ts");
  const versions = await import("../src/app/api/library/movies/[id]/versions/[versionId]/route.ts");
  const grab = await import("../src/app/api/indexers/grab/route.ts");
  assert.equal((await movieSearch.POST(as("u-plain-sec", "http://localhost/api/library/movies/missing/search", "POST"), params)).status, 403);
  assert.equal((await optimize.POST(as("u-plain-sec", "http://localhost/api/library/movies/missing/optimize", "POST"), params)).status, 403);
  assert.equal((await versions.DELETE(as("u-plain-sec", "http://localhost/api/library/movies/missing/versions/v", "DELETE"), params)).status, 403);
  assert.equal((await grab.POST(as("u-plain-sec", "http://localhost/api/indexers/grab", "POST"))).status, 403);
  // L'admin passe le contrôle d'accès : il obtient la réponse métier (film introuvable), pas un refus.
  assert.equal((await movieSearch.POST(as("u-sec", "http://localhost/api/library/movies/missing/search", "POST"), params)).status, 404);
  assert.equal((await versions.DELETE(as("u-sec", "http://localhost/api/library/movies/missing/versions/v", "DELETE"), params)).status, 404);
});

test("only an admin or an auto-approved account may complete a missing title, and never replace an existing file", async () => {
  const { createSession } = await import("../src/lib/auth/store.ts");
  const { canCompleteMissing } = await import("../src/lib/auth/permissions.ts");
  assert.equal(canCompleteMissing({ role: "admin", autoApproveRequests: false }), true);
  assert.equal(canCompleteMissing({ role: "user", autoApproveRequests: true }), true);
  assert.equal(canCompleteMissing({ role: "user", autoApproveRequests: false }), false);
  assert.equal(canCompleteMissing(null), false);

  addUser({ id: "u-auto-sec", username: "carol", passwordHash: null, role: "user", status: "approved", autoApproveRequests: true, createdAt: Date.now() } as never);
  const as = (id: string, url: string) => new NextRequest(url, { method: "POST", headers: { cookie: `movviz_session=${createSession(id).token}`, "content-type": "application/json" }, body: "{}" });
  const movieSearch = await import("../src/app/api/library/movies/[id]/search/route.ts");
  const optimize = await import("../src/app/api/library/movies/[id]/optimize/route.ts");
  const grab = await import("../src/app/api/indexers/grab/route.ts");
  const params = { params: Promise.resolve({ id: "missing" }) };
  // Le compte en acceptation automatique passe le contrôle d'accès de la complétion (réponse métier : film introuvable)…
  assert.equal((await movieSearch.POST(as("u-auto-sec", "http://localhost/api/library/movies/missing/search"), params)).status, 404);
  // …mais ni le remplacement ni le choix manuel d'une release.
  assert.equal((await optimize.POST(as("u-auto-sec", "http://localhost/api/library/movies/missing/optimize"), params)).status, 403);
  assert.equal((await grab.POST(as("u-auto-sec", "http://localhost/api/indexers/grab"))).status, 403);
});
