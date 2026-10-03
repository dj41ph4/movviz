import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { selectWatchProviderTiles } from "@/lib/metadata/watchProviderTiles";

test("regional absence does not advertise dead OCS/YouTube tiles", () => {
  assert.deepEqual(selectWatchProviderTiles([{ provider_id: 8, logo_path: "/netflix.png" }], []), [
    { id: 8, name: "Netflix", logoPath: "/netflix.png" },
  ]);
});

test("movie and TV providers are unioned, deduplicated and curated-order sorted", () => {
  const tiles = selectWatchProviderTiles(
    [{ provider_id: 685 }, { provider_id: 8 }, { provider_id: 99999 }],
    [{ provider_id: 192, logo_path: "/youtube.png" }, { provider_id: 8, logo_path: "/netflix.png" }],
  );
  assert.deepEqual(tiles, [
    { id: 8, name: "Netflix", logoPath: "/netflix.png" },
    { id: 192, name: "YouTube", logoPath: "/youtube.png" },
    { id: 685, name: "OCS", logoPath: null },
  ]);
});

test("empty regional metadata does not fall back to the hardcoded platforms", () => {
  assert.deepEqual(selectWatchProviderTiles([], []), []);
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
