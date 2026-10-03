import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { selectWatchProviderTiles } from "@/lib/metadata/watchProviderTiles";
import { shouldFallbackProviderCatalogToFrance } from "@/lib/metadata/tmdb";

test("curated OCS and YouTube remain available when regional metadata has no entry", () => {
  const tiles = selectWatchProviderTiles([{ provider_id: 8, logo_path: "/netflix.png" }], []);
  assert.ok(tiles.some((tile) => tile.id === 192 && tile.name === "YouTube" && tile.logoPath === null));
  assert.ok(tiles.some((tile) => tile.id === 685 && tile.name === "OCS" && tile.logoPath === null));
  assert.equal(tiles.find((tile) => tile.id === 8)?.logoPath, "/netflix.png");
});

test("movie and TV providers are unioned, deduplicated and curated-order sorted", () => {
  const tiles = selectWatchProviderTiles(
    [{ provider_id: 685 }, { provider_id: 8 }, { provider_id: 99999 }],
    [{ provider_id: 192, logo_path: "/youtube.png" }, { provider_id: 8, logo_path: "/netflix.png" }],
  );
  assert.deepEqual(tiles.map((tile) => tile.id), [8, 337, 119, 1899, 350, 192, 283, 685]);
  assert.equal(tiles.find((tile) => tile.id === 8)?.logoPath, "/netflix.png");
  assert.equal(tiles.find((tile) => tile.id === 192)?.logoPath, "/youtube.png");
});

test("empty Belgian OCS/YouTube catalogue falls back to France, not a failed request", () => {
  assert.equal(shouldFallbackProviderCatalogToFrance("BE", "685", 0), true);
  assert.equal(shouldFallbackProviderCatalogToFrance("BE", "192", 0), true);
  assert.equal(shouldFallbackProviderCatalogToFrance("BE", "8", 1), false);
  assert.equal(shouldFallbackProviderCatalogToFrance("FR", "685", 0), false);
  assert.equal(shouldFallbackProviderCatalogToFrance("BE", undefined, 0), false);
  assert.equal(shouldFallbackProviderCatalogToFrance("BE", "685", undefined), false);
});

test("empty regional metadata keeps the complete curated platform row", () => {
  const tiles = selectWatchProviderTiles([], []);
  assert.ok(tiles.some((tile) => tile.id === 192));
  assert.ok(tiles.some((tile) => tile.id === 685));
  assert.ok(tiles.length >= 8);
});

test("both provider entry points use the same catalogue reset without switching media type", () => {
  const source = readFileSync(new URL("../src/app/discover/page.tsx", import.meta.url), "utf8");
  const handler = source.slice(source.indexOf("const handleWatchProviderClick ="), source.indexOf("const seeAllRow ="));
  for (const reset of ["clearSearchQuery();", 'setGenre("");', 'setYear("");', 'setSort("popularity.desc");',
    "setCompany(null);", 'setDuration("");', "setRowCategory(null);", "setRowCategoryMeta(undefined);", "setOpenMenu(null);"]) {
    assert.ok(handler.includes(reset), `missing reset: ${reset}`);
  }
  assert.equal(handler.includes("setMediaType("), false);
  assert.match(source, /onClick=\{\(\) => handleWatchProviderClick\(tile, false\)\}/);
  assert.match(source, /onClick=\{\(\) => handleWatchProviderClick\(tile\)\}/);
  assert.match(source, /onClick=\{handleWatchProviderClick\}/);
});

test("the Discover sort stays available for every platform: Nouveautés, Tendances, Meilleur", () => {
  const source = readFileSync(new URL("../src/app/discover/page.tsx", import.meta.url), "utf8");
  const sortControl = source.slice(source.indexOf('<label className="nx-discover-sort'), source.indexOf('</label>', source.indexOf('<label className="nx-discover-sort')));
  const newest = sortControl.indexOf('value="primary_release_date.desc"');
  const trending = sortControl.indexOf('value="popularity.desc"');
  const best = sortControl.indexOf('value="vote_average.desc"');
  assert.ok(newest >= 0 && newest < trending && trending < best);
  assert.match(source, /if \(watchProvider\) params\.set\("watchProvider", watchProvider\.id\);/);
  assert.match(source, /kind === "all" \? "Pour vous"/);
});
