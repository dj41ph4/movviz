import { test } from "node:test";
import assert from "node:assert/strict";
import { testIndexer } from "@/lib/indexers/torznab";
import type { ConfiguredIndexer } from "@/lib/indexers/types";

test("EXT.to health checks use the integrated test instead of its web URL as Torznab", async () => {
  const ix: ConfiguredIndexer = {
    id: "test-extto",
    key: "extto",
    name: "EXT.to",
    kind: "torznab",
    protocol: "torrent",
    baseUrl: "https://ext.to",
    authType: "credentials",
    apiKey: "",
    username: "example",
    password: "example",
    categories: [2000, 5000],
    enabled: true,
    priority: 1,
    addedAt: 0,
  };
  const result = await testIndexer(ix);
  assert.equal(result.ok, false);
  assert.equal(result.detail, "EXT.to login and password required");
});
