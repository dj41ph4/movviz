import test from "node:test";
import assert from "node:assert/strict";
import { callAi, testGeminiKey } from "@/lib/ai/providers";
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

const modelOf = (input: unknown) => decodeURIComponent(String(input).match(/models\/([^:]+):/)?.[1] ?? "");

test("le modèle choisi ne change jamais : un modèle surchargé passe à la clé suivante, pas à un autre modèle", async () => {
  const originalFetch = globalThis.fetch;
  const models: string[] = [];
  globalThis.fetch = (async (input) => {
    models.push(modelOf(input));
    if (models.length === 1) return new Response(JSON.stringify({ error: { message: "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later." } }), { status: 503 });
    return geminiOk("Réponse de la clé suivante");
  }) as typeof fetch;
  try {
    const t0 = Date.now();
    const result = await callAi(config(["a", "b"]), "system", [{ role: "user", content: "salut ça va ?" }]);
    assert.deepEqual(result, { text: "Réponse de la clé suivante", provider: "gemini" });
    assert.deepEqual(models, ["gemini-3.5-flash-lite", "gemini-3.5-flash-lite"]);
    assert.ok(Date.now() - t0 < 5000, "no pause between keys");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("même quand toutes les clés échouent, aucun autre modèle n'est jamais essayé", async () => {
  const originalFetch = globalThis.fetch;
  const models: string[] = [];
  globalThis.fetch = (async (input) => {
    models.push(modelOf(input));
    return new Response(JSON.stringify({ error: { message: "You exceeded your current quota. Quota exceeded for metric: generate_content_free_tier_requests" } }), { status: 429 });
  }) as typeof fetch;
  try {
    await assert.rejects(callAi(config(["a", "b"]), "system", [{ role: "user", content: "salut" }]));
    assert.equal(models.length, 2, "une tentative par clé, pas plus");
    assert.ok(models.every((m) => m === "gemini-3.5-flash-lite"), models.join(", "));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("a request Gemini rejects for what it is stops there instead of burning every key's quota", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return new Response(JSON.stringify({ error: { message: "Request contains an invalid argument." } }), { status: 400 });
  }) as typeof fetch;
  try {
    await assert.rejects(callAi(config(["a", "b"]), "system", [{ role: "user", content: "a" }]));
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("un message sorti, une réponse entrée : jamais deux requêtes en parallèle, même quand Google traîne", async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 5_000));
    return geminiOk("lent mais seul");
  }) as typeof fetch;
  try {
    const result = await callAi(config(["a", "b"]), "s", [{ role: "user", content: "salut" }]);
    assert.equal(result.text, "lent mais seul");
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Google surchargé (503 sur toutes les clés) : une seconde chance après une courte pause, sur le même modèle", async () => {
  const originalFetch = globalThis.fetch;
  let round = 1;
  const models: string[] = [];
  globalThis.fetch = (async (input) => {
    models.push(modelOf(input));
    if (round === 1) return new Response(JSON.stringify({ error: { message: "This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later." } }), { status: 503 });
    return geminiOk("de retour");
  }) as typeof fetch;
  try {
    const pending = callAi(config(["a", "b", "c"]), "s", [{ role: "user", content: "salut" }]);
    setTimeout(() => { round = 2; }, 1_000); // Google revient pendant la pause
    const result = await pending;
    assert.equal(result.text, "de retour");
    assert.equal(models.length, 4, "les trois clés, puis la seconde chance");
    assert.ok(models.every((m) => m === "gemini-3.5-flash-lite"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("tester une clé : cette clé seule, avec le temps de Google et les tokens de réflexion", async () => {
  const originalFetch = globalThis.fetch;
  const used: string[] = [];
  globalThis.fetch = (async (input) => {
    used.push(new URL(String(input)).searchParams.get("key") ?? "");
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: "OK" }] } }], usageMetadata: { promptTokenCount: 20, thoughtsTokenCount: 812, candidatesTokenCount: 1 } }), { status: 200 });
  }) as typeof fetch;
  try {
    const result = await testGeminiKey(config(["k1", "k2", "k3"]), "k2");
    assert.equal(result.ok, true);
    assert.equal(result.reply, "OK");
    assert.deepEqual(result.usage, { prompt: 20, thoughts: 812, output: 1 });
    assert.deepEqual(used, ["k2"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
