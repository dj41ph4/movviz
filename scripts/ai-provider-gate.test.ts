import test from "node:test";
import assert from "node:assert/strict";
import { callAi, probeGeminiModel } from "@/lib/ai/providers";
import { DEFAULT_AI_CONFIG, type AiConfig, type AiProviderId } from "@/lib/ai/types";

function config(provider: AiProviderId, model: string): AiConfig {
  return {
    ...DEFAULT_AI_CONFIG,
    enabled: true,
    primary: provider,
    providers: {
      groq: { ...DEFAULT_AI_CONFIG.providers.groq, keys: [] },
      gemini: { ...DEFAULT_AI_CONFIG.providers.gemini, keys: [] },
      [provider]: { model, keys: [{ id: "test", key: "test-key" }] },
    },
  };
}

const ok = (text: string) => new Response(JSON.stringify({ choices: [{ message: { content: text } }], candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });

test("calls to the same provider run one at a time, spaced for the free tier (Gemini)", async () => {
  const originalFetch = globalThis.fetch;
  let inFlight = 0;
  let maxInFlight = 0;
  const starts: number[] = [];
  globalThis.fetch = (async () => {
    inFlight++;
    maxInFlight = Math.max(maxInFlight, inFlight);
    starts.push(Date.now());
    await new Promise((resolve) => setTimeout(resolve, 50));
    inFlight--;
    return ok("ok");
  }) as typeof fetch;
  try {
    const cfg = config("gemini", "gemini-3.5-flash-lite");
    await Promise.all([
      callAi(cfg, "system", [{ role: "user", content: "a" }]),
      callAi(cfg, "system", [{ role: "user", content: "b" }]),
    ]);
    assert.equal(maxInFlight, 1);
    assert.ok(starts[1] - starts[0] >= 950, `spacing was ${starts[1] - starts[0]} ms`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a provider still refusing after its retry is left alone instead of hammered", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return new Response(JSON.stringify({ error: { message: "Too many requests" } }), { status: 429, headers: { "retry-after": "0" } });
  }) as typeof fetch;
  try {
    const cfg = config("groq", "openai/gpt-oss-120b");
    await assert.rejects(callAi(cfg, "system", [{ role: "user", content: "a" }]), (e: { status?: number }) => e.status === 429);
    assert.equal(calls, 2); // first try + one transparent retry
    const t0 = Date.now();
    await assert.rejects(callAi(cfg, "system", [{ role: "user", content: "b" }]), (e: { quota?: boolean }) => e.quota === true);
    assert.equal(calls, 2, "no request may be sent during the cooldown");
    assert.ok(Date.now() - t0 < 100, "the refusal during the cooldown must be immediate");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a Gemini model Google refuses is skipped for the next free one", async () => {
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("gemini-2.5-flash-lite")) {
      return new Response(JSON.stringify({ error: { message: "This model models/gemini-2.5-flash-lite is no longer available to new users." } }), { status: 400 });
    }
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }), { status: 200 });
  }) as typeof fetch;
  try {
    const result = await callAi(config("gemini", "gemini-2.5-flash-lite"), "system", [{ role: "user", content: "a" }]);
    assert.equal(result.text, "ok");
    assert.equal(urls.length, 2, "one refusal, no pointless retry of the refused model");
    assert.match(urls[1], /models\/gemini-3\.5-flash-lite:generateContent/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("the settings probe keeps working models, drops refused ones, never caches a hiccup", async () => {
  const originalFetch = globalThis.fetch;
  let hiccups = 0;
  globalThis.fetch = (async (input) => {
    const url = String(input);
    if (url.includes("gemini-2.5-flash:")) return new Response(JSON.stringify({ error: { message: "models/gemini-2.5-flash is not found" } }), { status: 404 });
    if (url.includes("gemini-3.8-flash:")) return new Response(JSON.stringify({ error: { message: "Quota exceeded for metric generate_content_free_tier_requests, limit: 0" } }), { status: 429 });
    if (url.includes("gemini-3.5-flash:")) { hiccups++; return new Response(JSON.stringify({ error: { message: "Resource exhausted" } }), { status: 429 }); }
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "OK" }] } }] }), { status: 200 });
  }) as typeof fetch;
  try {
    assert.equal(await probeGeminiModel("k", "gemini-3.5-flash-lite", "t"), "ok");
    assert.equal(await probeGeminiModel("k", "gemini-2.5-flash", "t"), "unavailable");
    assert.equal(await probeGeminiModel("k", "gemini-3.8-flash", "t"), "unavailable");
    assert.equal(await probeGeminiModel("k", "gemini-3.5-flash", "t"), "unknown");
    assert.equal(await probeGeminiModel("k", "gemini-3.5-flash", "t"), "unknown");
    assert.equal(hiccups, 2, "an inconclusive probe is tried again next time");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a Gemini key with its quota spent hands over to the next key at once", async () => {
  const originalFetch = globalThis.fetch;
  const keysUsed: string[] = [];
  globalThis.fetch = (async (input) => {
    const key = new URL(String(input)).searchParams.get("key") ?? "";
    keysUsed.push(key);
    if (key === "k1") return new Response(JSON.stringify({ error: { message: "You exceeded your current quota. Quota exceeded for metric: generate_content_free_tier_requests, limit: 500" } }), { status: 429 });
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "ok" }] } }] }), { status: 200 });
  }) as typeof fetch;
  try {
    const cfg = config("gemini", "gemini-3.5-flash-lite");
    cfg.providers.gemini.keys = [{ id: "a", key: "k1" }, { id: "b", key: "k2" }];
    const t0 = Date.now();
    const result = await callAi(cfg, "system", [{ role: "user", content: "a" }]);
    assert.equal(result.text, "ok");
    assert.deepEqual(keysUsed, ["k1", "k2"], "the spent key is not retried");
    assert.ok(Date.now() - t0 < 2_000, "no 6 s wait before the next key");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
