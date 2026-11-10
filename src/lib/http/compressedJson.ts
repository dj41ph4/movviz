import { promisify } from "node:util";
import { brotliCompress, constants, gzip } from "node:zlib";

const brotli = promisify(brotliCompress);
const gz = promisify(gzip);

/** Below this size compression costs more than it saves. */
const MIN_BYTES = 8 * 1024;

/**
 * JSON response compressed by the app itself.
 *
 * Route handler responses reach the browser uncompressed in production (measured: the dashboard
 * library payload travels as 2.1 MB of raw JSON, while static chunks are gzipped), which costs
 * several seconds per load on a remote connection. Compression runs on the libuv thread pool
 * (async zlib), never on the event loop. Brotli at a low quality level when the client accepts it
 * (browsers), gzip otherwise (OkHttp on Android sends gzip and decodes it transparently).
 */
/**
 * Compressed bytes of the last answer per `cacheKey`. The home payloads (2 MB of library JSON)
 * are identical from one request to the next until the library changes; recompressing them on
 * every load kept the libuv thread pool busy exactly when a page load needs it for everything
 * else. The JSON text itself is compared, so a changed answer can never be served stale.
 */
const MEMO_MAX = 16;
const gMemo = globalThis as typeof globalThis & {
  __movvizCompressedJsonMemo?: Map<string, { body: string; bytes: Uint8Array }>;
};
const memo: Map<string, { body: string; bytes: Uint8Array }> = (gMemo.__movvizCompressedJsonMemo ??= new Map());

export async function compressedJson(
  req: Request,
  data: unknown,
  init: { status?: number; headers?: Record<string, string>; cacheKey?: string } = {},
): Promise<Response> {
  const body = JSON.stringify(data);
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  headers.append("Vary", "Accept-Encoding");
  const accept = req.headers.get("accept-encoding") ?? "";
  if (body.length < MIN_BYTES || !/\b(br|gzip)\b/.test(accept)) return new Response(body, { status: init.status, headers });

  const useBrotli = /\bbr\b/.test(accept);
  const memoKey = init.cacheKey ? `${useBrotli ? "br" : "gzip"}:${init.cacheKey}` : null;
  const hit = memoKey ? memo.get(memoKey) : undefined;
  let bytes: Uint8Array;
  if (hit && hit.body === body) {
    bytes = hit.bytes;
    // Most recently used last: the oldest key is the one evicted.
    memo.delete(memoKey!);
    memo.set(memoKey!, hit);
  } else {
    bytes = new Uint8Array(useBrotli
      ? await brotli(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 4, [constants.BROTLI_PARAM_SIZE_HINT]: body.length } })
      : await gz(body, { level: 6 }));
    if (memoKey) {
      memo.delete(memoKey);
      memo.set(memoKey, { body, bytes });
      while (memo.size > MEMO_MAX) memo.delete(memo.keys().next().value!);
    }
  }
  headers.set("Content-Encoding", useBrotli ? "br" : "gzip");
  headers.set("Content-Length", String(bytes.byteLength));
  // A copy per response: the memoized bytes are never handed to a consumer.
  return new Response(bytes.slice(), { status: init.status, headers });
}
