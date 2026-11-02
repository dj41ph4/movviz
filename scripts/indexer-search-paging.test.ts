import { test } from "node:test";
import assert from "node:assert/strict";
import { searchIndexer } from "@/lib/indexers/torznab";
import type { ConfiguredIndexer } from "@/lib/indexers/types";

const indexer: ConfiguredIndexer = {
  id: "paging-test", name: "PagingTest", kind: "torznab", protocol: "torrent",
  baseUrl: "https://paging-test.invalid/api", authType: "apikey", apiKey: "k", username: "", password: "",
  categories: [5000], enabled: true, priority: 1, addedAt: 0,
};

const page = (from: number, count: number) =>
  `<rss><channel>${Array.from({ length: count }, (_, i) => {
    const n = from + i;
    return `<item><title>Chicago.Fire.S14E${String(n).padStart(2, "0")}.MULTi.1080p.WEB.H264-GRP</title><guid>guid-${n}</guid><enclosure url="https://paging-test.invalid/dl/${n}" length="1000000000"/></item>`;
  }).join("")}</channel></rss>`;

test("une recherche texte lit les pages suivantes tant qu'une page revient pleine", async () => {
  const urls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = String(input);
    urls.push(url);
    const offset = Number(new URL(url).searchParams.get("offset") ?? 0);
    const body = offset === 0 ? page(1, 100) : offset === 100 ? page(101, 100) : page(201, 3);
    return new Response(body, { status: 200 });
  }) as typeof fetch;
  try {
    const releases = await searchIndexer(indexer, "Chicago Fire", undefined, "Chicago Fire", 3);
    assert.equal(urls.length, 3);
    assert.deepEqual(urls.map((u) => new URL(u).searchParams.get("offset")), [null, "100", "200"]);
    assert.equal(releases.length, 203);
    assert.ok(releases.some((r) => r.guid === "guid-203"));
  } finally {
    globalThis.fetch = original;
  }
});

test("une page non pleine arrête la lecture et la valeur par défaut reste une seule page", async () => {
  const urls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    urls.push(String(input));
    return new Response(page(1, 100), { status: 200 });
  }) as typeof fetch;
  try {
    await searchIndexer(indexer, "Chicago Fire");
    assert.equal(urls.length, 1);
    urls.length = 0;
    globalThis.fetch = (async (input: string | URL | Request) => {
      urls.push(String(input));
      return new Response(page(1, 12), { status: 200 });
    }) as typeof fetch;
    await searchIndexer(indexer, "Chicago Fire", undefined, undefined, 3);
    assert.equal(urls.length, 1);
  } finally {
    globalThis.fetch = original;
  }
});
