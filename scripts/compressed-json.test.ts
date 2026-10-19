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

test("sans Accept-Encoding ou petite réponse : JSON brut, en-têtes conservés", async () => {
  const raw = await compressedJson(req(), big, { headers: { "Cache-Control": "private, no-store" } });
  assert.equal(raw.headers.get("content-encoding"), null);
  assert.equal(raw.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await raw.json(), big);
  const small = await compressedJson(req("br"), { ok: true }, { status: 202 });
  assert.equal(small.headers.get("content-encoding"), null);
  assert.equal(small.status, 202);
});
