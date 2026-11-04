import { test } from "node:test";
import assert from "node:assert/strict";
import { activeDownloadsCount, recordActiveDownloads } from "../src/lib/downloads/activeDownloadsCount.ts";
import { eventBus } from "../src/lib/events/EventBus.ts";
import { checkDownloads } from "../src/lib/events/downloadWatcher.ts";

const engine = (torrents: { infoHash: string; state: string; progress: number }[], delayMs = 0) => async () => {
  if (delayMs) await new Promise((resolve) => setTimeout(resolve, delayMs));
  return Response.json({ torrents });
};
const downloading = { infoHash: "a", state: "downloading", progress: 0.99 };
const completed = { infoHash: "a", state: "completed", progress: 1 };

function withEngine(run: () => Promise<void>) {
  return async () => {
    const previous = globalThis.fetch;
    try { await run(); } finally { globalThis.fetch = previous; }
  };
}

test("un téléchargement qui se termine : l'événement arrive quand le compteur est déjà à 0", withEngine(async () => {
  const seenOnEvent: Promise<number>[] = [];
  const stop = eventBus.on((event) => { if (event.type === "download_changed") seenOnEvent.push(activeDownloadsCount()); });
  try {
    globalThis.fetch = engine([downloading]) as typeof fetch;
    await checkDownloads();
    assert.equal(await activeDownloadsCount(), 1);

    globalThis.fetch = engine([completed]) as typeof fetch;
    seenOnEvent.length = 0;
    await checkDownloads();
    assert.deepEqual(await Promise.all(seenOnEvent), [0]);
  } finally {
    stop();
  }
}));

test("sans appareil à l'écoute, une valeur ancienne n'est pas rendue telle quelle", withEngine(async () => {
  recordActiveDownloads([{ state: "downloading" }]);
  const realNow = Date.now;
  Date.now = () => realNow() + 60_000;
  try {
    globalThis.fetch = engine([completed]) as typeof fetch;
    assert.equal(await activeDownloadsCount(), 0);
  } finally {
    Date.now = realNow;
    recordActiveDownloads([]);
  }
}));

test("une lecture lente du moteur n'écrase pas la valeur plus récente du surveillant", withEngine(async () => {
  recordActiveDownloads([{ state: "downloading" }]);
  const realNow = Date.now;
  const start = realNow();
  Date.now = () => start + 60_000;
  try {
    globalThis.fetch = engine([downloading], 50) as typeof fetch;
    const slowRead = activeDownloadsCount();
    Date.now = () => start + 60_010;
    recordActiveDownloads([]);
    assert.equal(await slowRead, 0);
    await new Promise((resolve) => setTimeout(resolve, 80));
    assert.equal(await activeDownloadsCount(), 0);
  } finally {
    Date.now = realNow;
    recordActiveDownloads([]);
  }
}));
