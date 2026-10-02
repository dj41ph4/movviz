import { test } from "node:test";
import assert from "node:assert/strict";
import { ResponsiveCache } from "@/lib/recommender/responsiveCache";
import { ProgressiveCache } from "@/lib/recommender/progressiveCache";
import { currentLane } from "@/lib/priority/lane";
import { getTasteMetadata } from "@/lib/metadata/tmdb";
import { NextRequest } from "next/server";
import { GET as getRows } from "@/app/api/metadata/rows/route";

test("a slow source cannot delay another shelf and runs in the background lane", async () => {
  const cache = new ResponsiveCache();
  let release!: (value: string[]) => void;
  let lane = ""; let calls = 0; let updates = 0;
  const build = () => { calls++; lane = currentLane(); return new Promise<string[]>((resolve) => { release = resolve; }); };
  const start = performance.now();
  const [slow, fast] = await Promise.all([
    cache.read("slow", build, [], () => updates++, 30_000, 30),
    cache.read("fast", async () => ["ready"], [], () => {}, 30_000, 30),
  ]);
  assert.deepEqual(slow, []); assert.deepEqual(fast, ["ready"]);
  assert.ok(performance.now() - start < 500);
  assert.equal(lane, "background");
  await cache.read("slow", build, [], () => updates++, 30_000, 0);
  assert.equal(calls, 1, "pending work is shared");
  release(["complete"]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(await cache.read("slow", build, [], () => {}, 30_000), ["complete"]);
  assert.equal(updates, 1);
});

test("warm shelves remain instant during refresh, and failure does not erase them", async () => {
  const cache = new ResponsiveCache();
  await cache.read("profile-a", async () => ["original"], [], () => {}, 0);
  const start = performance.now();
  assert.deepEqual(await cache.read("profile-a", async () => { throw new Error("offline"); }, [], () => {}, 0), ["original"]);
  assert.ok(performance.now() - start < 100);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(await cache.read("profile-a", async () => ["replacement"], [], () => {}, 30_000), ["original"]);
  assert.deepEqual(await cache.read("profile-b", async () => ["other"], [], () => {}, 30_000), ["other"]);
});

test("progressive cache returns immediately without raising background work to user priority", async () => {
  const values = new Map<string, string>(); let lane = "";
  let release!: (value: string) => void;
  const cache = new ProgressiveCache((key) => values.get(key), (key, value: string) => values.set(key, value),
    async () => { lane = currentLane(); return new Promise<string>((resolve) => { release = resolve; }); });
  const start = performance.now();
  assert.equal((await cache.read(["missing"])).size, 0);
  assert.ok(performance.now() - start < 100);
  assert.equal(lane, "background"); release("ready");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal((await cache.read(["missing"])).get("missing"), "ready");
});

test("taste metadata preserves credits and keywords without providers, videos or external ratings", async (t) => {
  const paths: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
    const parsed = new URL(String(url)); paths.push(parsed.pathname);
    assert.equal(parsed.searchParams.get("append_to_response"), "credits,keywords");
    return new Response(JSON.stringify({ keywords: { keywords: [{ name: "space" }] }, credits: {
      cast: [{ id: 1, name: "Actor", character: "Pilot", profile_path: null }],
      crew: [{ id: 2, name: "Director", job: "Director" }],
    } }), { headers: { "content-type": "application/json" } });
  });
  const metadata = await getTasteMetadata("movie", 1987654321);
  assert.deepEqual(metadata?.keywords, ["space"]);
  assert.equal(metadata?.cast[0].name, "Actor");
  assert.equal(metadata?.crew[0].job, "Director");
  assert.equal(paths.length, 1);
});

test("real rows route publishes ready shelves while a provider is still loading", async (t) => {
  let release!: () => void;
  const delayed = new Promise<void>((resolve) => { release = resolve; });
  t.mock.method(globalThis, "fetch", async (url: string | URL | Request) => {
    const parsed = new URL(String(url));
    if (parsed.searchParams.get("with_watch_providers") === "8") await delayed;
    return new Response(JSON.stringify({ results: [{ id: 1987654320, title: "Ready title", name: "Ready title",
      release_date: "2020-01-01", first_air_date: "2020-01-01", vote_average: 7, vote_count: 300,
      genre_ids: [28], original_language: "en", poster_path: "/poster.jpg" }], page: 1, total_pages: 1 }),
      { headers: { "content-type": "application/json" } });
  });
  try {
    const start = performance.now();
    const first = await (await getRows(new NextRequest("http://localhost/api/metadata/rows?type=movie"))).json();
    assert.ok(performance.now() - start < 1_000, "not held hostage by pending provider");
    assert.ok(first.rows.some((row: { key: string }) => row.key === "trendingPopular"));
    assert.equal(first.pending, true);
    release();
    await new Promise((resolve) => setTimeout(resolve, 40));
    const second = await (await getRows(new NextRequest("http://localhost/api/metadata/rows?type=movie"))).json();
    assert.ok(second.rows.some((row: { key: string }) => row.key === "providerNew:8"));
  } finally { release(); }
});

test("profile invalidation never invalidates another profile with a similar id", async () => {
  const cache = new ResponsiveCache();
  const a = '["user-1","movie"]:recommended'; const b = '["user-10","movie"]:recommended';
  await cache.read(a, async () => ["a"], [], () => {});
  await cache.read(b, async () => ["b"], [], () => {});
  cache.invalidateProfile("user-1", true);
  let aCalls = 0; let bCalls = 0;
  assert.deepEqual(await cache.read(a, async () => { aCalls++; return ["new a"]; }, [], () => {}), ["a"]);
  assert.deepEqual(await cache.read(b, async () => { bCalls++; return ["wrong"]; }, [], () => {}), ["b"]);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(aCalls, 1); assert.equal(bCalls, 0);
});

test("an upstream empty-error sentinel does not replace a populated shelf", async () => {
  const cache = new ResponsiveCache();
  const original = { results: ["ready"], totalPages: 1 };
  await cache.read("editorial", async () => original, original, () => {}, 0);
  await cache.read("editorial", async () => ({ results: [] as string[], totalPages: 0 }), original, () => {}, 0);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(await cache.read("editorial", async () => original, original, () => {}), original);
});
