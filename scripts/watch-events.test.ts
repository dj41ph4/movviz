import { test } from "node:test";
import assert from "node:assert/strict";
import { eventBus, type AppEvent } from "@/lib/events/EventBus";
import { emitWatchChanged, emitPlaybackProgress } from "@/lib/events/watchEvents";

test("un changement de vus arrive aux autres appareils : un seul événement pour une rafale, pour ce seul utilisateur", async () => {
  const seen: AppEvent[] = [];
  const off = eventBus.on((e) => seen.push(e));
  try {
    for (let i = 0; i < 200; i++) emitWatchChanged("user-a"); // e.g. a whole season marked seen
    emitWatchChanged("user-b");
    await new Promise((r) => setTimeout(r, 600));
    const watch = seen.filter((e) => e.type === "watch_changed") as { type: "watch_changed"; userId: string }[];
    assert.equal(watch.filter((e) => e.userId === "user-a").length, 1);
    assert.equal(watch.filter((e) => e.userId === "user-b").length, 1);
  } finally {
    off();
  }
});

test("pendant une lecture, la position n'est relayée qu'une fois par période", async () => {
  const seen: AppEvent[] = [];
  const off = eventBus.on((e) => seen.push(e));
  try {
    emitPlaybackProgress("player");
    await new Promise((r) => setTimeout(r, 500));
    emitPlaybackProgress("player"); // 10 s later in real life: too soon
    await new Promise((r) => setTimeout(r, 500));
    assert.equal(seen.filter((e) => e.type === "watch_changed").length, 1);
  } finally {
    off();
  }
});
