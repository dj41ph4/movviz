import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, test } from "node:test";
import { NextRequest } from "next/server";

// Config isolée avant l'import des stores : jamais les vrais comptes.
const config = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-privacy-consent-"));
process.env.MOVVIZ_CONFIG_DIR = config;
process.env.MOVVIZ_DATA_DIR = config;
delete process.env.MOVVIZ_REQUIRE_PRIVACY_CONSENT;

const register = await import("../src/app/api/auth/register/route.ts");
const consentRoute = await import("../src/app/api/privacy/consent/route.ts");
const { proxy } = await import("../src/proxy.ts");
const { PRIVACY_POLICY_VERSION, getInstanceConsent } = await import("../src/lib/privacy/consent.ts");
const { flushPendingJsonWritesSync } = await import("../src/lib/fsJsonCache.ts");

after(() => {
  flushPendingJsonWritesSync();
  fs.rmSync(config, { recursive: true, force: true });
});

const post = (url: string, body: unknown) =>
  new NextRequest(`http://localhost${url}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

/**
 * Le consentement explicite n'est exigé que par le paquet UGREEN
 * (MOVVIZ_REQUIRE_PRIVACY_CONSENT=1). Toutes les autres installations doivent
 * garder exactement leur comportement.
 */
test("hors paquet UGREEN : aucune exigence, l'inscription fonctionne comme avant", async () => {
  const info = await (await consentRoute.GET()).json();
  assert.equal(info.required, false);
  const res = await register.POST(post("/api/auth/register", { username: "classic-admin", password: "password-123" }));
  assert.equal(res.status, 201, "le premier compte se crée sans case cochée");
  assert.equal((await res.json()).user.role, "admin");
  assert.equal(getInstanceConsent(), null, "rien n'est enregistré");
  assert.equal((await consentRoute.POST(post("/api/privacy/consent", { accept: true }))).status, 400);
});

test("paquet UGREEN : /privacy et /help sont publics, comme l'API de consentement", () => {
  for (const pathname of ["/privacy", "/help"]) {
    const response = proxy(new NextRequest(`http://localhost${pathname}`));
    assert.equal(response.headers.get("x-middleware-next"), "1", `${pathname} ne doit pas rediriger vers /login`);
  }
  const api = proxy(new NextRequest("http://localhost/api/privacy/consent"));
  assert.equal(api.headers.get("x-middleware-next"), "1");
  const other = proxy(new NextRequest("http://localhost/library"));
  assert.notEqual(other.headers.get("x-middleware-next"), "1", "les autres pages restent protégées");
});

test("paquet UGREEN : une inscription sans case cochée est refusée, avec la case elle est acceptée et tracée", async () => {
  process.env.MOVVIZ_REQUIRE_PRIVACY_CONSENT = "1";
  try {
    const info = await (await consentRoute.GET()).json();
    assert.equal(info.required, true);
    assert.equal(info.version, PRIVACY_POLICY_VERSION);

    const refused = await register.POST(post("/api/auth/register", { username: "second-user", password: "password-123" }));
    assert.equal(refused.status, 400);
    assert.equal((await refused.json()).error, "privacy_consent_required");

    const falsy = await register.POST(post("/api/auth/register", { username: "second-user", password: "password-123", privacyConsent: "true" }));
    assert.equal(falsy.status, 400, "seul le booléen true compte");

    const accepted = await register.POST(post("/api/auth/register", { username: "second-user", password: "password-123", privacyConsent: true }));
    assert.equal(accepted.status, 201);
    const userId = (await accepted.json()).user.id as string;

    const stored = JSON.parse(
      (flushPendingJsonWritesSync(), fs.readFileSync(path.join(config, "privacy-consent.json"), "utf8"))
    ) as { users: Record<string, { version: string; acceptedAt: string }> };
    assert.equal(stored.users[userId].version, PRIVACY_POLICY_VERSION);
    assert.ok(!Number.isNaN(Date.parse(stored.users[userId].acceptedAt)), "date et heure d'acceptation enregistrées");
  } finally {
    delete process.env.MOVVIZ_REQUIRE_PRIVACY_CONSENT;
  }
});

test("le consentement d'installation ne peut plus être réécrit une fois un compte créé", async () => {
  process.env.MOVVIZ_REQUIRE_PRIVACY_CONSENT = "1";
  try {
    const res = await consentRoute.POST(post("/api/privacy/consent", { accept: true }));
    assert.equal(res.status, 409);
  } finally {
    delete process.env.MOVVIZ_REQUIRE_PRIVACY_CONSENT;
  }
});
