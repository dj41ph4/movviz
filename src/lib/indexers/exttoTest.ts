import type { ConfiguredIndexer } from "./types";
import { bootstrapResolver } from "@/lib/resolver/bootstrap";
import { loadResolverConfig } from "@/lib/resolver/store";

/** Manual test for a saved EXT.to indexer, including one not yet enabled. */
export async function testExtToIndexer(ix: ConfiguredIndexer, username = ix.username, password = ix.password) {
  if (ix.key !== "extto" || !ix.apiKey || !username?.trim() || !password) {
    return { ok: false, detail: "EXT.to login and password required" };
  }
  try {
    await bootstrapResolver(true);
    const base = loadResolverConfig().url;
    const health = `${base}/health`;
    let ready = false;
    for (let attempt = 0; attempt < 20; attempt++) {
      try {
        if ((await fetch(health, { cache: "no-store", signal: AbortSignal.timeout(2000) })).ok) {
          ready = true;
          break;
        }
      } catch { /* process may still be starting */ }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (!ready) return { ok: false, detail: "EXT.to resolver unavailable" };
    const response = await fetch(`${base}/extto/test`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": ix.apiKey },
      body: JSON.stringify({ username, password }),
      cache: "no-store",
      signal: AbortSignal.timeout(150000),
    });
    const result = await response.json() as { ok?: boolean; detail?: string };
    return { ok: response.ok && result.ok === true, detail: result.detail ?? `HTTP ${response.status}` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "EXT.to unavailable" };
  }
}
