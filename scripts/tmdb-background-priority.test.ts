import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createTmdbRequestSlots, type TmdbRequestQueueState } from "@/lib/metadata/tmdbRequestSlots";
import { currentLane, runBackground, type Lane } from "@/lib/priority/lane";

const configDir = fs.mkdtempSync(path.join(os.tmpdir(), "movviz-tmdb-priority-"));
const previousConfigDir = process.env.MOVVIZ_CONFIG_DIR;
const previousApiKey = process.env.MOVVIZ_TMDB_API_KEY;
process.env.MOVVIZ_CONFIG_DIR = configDir;
process.env.MOVVIZ_TMDB_API_KEY = "priority-test-key";

after(async () => {
  const { flushPendingJsonWritesSync } = await import("@/lib/fsJsonCache");
  flushPendingJsonWritesSync();
  assert.equal(path.dirname(configDir), path.resolve(os.tmpdir()));
  assert.ok(path.basename(configDir).startsWith("movviz-tmdb-priority-"));
  fs.rmSync(configDir, { recursive: true, force: true });
  if (previousConfigDir === undefined) delete process.env.MOVVIZ_CONFIG_DIR;
  else process.env.MOVVIZ_CONFIG_DIR = previousConfigDir;
  if (previousApiKey === undefined) delete process.env.MOVVIZ_TMDB_API_KEY;
  else process.env.MOVVIZ_TMDB_API_KEY = previousApiKey;
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const turn = () => new Promise<void>((resolve) => setImmediate(resolve));

test("la voie background conserve le résultat, les erreurs et le contexte user extérieur", async () => {
  assert.equal(currentLane(), "user");
  const paused = deferred<void>();
  const background = runBackground(async () => {
    assert.equal(currentLane(), "background");
    await paused.promise;
    assert.equal(currentLane(), "background");
    return 42;
  });
  assert.equal(currentLane(), "user");
  paused.resolve();
  assert.equal(await background, 42);
  await assert.rejects(runBackground(async () => { throw new Error("expected-background-error"); }), /expected-background-error/);
  assert.equal(currentLane(), "user");
});

test("TMDb garde six slots de base et quatre slots user, puis sert les users en FIFO", async () => {
  const state: TmdbRequestQueueState = { active: 0, waiters: [] };
  const withSlot = createTmdbRequestSlots(state, 6, 4);
  const started: string[] = [];
  const gates = new Map<string, ReturnType<typeof deferred<string>>>();
  const jobs: Promise<string>[] = [];
  const add = (name: string, lane: Lane) => {
    const gate = deferred<string>();
    gates.set(name, gate);
    const promise = withSlot(lane, async () => { started.push(name); return gate.promise; });
    jobs.push(promise);
    return promise;
  };
  const finish = async (name: string) => { gates.get(name)!.resolve(name); await turn(); };
  try {
    for (let i = 0; i < 6; i++) add(`bg${i}`, "background");
    add("bg6", "background");
    add("bg7", "background");
    for (let i = 0; i < 4; i++) add(`user${i}`, "user");
    add("user4", "user");
    add("user5", "user");
    await turn();
    assert.deepEqual(started, ["bg0", "bg1", "bg2", "bg3", "bg4", "bg5", "user0", "user1", "user2", "user3"]);
    assert.equal(state.active, 10);
    await finish("user0");
    await finish("user1");
    assert.deepEqual(started.slice(-2), ["user4", "user5"]);
    assert.equal(state.active, 10);
    for (const name of ["user2", "user3", "user4", "user5"]) await finish(name);
    assert.equal(state.active, 6);
    assert.equal(started.includes("bg6"), false, "un slot user libéré ne doit pas réveiller le fond au-dessus de six actifs");
    await finish("bg0");
    assert.equal(started.at(-1), "bg6");
    assert.equal(state.active, 6);
    await finish("bg1");
    assert.equal(started.at(-1), "bg7");
  } finally {
    for (const [name, gate] of gates) gate.resolve(name);
    await Promise.all(jobs);
  }
  assert.equal(state.active, 0);
  assert.equal(state.waiters.length, 0);
});

test("un réveil réserve son slot et une erreur le libère", async () => {
  const state: TmdbRequestQueueState = { active: 0, waiters: [] };
  const withSlot = createTmdbRequestSlots(state, 1, 0);
  const first = deferred<void>();
  const second = deferred<void>();
  const started: string[] = [];
  const a = withSlot("user", async () => { started.push("a"); await first.promise; });
  const b = withSlot("user", async () => { started.push("b"); await second.promise; throw new Error("expected-slot-error"); });
  const rejected = assert.rejects(b, /expected-slot-error/);
  await turn();
  first.resolve();
  await a;
  const c = withSlot("user", async () => { started.push("c"); return 123; });
  await turn();
  assert.deepEqual(started, ["a", "b"]);
  assert.equal(state.active, 1);
  second.resolve();
  await rejected;
  assert.equal(await c, 123);
  assert.deepEqual(started, ["a", "b", "c"]);
  assert.equal(state.active, 0);
});

test("une entrée TMDb périmée répond aussitôt et ne lance qu'une revalidation background", async (t) => {
  const { getGenres } = await import("@/lib/metadata/tmdb");
  const lanes: Lane[] = [];
  const refreshed = deferred<Response>();
  let calls = 0;
  let now = Date.now();
  t.mock.method(Date, "now", () => now);
  t.mock.method(globalThis, "fetch", async () => {
    lanes.push(currentLane());
    calls++;
    return calls === 1 ? Response.json({ genres: [{ id: 1, name: "Known" }] }) : refreshed.promise;
  });
  assert.deepEqual(await getGenres("movie"), [{ id: 1, name: "Known" }]);
  now += 5 * 60_000 + 1;
  let settled = false;
  const stale = getGenres("movie").then((value) => { settled = true; return value; });
  try {
    await turn();
    assert.equal(settled, true, "la fiche ne doit pas attendre la revalidation");
    assert.deepEqual(await stale, [{ id: 1, name: "Known" }]);
    assert.deepEqual(await getGenres("movie"), [{ id: 1, name: "Known" }]);
    assert.equal(calls, 2);
    assert.deepEqual(lanes, ["user", "background"]);
  } finally {
    refreshed.resolve(Response.json({ genres: [{ id: 2, name: "Refreshed" }] }));
    await stale;
    await turn();
  }
  assert.deepEqual(await getGenres("movie"), [{ id: 2, name: "Refreshed" }]);
});

test("le worker d'artwork lancé par l'API utilise background et renvoie son état immédiatement", async (t) => {
  fs.writeFileSync(path.join(configDir, "library-movies.json"), JSON.stringify([{ tmdbId: 91000001 }]));
  const { startArtworkCacheWarm, getArtworkWarmState } = await import("@/lib/metadata/artworkCacheWarm");
  const metadata = deferred<Response>();
  const lanes: Lane[] = [];
  t.mock.method(globalThis, "fetch", async (input: string | URL | Request) => {
    lanes.push(currentLane());
    return String(input).includes("api.themoviedb.org") ? metadata.promise : new Response("image-bytes");
  });
  const state = startArtworkCacheWarm("complete");
  assert.equal(state.running, true);
  assert.equal(state.total, 1);
  assert.equal(currentLane(), "user");
  await turn();
  startArtworkCacheWarm("complete");
  assert.deepEqual(lanes, ["background"], "un second lancement partage le worker existant");
  metadata.resolve(Response.json({
    backdrops: [{ file_path: "/priority-backdrop.jpg", width: 1920, height: 1080, iso_639_1: null }],
    logos: [{ file_path: "/priority-logo.png", width: 500, height: 200, iso_639_1: "fr" }],
  }));
  for (let i = 0; i < 100 && getArtworkWarmState().running; i++) await new Promise((resolve) => setTimeout(resolve, 5));
  const finished = getArtworkWarmState();
  assert.equal(finished.running, false);
  assert.equal(finished.done, 1);
  assert.equal(finished.cached, 1);
  assert.equal(finished.failed, 0);
  assert.deepEqual(lanes, ["background", "background", "background"]);
});
