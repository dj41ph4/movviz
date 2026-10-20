import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import postcss, { type AtRule, type Node } from "postcss";
import { DESIGN_MODE } from "../src/lib/appearance/designMode.ts";

process.env.MOVVIZ_CONFIG_DIR = mkdtempSync(path.join(os.tmpdir(), "movviz-design-mode-"));
const { addUser, createSession } = await import("../src/lib/auth/store.ts");
const { loadUserPrefs, saveUserPrefs } = await import("../src/lib/userPrefs/store.ts");
const { flushPendingJsonWritesSync } = await import("../src/lib/fsJsonCache.ts");
const { GET, PATCH } = await import("../src/app/api/settings/preferences/route.ts");
const { SESSION_COOKIE } = await import("../src/lib/auth/session.ts");
const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server");

for (const id of ["design-a", "design-b"]) addUser({
  id, username: id, passwordHash: null, role: "user", status: "approved",
  autoApproveRequests: false, autoRequestFromWatchlist: false, discoverContinents: [],
  requestLimitMovies: null, requestLimitSeries: null, canManageRequests: false,
  plexId: null, plexToken: null, plexManagedUserId: null, plexAvatar: null, customAvatar: null, createdAt: Date.now(),
});
const token = createSession("design-a").token;
function request(session: string | null, body?: unknown) {
  return new NextRequest("http://localhost/api/settings/preferences", {
    method: body === undefined ? "GET" : "PATCH",
    headers: { ...(session ? { cookie: `${SESSION_COOKIE}=${session}` } : {}), "content-type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test("Beta is the only design, whatever a profile stored before", async () => {
  assert.equal(DESIGN_MODE, "beta");
  const layout = await readFile(new URL("../src/app/layout.tsx", import.meta.url), "utf8");
  assert.ok(layout.includes("const designMode = DESIGN_MODE;"));
  assert.ok(!layout.includes("loadUserPrefs"), "the root layout no longer reads a per-user design choice");
});

test("Beta round-trips through the authenticated API; Stable restores it without changing another profile or preferences", async () => {
  assert.equal((await GET(request(null))).status, 401);
  assert.equal((await PATCH(request(null, { designMode: "beta" }))).status, 401);
  saveUserPrefs("design-a", { locale: "fr", reduceAnimations: true, specialEpisodesEnabled: true });
  const saved = await PATCH(request(token, { designMode: "beta", userId: "design-b" }));
  assert.equal(saved.status, 200);
  assert.equal((await saved.json()).prefs.designMode, "beta");
  const secondClient = await (await GET(request(token))).json();
  assert.equal(secondClient.prefs.designMode, "beta");
  flushPendingJsonWritesSync();
  const persistedBeta = JSON.parse(readFileSync(path.join(process.env.MOVVIZ_CONFIG_DIR!, "user-preferences.json"), "utf8"));
  assert.equal(persistedBeta["design-a"].designMode, "beta");
  assert.equal(loadUserPrefs("design-b").designMode, undefined);
  assert.equal(loadUserPrefs("design-a").reduceAnimations, true);
  assert.equal(loadUserPrefs("design-a").specialEpisodesEnabled, true);
  await PATCH(request(token, { locale: "en" }));
  assert.equal(loadUserPrefs("design-a").designMode, "beta");
  await PATCH(request(token, { designMode: "invalid" }));
  assert.equal(loadUserPrefs("design-a").designMode, "beta");
  await PATCH(request(token, { designMode: "stable" }));
  const restored = await (await GET(request(token))).json();
  assert.equal(restored.prefs.designMode, "stable");
  assert.equal(restored.prefs.locale, "en");
  assert.equal(restored.prefs.reduceAnimations, true);
  assert.equal(restored.prefs.specialEpisodesEnabled, true);
  flushPendingJsonWritesSync();
  const persistedStable = JSON.parse(readFileSync(path.join(process.env.MOVVIZ_CONFIG_DIR!, "user-preferences.json"), "utf8"));
  assert.equal(persistedStable["design-a"].designMode, "stable");
});

test("every design rule requires Beta and desktop, including motion and portal content", async () => {
  const css = await readFile(new URL("../src/components/appearance/design-beta.css", import.meta.url), "utf8");
  postcss.parse(css).walkRules((rule) => {
    for (const selector of rule.selectors) assert.ok(selector.startsWith('html[data-movviz-design="beta"]'), selector);
    let parent: Node | undefined = rule.parent;
    let desktop = false;
    while (parent) {
      if (parent.type === "atrule" && (parent as AtRule).name === "media" && (parent as AtRule).params.includes("min-width: 1024px")) desktop = true;
      parent = parent.parent;
    }
    assert.ok(desktop, rule.selector);
  });
  assert.ok(css.includes("prefers-reduced-motion: reduce"));
  assert.ok(css.includes(':not(.reduce-motion)'));
  assert.ok(css.includes("(hover: hover) and (pointer: fine)"));
  assert.ok(css.includes("[data-premium-preview]"));
  assert.ok(css.includes("[data-premium-panel]"));
});
