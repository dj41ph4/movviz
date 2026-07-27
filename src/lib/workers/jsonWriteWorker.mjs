import { parentPort } from "node:worker_threads";
import fs from "node:fs/promises";

/**
 * Offloads the expensive part of writeJsonCached()'s disk write — JSON.stringify
 * of a large store — off the main thread. For a multi-megabyte library file this
 * stringify alone measured tens of ms on a dev machine and "several times that"
 * on NAS-class CPUs (see fsJsonCache.ts); running it here means a concurrent
 * request (including the Docker health check) never has to wait behind it.
 * Mirrors the exact compact/pretty decision and atomic tmp+rename write that the
 * main-thread path used before, so behavior is unchanged — only where it runs.
 */
const PRETTY_MAX_BYTES = 256 * 1024;

parentPort.on("message", async ({ file, value }) => {
  try {
    const compact = JSON.stringify(value);
    const json = compact.length <= PRETTY_MAX_BYTES ? JSON.stringify(value, null, 2) : compact;
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, json, "utf8");
    await fs.rename(tmp, file);
    const stat = await fs.stat(file);
    parentPort.postMessage({ ok: true, value: { mtimeMs: stat.mtimeMs, size: stat.size } });
  } catch (err) {
    parentPort.postMessage({ ok: false, error: err && err.message ? err.message : String(err) });
  }
});
