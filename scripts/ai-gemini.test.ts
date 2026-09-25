import test from "node:test";
import assert from "node:assert/strict";
import { callAi } from "@/lib/ai/providers";
import { DEFAULT_AI_CONFIG, type AiConfig } from "@/lib/ai/types";

function config(keys: string[]): AiConfig {
  return {
    ...DEFAULT_AI_CONFIG,
    enabled: true,
    primary: "gemini",
    providers: { gemini: { model: "gemini-3.5-flash-lite", keys: keys.map((key, i) => ({ id: `m${i}`, key })) } },
  };
}

const geminiOk = (text: string) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });

test("keys are used in turn: each call starts on the next key, the first one rests", async () => {
  const originalFetch = globalThis.fetch;
  const used: string[] = [];
  globalThis.fetch = (async (input) => {
    used.push(new URL(String(input)).searchParams.get("key") ?? "");
    return geminiOk("ok");
  }) as typeof fetch;
  try {
    const cfg = config(["k1", "k2", "k3", "k4"]);
    for (let i = 0; i < 5; i++) await callAi(cfg, "s", [{ role: "user", content: `message ${i}` }]);
    assert.equal(new Set(used.slice(0, 4)).size, 4, "four messages, four different keys");
    assert.equal(used[4], used[0], "the fifth goes back to the rested first key");
    const order = ["k1", "k2", "k3", "k4"];
    for (let i = 1; i < 5; i++) assert.equal(order.indexOf(used[i]), (order.indexOf(used[i - 1]) + 1) % 4, "always the next key");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a key that fails hands over to the next key within the same call", async () => {
  const originalFetch = globalThis.fetch;
  const used: string[] = [];
  globalThis.fetch = (async (input) => {
    const key = new URL(String(input)).searchParams.get("key") ?? "";
    used.push(key);
    return used.length === 1
      ? new Response(JSON.stringify({ error: { message: "You exceeded your current quota" } }), { status: 429 })
      : geminiOk("clé suivante");
  }) as typeof fetch;
  try {
    const result = await callAi(config(["a", "b"]), "s", [{ role: "user", content: "a" }]);
    assert.equal(result.text, "clé suivante");
    assert.equal(used.length, 2);
    assert.notEqual(used[0], used[1]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("the model always answers the user: a conversation ending with its own message is trimmed", async () => {
  const originalFetch = globalThis.fetch;
  let contents: { role: string }[] = [];
  globalThis.fetch = (async (_input, init) => {
    contents = JSON.parse(String(init?.body)).contents;
    // Gemini 3's real behaviour when the last turn is the model's.
    if (contents[contents.length - 1]?.role === "model") {
      return new Response(JSON.stringify({ error: { message: "Requests ending with a model turn are not supported." } }), { status: 400 });
    }
    return geminiOk("un film d'horreur doux");
  }) as typeof fetch;
  try {
    const result = await callAi(config(["m"]), "s", [
      { role: "user", content: "aide moi a trouver un film d'horreur pour débutant" },
      { role: "assistant", content: "Au fait, tu as vu quoi récemment ?" }, // nudge appended mid-request
    ]);
    assert.equal(result.text, "un film d'horreur doux");
    assert.equal(contents[contents.length - 1].role, "user");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a Gemini model overloaded or out of per-minute quota hands over to the next model at once", async () => {
  const originalFetch = globalThis.fetch;
  const models: string[] = [];
  globalThis.fetch = (async (input) => {
    const model = decodeURIComponent(String(input).match(/models\/([^:]+):/)?.[1] ?? "");
    models.push(model);
    if (model === "gemini-3.5-flash-lite") return new Response(JSON.stringify({ error: { message: "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later." } }), { status: 503 });
    if (model === "gemini-3.1-flash-lite") return new Response(JSON.stringify({ error: { message: "You exceeded your current quota. Quota exceeded for metric: generate_content_free_tier_requests, limit: 15, model: gemini-3.1-flash-lite" } }), { status: 429 });
    return geminiOk("Réponse du modèle suivant");
  }) as typeof fetch;
  try {
    const t0 = Date.now();
    const result = await callAi(config(["AIza-test"]), "system", [{ role: "user", content: "salut ça va ?" }]);
    assert.deepEqual(result, { text: "Réponse du modèle suivant", provider: "gemini" });
    assert.deepEqual(models, ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-3.8-flash"]);
    assert.ok(Date.now() - t0 < 5000, "no pause between models");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a request Gemini rejects for what it is stops there instead of burning every model's quota", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return new Response(JSON.stringify({ error: { message: "Request contains an invalid argument." } }), { status: 400 });
  }) as typeof fetch;
  try {
    await assert.rejects(callAi(config(["AIza-test"]), "system", [{ role: "user", content: "a" }]));
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
