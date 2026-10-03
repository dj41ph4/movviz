import assert from "node:assert/strict";
import test from "node:test";
import {
  beginForegroundRequest,
  hasForegroundRequests,
  isForegroundDataUrl,
  subscribeForegroundRequests,
  withForegroundRequest,
} from "../src/lib/priority/foregroundRequests.ts";

test("nested visible requests stay active until the final request completes", (t) => {
  assert.equal(hasForegroundRequests(), false);
  const states: boolean[] = [];
  const unsubscribe = subscribeForegroundRequests(() => states.push(hasForegroundRequests()));
  t.after(unsubscribe);
  const endFirst = beginForegroundRequest();
  const endSecond = beginForegroundRequest();
  t.after(endFirst);
  t.after(endSecond);

  assert.equal(hasForegroundRequests(), true);
  assert.deepEqual(states, [true]);
  endFirst();
  assert.equal(hasForegroundRequests(), true);
  assert.deepEqual(states, [true]);
  endSecond();
  assert.equal(hasForegroundRequests(), false);
  assert.deepEqual(states, [true, false]);
});

test("repeated release never releases another request or corrupts the next batch", (t) => {
  const endFirst = beginForegroundRequest();
  const endSecond = beginForegroundRequest();
  t.after(endFirst);
  t.after(endSecond);
  endFirst();
  endFirst();
  assert.equal(hasForegroundRequests(), true);
  endSecond();
  endSecond();
  assert.equal(hasForegroundRequests(), false);

  const endNext = beginForegroundRequest();
  t.after(endNext);
  assert.equal(hasForegroundRequests(), true);
  endNext();
  assert.equal(hasForegroundRequests(), false);
});

test("unsubscribed listeners do not receive later request changes", (t) => {
  let changes = 0;
  const unsubscribe = subscribeForegroundRequests(() => { changes++; });
  t.after(unsubscribe);
  unsubscribe();
  unsubscribe();
  const end = beginForegroundRequest();
  t.after(end);
  end();
  assert.equal(changes, 0);
});

test("the request wrapper preserves its result and stays active until completion", async () => {
  const response = { items: [1, 2, 3] };
  let complete!: (value: typeof response) => void;
  let calls = 0;
  const request = withForegroundRequest(() => {
    calls++;
    return new Promise<typeof response>((resolve) => { complete = resolve; });
  });
  assert.equal(hasForegroundRequests(), true);
  complete(response);
  assert.equal(await request, response);
  assert.equal(calls, 1);
  assert.equal(hasForegroundRequests(), false);
});

test("a failed request releases only its own signal and preserves the original error", async (t) => {
  const endOther = beginForegroundRequest();
  t.after(endOther);
  const failure = new Error("visible data failed");
  const request = withForegroundRequest(() => Promise.reject(failure));
  await assert.rejects(request, (error) => error === failure);
  assert.equal(hasForegroundRequests(), true);
  endOther();
  assert.equal(hasForegroundRequests(), false);
});

test("synchronous request failures also release the foreground signal", async () => {
  const failure = new TypeError("invalid request");
  const request = withForegroundRequest(() => { throw failure; });
  await assert.rejects(request, (error) => error === failure);
  assert.equal(hasForegroundRequests(), false);
});

test("aborting a visible request releases its signal without changing the abort error", async () => {
  const controller = new AbortController();
  const reason = new DOMException("navigation changed", "AbortError");
  const request = withForegroundRequest(() => new Promise<never>((_resolve, reject) => {
    controller.signal.addEventListener("abort", () => reject(controller.signal.reason), { once: true });
  }));
  assert.equal(hasForegroundRequests(), true);
  controller.abort(reason);
  await assert.rejects(request, (error) => error === reason);
  assert.equal(hasForegroundRequests(), false);
});

test("page and title data count as foreground independently of their query values", () => {
  for (const url of [
    "/api/interface/dashboard",
    "/api/interface/search?q=arrival",
    "/api/interface/library-status?type=movie&tmdbId=550",
    "/api/metadata/detail?type=movie&tmdbId=550",
    "/api/metadata/season?tmdbId=1399&season=1",
    "/api/metadata/row-page?row=popular",
    "/api/library/movies",
    "/api/library/movies/movie_1?view=detail",
    "/api/library/series",
    "/api/library/series/series_1?view=detail",
    "/api/metadata/detail?next=/api/jobs",
    "/api/dashboard/hero",
    "/api/watch-status?tmdbId=550",
    "/api/watchlist",
    "/api/plex/on-deck",
  ]) assert.equal(isForegroundDataUrl(url), true, url);
});

test("status-only pollers, playback heartbeats and maintenance URLs are ineligible for foreground priority", () => {
  for (const url of [
    "/api/activity/ping", "/api/activity/v2", "/api/cache", "/api/jobs",
    "/api/engine/torrents", "/api/engine/instances", "/api/events", "/api/history",
    "/api/issues", "/api/library/rename", "/api/library/index-scan", "/api/perf",
    "/api/playback/sessions/abc/heartbeat", "/api/plex/activity", "/api/resolver/logs",
    "/api/settings", "/api/stream/123/progress", "/api/system/update", "/api/tasks",
    "/api/jobs?next=/api/metadata/detail",
  ]) assert.equal(isForegroundDataUrl(url), false, url);
});
