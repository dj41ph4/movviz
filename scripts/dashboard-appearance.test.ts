import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DASHBOARD_MODES, DEFAULT_DASHBOARD_LAYOUT, sanitizeDashboardLayout } from "../src/lib/dashboard/types.ts";
import { mergeNxDashboardLayout } from "../src/lib/dashboard/homeLayout.ts";

process.env.MOVVIZ_CONFIG_DIR = mkdtempSync(path.join(os.tmpdir(), "movviz-appearance-"));
const { loadDashboardLayout, saveDashboardLayout } = await import("../src/lib/dashboard/store.ts");

test("Stable is the default and legacy modes migrate without losing settings", () => {
  assert.deepEqual(DASHBOARD_MODES, ["cinema", "beta"]);
  for (const mode of [undefined, "cinema", "classic", "compact", "unknown"]) {
    const layout = sanitizeDashboardLayout({ version: 2, mode, hero: { trailerAutoplay: false, slideshowSpeedSec: 30 }, showTasks: true, youtubeTrailerSearch: true });
    assert.equal(layout.mode, "cinema");
    assert.equal(layout.hero.trailerAutoplay, false);
    assert.equal(layout.hero.slideshowSpeedSec, 30);
    assert.equal(layout.showTasks, true);
    assert.equal(layout.youtubeTrailerSearch, true);
  }
  assert.equal(mergeNxDashboardLayout(undefined).mode, "cinema");
});

test("Beta is honored by the home composition with identical content settings", () => {
  const stable = mergeNxDashboardLayout(DEFAULT_DASHBOARD_LAYOUT);
  const beta = mergeNxDashboardLayout({ ...DEFAULT_DASHBOARD_LAYOUT, mode: "beta" });
  assert.equal(beta.mode, "beta");
  assert.deepEqual({ ...beta, mode: "cinema" }, stable);
  const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.ok(page.includes('layout.mode === "beta" && "nx-dashboard-premium"'), "premium styles must remain opt-in");
});

test("mode survives save/load, switching back, and stays isolated per user", () => {
  saveDashboardLayout("beta-user", { ...DEFAULT_DASHBOARD_LAYOUT, mode: "beta", hero: { ...DEFAULT_DASHBOARD_LAYOUT.hero, trailerAutoplay: false } });
  assert.equal(loadDashboardLayout("beta-user").mode, "beta");
  assert.equal(loadDashboardLayout("friend").mode, "cinema");
  saveDashboardLayout("beta-user", { ...loadDashboardLayout("beta-user"), mode: "cinema" });
  assert.equal(loadDashboardLayout("beta-user").mode, "cinema");
  assert.equal(loadDashboardLayout("beta-user").hero.trailerAutoplay, false);
});
