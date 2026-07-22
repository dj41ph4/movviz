/**
 * Server-side access to the download engine (port 9820). The browser never
 * talks to the engine directly — it calls Movviz's own /api/engine/* proxy,
 * which forwards here. Keeps the engine on loopback and lets us attach the
 * shared token in one place.
 */

import { getEngineToken } from "./token";

const PORT = process.env.MOVVIZ_ENGINE_PORT ?? "9820";
const HOST = process.env.MOVVIZ_ENGINE_HOST ?? "127.0.0.1";
export const ENGINE_BASE = `http://${HOST}:${PORT}`;

export function engineHeaders(extra?: Record<string, string>) {
  return {
    "x-movviz-token": getEngineToken(),
    ...extra,
  };
}

/**
 * Default budget for a single call to the engine. Without this, a saturated
 * engine (e.g. mid-burst on a bulk import) leaves the calling request hanging
 * until the OS TCP timeout — which is what turns "engine is briefly busy"
 * into "the whole import request times out at the reverse proxy".
 */
export const ENGINE_TIMEOUT_MS = 10_000;

/** Typed GET helper used by server components; returns null if engine is down. */
export async function engineGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${ENGINE_BASE}/${path}`, {
      headers: engineHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(ENGINE_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
