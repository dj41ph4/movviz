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

test("chat IA partagé : une question, sa réponse et « Effacer » préviennent les autres appareils du même utilisateur", async () => {
  const { pushAiMessage, clearAiSession } = await import("@/lib/ai/store");
  const seen: AppEvent[] = [];
  const off = eventBus.on((e) => seen.push(e));
  try {
    pushAiMessage("chat-user", { role: "user", content: "salut" });
    await new Promise((r) => setTimeout(r, 300));
    pushAiMessage("chat-user", { role: "assistant", content: "salut !" });
    await new Promise((r) => setTimeout(r, 300));
    clearAiSession("chat-user");
    await new Promise((r) => setTimeout(r, 300));
    const ai = seen.filter((e) => e.type === "ai_chat_changed") as { type: "ai_chat_changed"; userId: string }[];
    assert.equal(ai.length, 3);
    assert.ok(ai.every((e) => e.userId === "chat-user"));
  } finally {
    off();
  }
});

test("une resynchro Plex qui réaffirme un « vu » identique ne prévient pas les appareils (pas de boucle)", async () => {
  const { setWatchedMovies } = await import("@/lib/plex/watchStore");
  const user = `loop-${Date.now()}`;
  const tmdbId = 990000 + Math.floor(Math.random() * 9000);
  setWatchedMovies(user, [tmdbId], true, "Loop", 1_000_000, "plex_history");
  await new Promise((r) => setTimeout(r, 600));
  const seen: AppEvent[] = [];
  const off = eventBus.on((e) => seen.push(e));
  try {
    // The same view seen again by a later sync, with a fresher date.
    setWatchedMovies(user, [tmdbId], true, "Loop", 2_000_000, "plex_history");
    await new Promise((r) => setTimeout(r, 600));
    assert.equal(seen.filter((e) => e.type === "watch_changed").length, 0);
    // A real change is still announced.
    setWatchedMovies(user, [tmdbId], false, "Loop", 3_000_000, "movviz_manual");
    await new Promise((r) => setTimeout(r, 600));
    assert.equal(seen.filter((e) => e.type === "watch_changed").length, 1);
  } finally {
    off();
  }
});
