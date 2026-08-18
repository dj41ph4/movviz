import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * Resolves a worker in both development and standalone installations.
 *
 * Next's standalone tracer does not reliably retain files reached only by
 * `new Worker(new URL(..., import.meta.url))`. `clean-standalone.mjs` copies
 * every worker beside server.js into `workers/`; prefer that explicit runtime
 * asset whenever it exists, otherwise keep the normal source-relative URL.
 */
export function resolveWorkerUrl(fileName: string, sourceUrl: string): URL {
  const bundledPath = path.join(process.cwd(), "workers", fileName);
  return fs.existsSync(bundledPath)
    ? pathToFileURL(bundledPath)
    : new URL(`./${fileName}`, sourceUrl);
}
