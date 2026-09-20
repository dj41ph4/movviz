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

test("getAccountHistoryPage : page vide sans Metadata (start au-delà du total) -> page vide, pas d'erreur", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return new Response(JSON.stringify({ MediaContainer: {
      size: 0, totalSize: 4641,
    } }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const page = await getAccountHistoryPage(config, "admin-token", 7, { start: 4700, size: 100, sortDirection: "desc" });
    assert.equal(page.entries.length, 0);
    assert.equal(page.rawPageCount, 0);
    assert.equal(page.totalSize, 4641);
    assert.equal(page.nextStart, 4700);
    assert.equal(page.hasMore, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getAccountHistoryPage : historique vide (size=0, totalSize=0) -> page vide, pas d'erreur", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return new Response(JSON.stringify({ MediaContainer: {
      size: 0, totalSize: 0,
    } }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const page = await getAccountHistoryPage(config, "admin-token", 7, { start: 0, size: 100, sortDirection: "desc" });
    assert.equal(page.entries.length, 0);
    assert.equal(page.rawPageCount, 0);
    assert.equal(page.totalSize, 0);
    assert.equal(page.hasMore, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getAccountHistoryPage : Metadata objet unique -> enveloppé en tableau", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return new Response(JSON.stringify({ MediaContainer: {
      size: 1, totalSize: 4641,
      Metadata: { type: "movie", ratingKey: "movie-1", title: "Movie 1", accountID: 7, viewedAt: 5 },
    } }), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const page = await getAccountHistoryPage(config, "admin-token", 7, { start: 0, size: 1, sortDirection: "desc" });
    assert.equal(page.entries.length, 1);
    assert.equal(page.rawPageCount, 1);
    assert.equal(page.nextStart, 1);
    assert.equal(page.hasMore, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("getAccountHistoryPage : MediaContainer absent -> erreur invalid_shape conservée", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    return new Response(JSON.stringify({}), { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    await assert.rejects(
      () => getAccountHistoryPage(config, "admin-token", 7, { start: 0, size: 100, sortDirection: "desc" }),
      /plex_history_page_invalid_shape/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
