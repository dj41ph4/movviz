import test from "node:test";
import assert from "node:assert/strict";
import { callAi } from "@/lib/ai/providers";
import { DEFAULT_AI_CONFIG, type AiConfig } from "@/lib/ai/types";

function config(keys: { groq?: string[]; gemini?: string[] }, primary: AiConfig["primary"] = "groq"): AiConfig {
  return {
    ...DEFAULT_AI_CONFIG,
    enabled: true,
    primary,
    providers: {
      groq: { model: "openai/gpt-oss-120b", keys: (keys.groq ?? []).map((key, i) => ({ id: `g${i}`, key })) },
      gemini: { model: "gemini-3.5-flash-lite", keys: (keys.gemini ?? []).map((key, i) => ({ id: `m${i}`, key })) },
    },
  };
}

const groqOk = (text: string) => new Response(JSON.stringify({ choices: [{ message: { content: text, reasoning: "internal thoughts" } }] }), { status: 200 });
const geminiOk = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });

test("Groq is called OpenAI-style with openai/gpt-oss-120b and a short reasoning", async () => {
  const originalFetch = globalThis.fetch;
  let url = "";
  let body: Record<string, unknown> = {};
  let auth = "";
  globalThis.fetch = (async (input, init) => {
    url = String(input);
    body = JSON.parse(String(init?.body));
    auth = String((init?.headers as Record<string, string>).authorization);
    return groqOk("Salut !");
  }) as typeof fetch;
  try {
    const result = await callAi(config({ groq: ["gsk-test"] }), "system", [{ role: "user", content: "Bonjour !" }]);
    assert.equal(url, "https://api.groq.com/openai/v1/chat/completions");
    assert.equal(auth, "Bearer gsk-test");
    assert.equal(body.model, "openai/gpt-oss-120b");
    assert.equal(body.reasoning_effort, "low");
    assert.ok(body.max_completion_tokens && !("max_tokens" in body), "never both token limits");
    assert.deepEqual(result, { text: "Salut !", provider: "groq" }, "the reasoning never leaks into the answer");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("when Groq fails, Gemini takes over automatically", async () => {
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input) => {
    const url = String(input);
    urls.push(url);
    if (url.includes("groq.com")) return new Response(JSON.stringify({ error: { message: "Request too large: tokens per minute limit 8000" } }), { status: 413 });
    return geminiOk("Gemini prend le relais");
  }) as typeof fetch;
  try {
    const result = await callAi(config({ groq: ["gsk-test"], gemini: ["AIza-test"] }), "system", [{ role: "user", content: "a" }]);
    assert.deepEqual(result, { text: "Gemini prend le relais", provider: "gemini" });
    assert.equal(urls.filter((u) => u.includes("groq.com")).length, 1, "a request too large is not retried on Groq");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("the primary provider is tried first, and a provider without a key is skipped", async () => {
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input) => {
    urls.push(String(input));
    return String(input).includes("groq.com") ? groqOk("groq") : geminiOk("gemini");
  }) as typeof fetch;
  try {
    assert.equal((await callAi(config({ groq: ["g"], gemini: ["m"] }, "gemini"), "s", [{ role: "user", content: "a" }])).provider, "gemini");
    assert.equal((await callAi(config({ gemini: ["m"] }, "groq"), "s", [{ role: "user", content: "a" }])).provider, "gemini");
    assert.ok(urls.every((u) => !u.includes("groq.com")), "Groq was never called: not primary, then no key");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a first 429 is retried once on the same key", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return calls === 1
      ? new Response(JSON.stringify({ error: { message: "Rate limit reached, please try again" } }), { status: 429, headers: { "retry-after": "0" } })
      : groqOk("ok après relance");
  }) as typeof fetch;
  try {
    const result = await callAi(config({ groq: ["g"] }), "s", [{ role: "user", content: "a" }]);
    assert.deepEqual(result, { text: "ok après relance", provider: "groq" });
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a request too big for Groq's free plan goes straight to Gemini", async () => {
  const originalFetch = globalThis.fetch;
  const urls: string[] = [];
  globalThis.fetch = (async (input) => {
    urls.push(String(input));
    return String(input).includes("groq.com") ? groqOk("groq") : geminiOk("gemini");
  }) as typeof fetch;
  try {
    const bigSystem = "règle ".repeat(10_000); // ~60 000 characters, like the chat prompt
    const big = await callAi(config({ groq: ["g"], gemini: ["m"] }), bigSystem, [{ role: "user", content: "a" }]);
    assert.equal(big.provider, "gemini");
    assert.ok(urls.every((u) => !u.includes("groq.com")), "no refused round trip to Groq");
    const small = await callAi(config({ groq: ["g"], gemini: ["m"] }), "court", [{ role: "user", content: "a" }]);
    assert.equal(small.provider, "groq", "small calls still use Groq");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
