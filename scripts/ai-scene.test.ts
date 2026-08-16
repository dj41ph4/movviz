import { test } from "node:test";
import assert from "node:assert/strict";
import { searchTitleScene } from "@/lib/ai/providers";
import { getOrFetchScene, getCachedScene } from "@/lib/ai/sceneCache";
import { DEFAULT_AI_CONFIG } from "@/lib/ai/types";
import type { AiConfig } from "@/lib/ai/types";

/**
 * "Scène mémorable" web search (Mistral-only, gated by webSearchEnabled) —
 * these only cover the gating logic (disabled / no key), never a real
 * network call, since that needs a live Mistral key this repo doesn't have.
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

test("searchTitleScene: renvoie null si aucune clé Mistral configurée, même activé", async () => {
  const result = await searchTitleScene(config({ webSearchEnabled: true }), "peu importe");
  assert.equal(result, null);
});

test("getOrFetchScene: sans cache et webSearchEnabled désactivé, ne tente jamais de recherche et renvoie null", async () => {
  const result = await getOrFetchScene(config({ webSearchEnabled: false }), "movie", 998877, "Titre inconnu des tests");
  assert.equal(result, null);
  assert.equal(getCachedScene("movie", 998877), null, "aucune entrée ne doit avoir été écrite");
});
