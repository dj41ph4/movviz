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

test("Retired preferences (design choice, smooth mode) are no longer stored; the others keep round-tripping", async () => {
  assert.equal((await GET(request(null))).status, 401);
  assert.equal((await PATCH(request(null, { locale: "en" }))).status, 401);
  saveUserPrefs("design-a", { locale: "fr", specialEpisodesEnabled: true });
  const saved = await PATCH(request(token, { designMode: "stable", reduceAnimations: true, smoothnessPromptUntil: Date.now() + 1000, locale: "en", userId: "design-b" }));
  assert.equal(saved.status, 200);
  const prefs = (await saved.json()).prefs as Record<string, unknown>;
  assert.equal(prefs.locale, "en");
  assert.equal(prefs.specialEpisodesEnabled, true);
  for (const retired of ["designMode", "reduceAnimations", "smoothnessPromptUntil"]) assert.equal(prefs[retired], undefined, retired);
  assert.notEqual(loadUserPrefs("design-b").locale, "en", "another profile is untouched");
  flushPendingJsonWritesSync();
  const persisted = JSON.parse(readFileSync(path.join(process.env.MOVVIZ_CONFIG_DIR!, "user-preferences.json"), "utf8"));
  assert.equal(persisted["design-a"].designMode, undefined);
  assert.equal(persisted["design-a"].reduceAnimations, undefined);
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

test("phones and tablets get the Beta theme without touching desktop", async () => {
  const { buildCompactBetaCss } = await import("./build-compact-beta-css.mjs");
  const generated = await readFile(new URL("../src/components/appearance/design-beta-compact.generated.css", import.meta.url), "utf8");
  assert.equal(generated.replace(/\r\n/g, "\n"), (await buildCompactBetaCss()).replace(/\r\n/g, "\n"), "run: node scripts/build-compact-beta-css.mjs");
  for (const file of ["design-beta-compact.generated.css", "design-beta-compact.css"]) {
    const css = await readFile(new URL(`../src/components/appearance/${file}`, import.meta.url), "utf8");
    postcss.parse(css).walkRules((rule) => {
      for (const selector of rule.selectors) assert.ok(/^(html|:root)\[data-movviz-(design|appearance)="beta"\]/.test(selector), `${file}: ${selector}`);
      let parent: Node | undefined = rule.parent;
      let compact = false;
      while (parent) {
        if (parent.type === "atrule" && (parent as AtRule).name === "media" && /max-width: (1023|639)\.98px/.test((parent as AtRule).params)) compact = true;
        parent = parent.parent;
      }
      assert.ok(compact, `${file}: ${rule.selector}`);
    });
  }
});
