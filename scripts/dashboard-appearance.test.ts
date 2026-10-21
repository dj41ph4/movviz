import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { DASHBOARD_MODES, DEFAULT_DASHBOARD_LAYOUT, sanitizeDashboardLayout } from "../src/lib/dashboard/types.ts";
import { mergeNxDashboardLayout } from "../src/lib/dashboard/homeLayout.ts";

process.env.MOVVIZ_CONFIG_DIR = mkdtempSync(path.join(os.tmpdir(), "movviz-appearance-"));
const { loadDashboardLayout, saveDashboardLayout } = await import("../src/lib/dashboard/store.ts");

test("Beta is the only appearance: every stored mode, including the old Stable key, reads back as Beta without losing settings", () => {
  assert.deepEqual(DASHBOARD_MODES, ["beta"]);
  assert.equal(DEFAULT_DASHBOARD_LAYOUT.mode, "beta");
  for (const mode of [undefined, "cinema", "classic", "compact", "unknown", "beta"]) {
    const layout = sanitizeDashboardLayout({ version: 2, mode, hero: { trailerAutoplay: false, slideshowSpeedSec: 30 }, showTasks: true, youtubeTrailerSearch: true });
    assert.equal(layout.mode, "beta");
    assert.equal(layout.hero.trailerAutoplay, false);
    assert.equal(layout.hero.slideshowSpeedSec, 30);
    assert.equal(layout.showTasks, true);
    assert.equal(layout.youtubeTrailerSearch, true);
  }
  assert.equal(mergeNxDashboardLayout(undefined).mode, "beta");
});

test("the home always renders the Beta dashboard", () => {
  const page = readFileSync(new URL("../src/app/page.tsx", import.meta.url), "utf8");
  assert.ok(page.includes('"nx-dashboard-content nx-dashboard-premium '));
});

test("a user who had saved Stable gets Beta and keeps their other settings", () => {
  saveDashboardLayout("stable-user", { ...DEFAULT_DASHBOARD_LAYOUT, mode: "cinema" as never, hero: { ...DEFAULT_DASHBOARD_LAYOUT.hero, trailerAutoplay: false } });
  assert.equal(loadDashboardLayout("stable-user").mode, "beta");
  assert.equal(loadDashboardLayout("stable-user").hero.trailerAutoplay, false);
  assert.equal(loadDashboardLayout("friend").mode, "beta");
});

test("Ma liste is fourth by default and appears in old layouts without losing hidden sections", () => {
  assert.equal(DEFAULT_DASHBOARD_LAYOUT.sections[3].id, "watchlist");
  const old = DEFAULT_DASHBOARD_LAYOUT.sections.filter((section) => section.id !== "watchlist").map((section) => ({ ...section, visible: section.id !== "rewatch" }));
  const migrated = sanitizeDashboardLayout({ sections: old });
  assert.equal(migrated.sections[3].id, "watchlist");
  assert.equal(migrated.sections.find((section) => section.id === "rewatch")?.visible, false);
  const custom = sanitizeDashboardLayout({ sections: [{ id: "watchlist", visible: false }, ...old] });
  assert.equal(custom.sections[0].id, "watchlist");
  assert.equal(custom.sections[0].visible, false);
});
