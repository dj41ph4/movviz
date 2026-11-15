import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const config = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-plex-order-"));
process.env.MOVVIZ_CONFIG_DIR = config;
process.env.MOVVIZ_DATA_DIR = config;

// A fake Plex: show 100 no longer exists (re-created under another key after
// a rename), show 200 accepts the order, show 300 lists no TMDb order.
const order = new Map<string, string>([["200", "tvdbAiring"], ["300", "aired"]]);
const calls: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  const m = url.pathname.match(/^\/library\/metadata\/(\d+)(\/prefs|\/refresh)?$/);
  if (!m) return json({}, 404);
  const [, key, action] = m;
  calls.push(`${init?.method ?? "GET"} ${key}${action ?? ""}`);
  if (!order.has(key)) return json({}, 404);
  if (action === "/prefs") { order.set(key, url.searchParams.get("showOrdering")!); return json({}); }
  if (action === "/refresh") return json({});
  const enumValues = key === "300" ? "aired:TVDB|absolute:Absolu" : "tmdbAiring:TMDb|tvdbAiring:TVDB|aired:Aired";
  return json({ MediaContainer: { Metadata: [{ title: `Show ${key}`, Preferences: { Setting: [{ id: "showOrdering", value: order.get(key), enumValues }] } }] } });
}) as typeof fetch;
test.after(() => { globalThis.fetch = realFetch; });

const { addSeries, getSeries } = await import("../src/lib/library/store.ts");
const { applyPendingPlexOrdering } = await import("../src/lib/plex/librarySync.ts");
const { getSearchLog } = await import("../src/lib/diagnostic/searchLog.ts");

const cfg = { hostname: "plex.example.org", port: 32400, useSsl: true, adminToken: "t", clientId: "c", syncLibrary: true, watchlistSyncEnabled: false } as never;
const make = (id: string, tmdbId: number, plexRatingKey: string) => addSeries({
  id, tmdbId, imdbId: null, title: `Série ${plexRatingKey}`, year: 2020, releaseDate: "2020-01-01", overview: "", posterPath: null, backdropPath: null,
  rating: 0, genres: ["Animation"], isAnime: true, tvStatus: "Ended", monitored: true, qualityProfileId: "default", addedAt: 1, plexRatingKey,
  plexOrderPending: "tmdb", seasons: [],
} as never);
make("sr_gone", 5001, "100");
make("sr_ok", 5002, "200");
make("sr_unsupported", 5003, "300");

test("a show Plex keeps refusing never blocks the ones behind it, and the reason is written to the diagnostic log", async () => {
  // One per pass, like a tiny ORDERING_PER_SYNC: the first pass meets the dead key…
  assert.equal(await applyPendingPlexOrdering(cfg, "t", 1), 0);
  assert.equal(getSeries("sr_gone")!.plexOrderPending, "tmdb", "still wanted: applied once Plex links the show again");
  // …the next ones move on instead of retrying it for ever.
  assert.equal(await applyPendingPlexOrdering(cfg, "t", 1), 1);
  assert.equal(getSeries("sr_ok")!.plexOrderPending, undefined);
  assert.equal(order.get("200"), "tmdbAiring", "Plex really holds the TMDb order now");
  assert.equal(await applyPendingPlexOrdering(cfg, "t", 1), 0);
  assert.equal(getSeries("sr_unsupported")!.plexOrderPending, undefined, "nothing Plex can do for this show: not asked again");
  assert.equal(order.get("300"), "aired", "never written with a value Plex does not list");

  const lines = getSearchLog().filter((l) => l.step === "plex.ordering").map((l) => l.message);
  assert.ok(lines.some((m) => m.includes("Série 100") && m.includes("404")), lines.join(" | "));
  assert.ok(lines.some((m) => m.includes("Série 300") && m.includes("non proposé")), lines.join(" | "));
  assert.equal(lines.filter((m) => m.includes("Série 200")).length, 0, "a success is not a diagnostic line");
});

test("the same refusal is logged once, not at every sync", async () => {
  const before = getSearchLog().filter((l) => l.step === "plex.ordering").length;
  await applyPendingPlexOrdering(cfg, "t", 5);
  await applyPendingPlexOrdering(cfg, "t", 5);
  assert.equal(getSearchLog().filter((l) => l.step === "plex.ordering").length, before);
  assert.ok(calls.filter((c) => c === "GET 100").length >= 3, "it is still retried at each pass");
});
