import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const config = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-tvdb-names-"));
process.env.MOVVIZ_CONFIG_DIR = config;
process.env.MOVVIZ_DATA_DIR = config;
process.env.MOVVIZ_TVDB_API_KEY = "test-key";

const realFetch = globalThis.fetch;
const asked: string[] = [];
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  asked.push(url.pathname);
  if (url.pathname === "/v4/login") return json({ data: { token: "t" } });
  if (url.pathname === "/v4/series/77/extended") return json({ data: { seasons: [
    { id: 1, number: 1, name: "日光・華厳の滝編", type: { type: "official" } },
    { id: 2, number: 2, name: "京都編&練馬編", type: { type: "official" } },
    { id: 3, number: 3, name: "京都編", type: { type: "official" } },
    { id: 4, number: 4, name: "Final Arc", type: { type: "official" } },
  ] } });
  if (url.pathname === "/v4/seasons/1/translations/fra") return json({ data: { name: "L'arc de Nikko" } });
  if (url.pathname === "/v4/seasons/2/translations/eng") return json({ data: { name: "Kyoto & Nerima Arc" } });
  return json({}, 404);
}) as typeof fetch;
test.after(() => { globalThis.fetch = realFetch; });

const { getTvdbSeasonNames, readableName } = await import("../src/lib/metadata/tvdb.ts");

test("season names: the user's language, else English, else the raw name — never Japanese script", async () => {
  const names = await getTvdbSeasonNames(77, "fr");
  assert.equal(names.get(1), "L'arc de Nikko");
  assert.equal(names.get(2), "Kyoto & Nerima Arc");
  assert.equal(names.has(3), false, "no readable name: the caller keeps « Saison 3 »");
  assert.equal(names.get(4), "Final Arc");
  assert.ok(!asked.includes("/v4/seasons/1/translations/eng"), "English is only asked when the user's language is missing");
});

test("readableName", () => {
  assert.equal(readableName("  Arc 1 "), "Arc 1");
  assert.equal(readableName("京都編&練馬編"), undefined);
  assert.equal(readableName(""), undefined);
  assert.equal(readableName(null), undefined);
});
