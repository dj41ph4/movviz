import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

test("un chemin du conteneur est traduit en chemin du NAS, celui que voit Plex", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-map-"));
  process.env.MOVVIZ_CONFIG_DIR = dir;
  fs.writeFileSync(path.join(dir, "plex-path-mappings.json"), JSON.stringify([{ plexPrefix: "/volume1/docker/plex/série", movvizPrefix: "/data/série", learnedAt: 1 }]));
  const { toPlexSidePath } = await import("../src/lib/plex/pathMappingStore");
  assert.equal(toPlexSidePath("/data/série/Monster (2022)/Saison 4"), "/volume1/docker/plex/série/Monster (2022)/Saison 4");
  assert.equal(toPlexSidePath("/data/séries-bis/X"), "/data/séries-bis/X", "un préfixe partiel ne compte pas");
  assert.equal(toPlexSidePath("/autre/chemin"), "/autre/chemin");
});
