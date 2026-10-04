import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { isMovvizPlayerEnabled, playerDestination } from "../src/lib/settings/playerPreference.ts";
import { isVisibleSeason } from "../src/lib/settings/seasonVisibility.ts";
import { rankPersonalized } from "../src/lib/metadata/personalizedSort.ts";

const config = mkdtempSync(path.join(os.tmpdir(), "movviz-settings-cleanup-"));
process.env.MOVVIZ_CONFIG_DIR = config;
writeFileSync(path.join(config, "user-preferences.json"), JSON.stringify({
  cassy: { specialEpisodesEnabled: true, betaPlayerEnabled: false, locale: "fr" },
  friend: { specialEpisodesEnabled: true, preferredAudioLanguage: "en" },
}));
const { loadUserPrefs, saveUserPrefs } = await import("../src/lib/userPrefs/store.ts");
const source = (file: string) => readFileSync(new URL("../" + file, import.meta.url), "utf8");

test("Movviz player defaults on, preserves opt-outs, and disabled playback opens Plex", () => {
  assert.equal(isMovvizPlayerEnabled(true), true);
  assert.equal(isMovvizPlayerEnabled(true, false), false);
  assert.equal(isMovvizPlayerEnabled(false, true), false);
  assert.equal(playerDestination(false, "https://plex.tv/example"), "https://plex.tv/example");
  assert.equal(playerDestination(false), "https://app.plex.tv/desktop");
  assert.equal(playerDestination(true), "movviz");
  assert.equal(loadUserPrefs("new").betaPlayerEnabled, true);
  assert.equal(loadUserPrefs("cassy").betaPlayerEnabled, false);
  assert.ok(source("src/lib/player/PlayerProvider.tsx").includes("playerDestination("));
});

test("specials reset once for every profile without altering other preferences", () => {
  assert.equal(loadUserPrefs("cassy").specialEpisodesEnabled, false);
  assert.equal(loadUserPrefs("friend").specialEpisodesEnabled, false);
  assert.equal(loadUserPrefs("friend").preferredAudioLanguage, "en");
  saveUserPrefs("cassy", { specialEpisodesEnabled: true });
  assert.equal(loadUserPrefs("cassy").specialEpisodesEnabled, true);
  assert.equal(loadUserPrefs("friend").specialEpisodesEnabled, false);
  saveUserPrefs("cassy", { locale: "en" });
  assert.equal(loadUserPrefs("cassy").specialEpisodesEnabled, true);
});

test("season 0 visibility is opt-in and never invents undefined/negative seasons", () => {
  assert.equal(isVisibleSeason(0, false), false);
  assert.equal(isVisibleSeason(0, true), true);
  assert.equal(isVisibleSeason(1, false), true);
  assert.equal(isVisibleSeason(-1, true), false);
  assert.equal(isVisibleSeason(NaN, true), false);
  assert.ok(source("src/components/title/SeasonAccordion.tsx").includes("isVisibleSeason(season.seasonNumber, includeSpecials)"));
  for (const [project, namespace] of [["android-mobile-nx", "com/movviz/nx/mobile"], ["android-tv-nx", "com/movviz/tv"]]) {
    const screen = source(`${project}/app/src/main/kotlin/${namespace}/ui/title/TitleDetailScreen.kt`);
    assert.ok(screen.includes("seasons.filter { it.seasonNumber > 0 }"));
    assert.ok(!screen.includes("+ seasons.filter { it.seasonNumber == 0"));
  }
});

test("dead controls and their help texts are removed, not animation reduction", () => {
  const dashboard = source("src/components/settings/DashboardExperiencePanel.tsx");
  for (const key of ["showStats", "showDownloads", "showTasks"]) assert.ok(!dashboard.includes(key));
  const graphics = source("src/components/settings/GpuSettingsPanel.tsx");
  assert.ok(!graphics.includes("setTier"));
  assert.ok(graphics.includes("setReduceAnimations"));
  for (const locale of ["fr", "en", "de", "it", "nl"]) {
    const text = source(`src/i18n/locales/${locale}.ts`);
    for (const key of ["gpu: {", "showStats:", "showDownloads:", "showTasks:", "betaUserToggle:", "betaEngineStable:", "betaEngineBeta:"]) assert.ok(!text.includes(key), `${locale}: ${key}`);
    assert.ok(text.includes('unifiedTitle: "Movviz player"'));
  }
  const wizard = source("src/app/setup/page.tsx");
  assert.ok(!/gpuTier|showStats|showDownloads|showTasks|betaEngineStable/.test(wizard));
});

test("personalized filtered sorting preserves membership, unknown order, and original data", () => {
  const page = [{ tmdbId: 4 }, { tmdbId: 2 }, { tmdbId: 3 }, { tmdbId: 1 }];
  assert.deepEqual(rankPersonalized(page, [{ tmdbId: 1 }, { tmdbId: 2 }, { tmdbId: 99 }]).map(x => x.tmdbId), [1, 2, 4, 3]);
  assert.deepEqual(page.map(x => x.tmdbId), [4, 2, 3, 1]);
});

test("Discovery exposes four sorts and library provider headings distinguish their rows", () => {
  const discover = source("src/app/discover/page.tsx");
  assert.equal((discover.match(/<option value="for_you">/g) ?? []).length, 2);
  assert.ok(source("src/app/api/metadata/discover/route.ts").includes("getProviderRelationPool(userId, type, providerId, region)"));
  const rows = source("src/components/library/MediaSuggestionRows.tsx");
  assert.ok(rows.includes('t("discover.rowProviderNew", { provider: providerName })'));
  assert.ok(rows.includes('t("discover.rowProviderSuggested", { provider: providerName })'));
});

test("search focus uses the rounded enclosing pill, never the inner rectangle", () => {
  const css = source("src/components/appearance/premium.css");
  assert.match(css, /\.nx-desktop-shell \.nx-search-pill input:focus-visible\s*\{\s*outline: none;\s*box-shadow: none;/);
  assert.ok(css.includes(".nx-search-pill:focus-within"));
});
