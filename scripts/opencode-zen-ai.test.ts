import test from "node:test";
import assert from "node:assert/strict";
import { callAi } from "@/lib/ai/providers";
import { DEFAULT_AI_CONFIG, OPENCODE_ZEN_FREE_MODELS, isOpenCodeZenFreeModel, type AiConfig } from "@/lib/ai/types";

function config(model: string, priority = ["opencode", "mistral", "openrouter", "gemini"] as AiConfig["priority"]): AiConfig {
  return {
    ...DEFAULT_AI_CONFIG,
    enabled: true,
    primary: priority[0],
    priority,
    fallback: false,
    providers: {
      ...DEFAULT_AI_CONFIG.providers,
      opencode: { model, keys: [{ id: "test", key: "zen-test-key" }] },
    },
  };
}

test("OpenCode Zen exposes only the six models documented as Free", () => {
  assert.deepEqual(OPENCODE_ZEN_FREE_MODELS.map((model) => model.id), [
    "big-pickle",
    "mimo-v2.5-free",
    "ling-3.0-flash-fin-free",
    "nemotron-3-ultra-free",
    "nemotron-3.5-lightning-free",
    "muse-spark-1.3-contributor-free",
  ]);
  assert.equal(isOpenCodeZenFreeModel("gpt-6-astra"), false);
});

test("OpenCode Zen free chat models use the chat-completions endpoint", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  let capturedBody: Record<string, unknown> = {};
  globalThis.fetch = (async (input, init) => {
    capturedUrl = String(input);
    capturedBody = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ choices: [{ message: { content: "zen chat ok" } }] }), { status: 200 });
  }) as typeof fetch;
  try {
    const result = await callAi(config("big-pickle"), "system", [{ role: "user", content: "bonjour" }]);
    assert.equal(capturedUrl, "https://opencode.ai/zen/v1/chat/completions");
    assert.equal(capturedBody.model, "big-pickle");
    assert.deepEqual(result, { text: "zen chat ok", provider: "opencode" });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Muse Contributor Free uses Zen Responses and extracts output text", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  globalThis.fetch = (async (input) => {
    capturedUrl = String(input);
    return new Response(JSON.stringify({ output: [{ content: [{ type: "output_text", text: "zen responses ok" }] }] }), { status: 200 });
  }) as typeof fetch;
  try {
    const result = await callAi(config("muse-spark-1.3-contributor-free"), "system", [{ role: "user", content: "bonjour" }]);
    assert.equal(capturedUrl, "https://opencode.ai/zen/v1/responses");
    assert.equal(result.text, "zen responses ok");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Configured priority determines the fallback provider order", async () => {
  const originalFetch = globalThis.fetch;
  const attempted: string[] = [];
  globalThis.fetch = (async (input) => {
    attempted.push(String(input));
    if (String(input).includes("opencode.ai")) return new Response(JSON.stringify({ error: { message: "temporary" } }), { status: 500 });
    return new Response(JSON.stringify({ choices: [{ message: { content: "mistral fallback" } }] }), { status: 200 });
  }) as typeof fetch;
  const cfg = config("big-pickle", ["opencode", "mistral", "gemini", "openrouter"]);
  cfg.fallback = true;
  cfg.providers.mistral.keys = [{ id: "m", key: "mistral-test-key" }];
  try {
    const result = await callAi(cfg, "system", [{ role: "user", content: "bonjour" }]);
    assert.equal(result.provider, "mistral");
    assert.match(attempted[0], /opencode\.ai/);
    assert.match(attempted[1], /mistral\.ai/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
