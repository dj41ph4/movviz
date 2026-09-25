import { test } from "node:test";
import assert from "node:assert/strict";
import { searchTitleScene } from "@/lib/ai/providers";
import { getOrFetchScene, getCachedScene } from "@/lib/ai/sceneCache";
import { DEFAULT_AI_CONFIG } from "@/lib/ai/types";
import type { AiConfig } from "@/lib/ai/types";

/**
 * "Scène mémorable" web search (Tavily + the AI chain, gated by webSearchEnabled) —
 * these only cover the gating logic (disabled / no key), never a real
 * network call, since that needs a live Tavily key this repo doesn't have.
 * The point is to lock down that a disabled/misconfigured setup degrades to
 * null instead of throwing or silently trying another provider.
 */
function config(overrides: Partial<AiConfig>): AiConfig {
  return { ...DEFAULT_AI_CONFIG, ...overrides };
}

test("searchTitleScene: renvoie null si webSearchEnabled est désactivé, sans tenter d'appel réseau", async () => {
  const result = await searchTitleScene(config({ webSearchEnabled: false }), "peu importe");
  assert.equal(result, null);
});

test("searchTitleScene: renvoie null si aucune clé de recherche web configurée, même activé", async () => {
  const result = await searchTitleScene(config({ webSearchEnabled: true }), "peu importe");
  assert.equal(result, null);
});

test("getOrFetchScene: sans cache et webSearchEnabled désactivé, ne tente jamais de recherche et renvoie null", async () => {
  const result = await getOrFetchScene(config({ webSearchEnabled: false }), "movie", 998877, "Titre inconnu des tests");
  assert.equal(result, null);
  assert.equal(getCachedScene("movie", 998877), null, "aucune entrée ne doit avoir été écrite");
});

test("searchWeb: Tavily results are synthesized by the AI chain, never by the model browsing", async () => {
  const { searchWeb } = await import("@/lib/ai/providers");
  const originalFetch = globalThis.fetch;
  const calls: { url: string; body: Record<string, unknown> }[] = [];
  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    const body = JSON.parse(String(init?.body ?? "{}"));
    calls.push({ url, body });
    if (url === "https://api.tavily.com/search") {
      return new Response(JSON.stringify({ answer: "Le morceau est « Lux Æterna ».", results: [{ title: "Requiem for a Dream OST", url: "https://example.org/ost", content: "Clint Mansell compose Lux Æterna…" }] }), { status: 200 });
    }
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "C'est « Lux Æterna » de Clint Mansell." }] } }] }), { status: 200 });
  }) as typeof fetch;
  try {
    const cfg = config({ webSearchEnabled: true, webSearchKey: "tvly-test" });
    cfg.providers = { gemini: { model: "gemini-3.5-flash-lite", keys: [{ id: "g", key: "gemini-key" }] } };
    const text = await searchWeb(cfg, "Quelle est la musique principale de Requiem for a Dream ?");
    assert.equal(text, "C'est « Lux Æterna » de Clint Mansell.");
    assert.equal(calls[0].url, "https://api.tavily.com/search");
    assert.ok(calls[1].url.startsWith("https://generativelanguage.googleapis.com/"), "Gemini writes the answer from the search results");
    assert.match(JSON.stringify(calls[1].body), /Clint Mansell compose Lux/, "the search results are handed to the model");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
