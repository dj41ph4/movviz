import { test } from "node:test";
import assert from "node:assert/strict";
import { selectHistoryPage } from "@/lib/activity/v2/historyPage";
import { resolveQueueSnapshot } from "@/lib/activity/v2/queueSnapshot";
import type { ActivityEntry } from "@/lib/activity/v2/types";

test("historique : 50 entrées puis les suivantes sans doublon", () => {
  const entries = Array.from({ length: 101 }, (_, index) => ({
    id: `item-${index}`, kind: "imported", actor: "admin",
    media: { id: String(index), title: `Film ${index}`, type: "movie", href: `/title/movie/${index}` },
  })) as ActivityEntry[];
  const first = selectHistoryPage(entries, {});
  const second = selectHistoryPage(entries, { after: first.nextCursor ?? undefined });
  assert.equal(first.items.length, 50);
  assert.equal(second.items.length, 50);
  assert.equal(second.items[0].id, "item-50");
  assert.equal(selectHistoryPage(entries, { kinds: ["failed"] }).total, 0);
});

test("file : conserve le dernier instantané si le moteur ne répond plus", () => {
  const items = [{ infoHash: "abc" }];
  const current = resolveQueueSnapshot({ torrents: items }, 123);
  assert.equal(current?.stale, false);
  assert.deepEqual(resolveQueueSnapshot(null, 456), { torrents: items, stale: true, updatedAt: 123 });
});
