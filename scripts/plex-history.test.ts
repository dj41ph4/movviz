import { test } from "node:test";
import assert from "node:assert/strict";
import { getAccountHistoryPage, ratingKeyFromPath } from "@/lib/plex/client";
import type { PlexServerConfig } from "@/lib/plex/types";

const config: PlexServerConfig = {
  hostname: "plex.example.test", port: 32400, useSsl: true, adminToken: "admin-token",
  clientId: "test-client", syncLibrary: false, watchlistSyncEnabled: false,
  markerSyncEnabled: false, machineIdentifier: "machine",
};

/**
 * Bug réel confirmé en direct (2026-09, tous comptes synchronisés,
 * 100% des épisodes rejetés "malformés") : `/status/sessions/history/all`
 * ne renvoie pas `grandparentRatingKey` sur ce serveur — seulement
 * `grandparentKey`, un chemin complet ("/library/metadata/531052"). Sans
 * repli sur ce champ, chaque épisode était rejeté même avec une entrée par
 * ailleurs complète.
 */
test("ratingKeyFromPath extrait le dernier segment d'un chemin Plex", () => {
  assert.equal(ratingKeyFromPath("/library/metadata/531052"), "531052");
  assert.equal(ratingKeyFromPath("/library/metadata/986222"), "986222");
});

test("ratingKeyFromPath : entrée vide ou absente -> undefined, jamais une chaîne vide", () => {
  assert.equal(ratingKeyFromPath(undefined), undefined);
  assert.equal(ratingKeyFromPath(""), undefined);
  assert.equal(ratingKeyFromPath("/"), undefined);
});

test("ratingKeyFromPath : une valeur déjà bare (sans slash) est retournée telle quelle", () => {
  assert.equal(ratingKeyFromPath("531052"), "531052");
});

test("getAccountHistoryPage effectue un seul appel et avance sur le nombre brut", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls++;
    const headers = new Headers(init?.headers);
    assert.match(String(url), /accountID=7/);
    assert.match(String(url), /sort=viewedAt%3Aasc/);
    assert.equal(headers.get("X-Plex-Container-Start"), "200");
    assert.equal(headers.get("X-Plex-Container-Size"), "100");
    return new Response(JSON.stringify({ MediaContainer: {
      totalSize: 1000,
      Metadata: Array.from({ length: 100 }, (_, index) => ({
        type: "movie", ratingKey: `movie-${index}`, title: `Movie ${index}`,
        accountID: index < 80 ? 7 : 8, viewedAt: index,
      })),
    } }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const page = await getAccountHistoryPage(config, "admin-token", 7, { start: 200, size: 100, sortDirection: "asc" });
    assert.equal(calls, 1);
    assert.equal(page.entries.length, 80);
    assert.equal(page.rawPageCount, 100);
    assert.equal(page.nextStart, 300);
    assert.equal(page.hasMore, true);
    assert.equal(page.rejectedForeignEntries, 20);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
