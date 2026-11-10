import { test } from "node:test";
import assert from "node:assert/strict";
import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { compressedJson } from "@/lib/http/compressedJson";

const big = { items: Array.from({ length: 2000 }, (_, i) => ({ id: `mv_${i}`, title: `Film ${i}`, plexUrl: `https://app.plex.tv/desktop#!/server/abc/details?key=${i}` })) };
const req = (acceptEncoding?: string) => new Request("http://x/api", { headers: acceptEncoding ? { "accept-encoding": acceptEncoding } : {} });

test("navigateur : brotli, contenu identique, bien plus petit", async () => {
  const res = await compressedJson(req("gzip, deflate, br, zstd"), big);
  assert.equal(res.headers.get("content-encoding"), "br");
  assert.match(res.headers.get("vary") ?? "", /Accept-Encoding/);
  const bytes = Buffer.from(await res.arrayBuffer());
  assert.equal(Number(res.headers.get("content-length")), bytes.length);
  assert.deepEqual(JSON.parse(brotliDecompressSync(bytes).toString()), big);
  assert.ok(bytes.length < JSON.stringify(big).length / 5);
});

test("Android (OkHttp) : gzip seulement", async () => {
  const res = await compressedJson(req("gzip"), big);
  assert.equal(res.headers.get("content-encoding"), "gzip");
  assert.deepEqual(JSON.parse(gunzipSync(Buffer.from(await res.arrayBuffer())).toString()), big);
});

test("cacheKey : mêmes octets réutilisés, jamais une réponse périmée", async () => {
  const a = Buffer.from(await (await compressedJson(req("br"), big, { cacheKey: "k" })).arrayBuffer());
  const b = Buffer.from(await (await compressedJson(req("br"), big, { cacheKey: "k" })).arrayBuffer());
  assert.deepEqual(a, b);
  const changed = { items: [...big.items, { id: "mv_new", title: "Nouveau", plexUrl: "" }] };
  const c = await compressedJson(req("br"), changed, { cacheKey: "k" });
  assert.deepEqual(JSON.parse(brotliDecompressSync(Buffer.from(await c.arrayBuffer())).toString()), changed);
  // Android sous la même clé : gzip, jamais les octets brotli du navigateur.
  const g = await compressedJson(req("gzip"), changed, { cacheKey: "k" });
  assert.equal(g.headers.get("content-encoding"), "gzip");
  assert.deepEqual(JSON.parse(gunzipSync(Buffer.from(await g.arrayBuffer())).toString()), changed);
});

test("sans Accept-Encoding ou petite réponse : JSON brut, en-têtes conservés", async () => {
  const raw = await compressedJson(req(), big, { headers: { "Cache-Control": "private, no-store" } });
  assert.equal(raw.headers.get("content-encoding"), null);
  assert.equal(raw.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await raw.json(), big);
  const small = await compressedJson(req("br"), { ok: true }, { status: 202 });
  assert.equal(small.headers.get("content-encoding"), null);
  assert.equal(small.status, 202);
});
