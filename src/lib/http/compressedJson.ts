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
export async function compressedJson(
  req: Request,
  data: unknown,
  init: { status?: number; headers?: Record<string, string> } = {},
): Promise<Response> {
  const body = JSON.stringify(data);
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  headers.append("Vary", "Accept-Encoding");
  const accept = req.headers.get("accept-encoding") ?? "";
  if (body.length < MIN_BYTES || !/\b(br|gzip)\b/.test(accept)) return new Response(body, { status: init.status, headers });

  const useBrotli = /\bbr\b/.test(accept);
  const bytes = useBrotli
    ? await brotli(body, { params: { [constants.BROTLI_PARAM_QUALITY]: 4, [constants.BROTLI_PARAM_SIZE_HINT]: body.length } })
    : await gz(body, { level: 6 });
  headers.set("Content-Encoding", useBrotli ? "br" : "gzip");
  headers.set("Content-Length", String(bytes.byteLength));
  return new Response(new Uint8Array(bytes), { status: init.status, headers });
}
