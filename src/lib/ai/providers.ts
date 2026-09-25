import type { AiChatMessage, AiConfig, AiProviderId } from "./types";
import { AI_PROVIDERS } from "./types";
import { GEMINI_RECOMMENDED_MODELS, defaultModel, isFreeModel } from "./freeModels";

/**
 * AI client — Groq (openai/gpt-oss-120b) and Gemini. Safety nets that keep
 * the assistant answering on free keys:
 *  1. Provider fallback — the primary provider first; when it fails, the
 *     other one takes over automatically (providers without a key are skipped).
 *  2. Key rotation — several keys per provider; a key whose quota is spent
 *     hands over to the next one at once.
 *  3. Gemini model fallback — a model Google refuses (retired, or outside
 *     this key's free tier) is skipped for the next free one.
 * Every call to a provider goes through its queue (see withProviderGate):
 * one request at a time, spaced, and a pause after a persistent refusal.
 *
 * URLs are hardcoded constants — no user-supplied URL is ever fetched, so
 * there is no SSRF surface here (AGENTS.md).
 */

const TIMEOUT_MS = 45_000;
// A bulk add_media request (~100 titles pasted at once, e.g. a Netflix
// export) needs room for the whole JSON: an old 1024-token ceiling cut it
// mid-object and every retry hit the same wall. Well past the prompt's own
// 25-item cap (intentParser.ts).
const MAX_RESPONSE_TOKENS = 4096;
const QUOTA_RE = /quota|rate limit|resource exhausted|429|too many requests|403|forbidden|api key not valid|invalid api key/i;

export class AiCallError extends Error {
  readonly provider: AiProviderId;
  readonly quota: boolean;
  readonly status?: number;
  /** Seconds the provider asked us to wait (Retry-After header), if any. */
  readonly retryAfterSec?: number;
  constructor(provider: AiProviderId, message: string, quota: boolean, status?: number, retryAfterSec?: number) {
    super(message);
    this.name = "AiCallError";
    this.provider = provider;
    this.quota = quota;
    this.status = status;
    this.retryAfterSec = retryAfterSec;
  }
}

/** A momentary 429 (burst) is worth ONE retry after a pause, unlike a 403 /
 *  bad key, which never succeeds on retry. */
function isRateLimited(err: AiCallError): boolean {
  if (err.status === 429) return true;
  return /rate limit|too many requests|resource exhausted/i.test(err.message);
}

/** Google answers a retired model (or one kept from new users) with a 404 or
 *  a 400 "no longer available", and a model outside this key's free tier
 *  with a 429 whose quota "limit" is 0. Both are permanent for this key —
 *  unlike an ordinary 429, waiting will not help. */
export function isModelUnavailable(err: AiCallError): boolean {
  if (err.status === 404) return true;
  return /no longer available|is not found|not supported for generatecontent|limit:\s*0\b/i.test(err.message);
}

/** The key's quota is used up — daily/monthly (« Quota exceeded for
 *  metric… », « You exceeded your current quota », Groq « requests per day »)
 *  or a request larger than the per-minute token allowance (Groq 413) — as
 *  opposed to a momentary burst: retrying the same key won't help. */
function isQuotaSpent(err: AiCallError): boolean {
  if (err.status === 413) return true;
  return /quota exceeded|exceeded your current quota|requests per day|tokens per day|request too large/i.test(err.message);
}

/** Respects the provider's Retry-After (capped), else a short fixed pause. */
function rateLimitDelayMs(err: AiCallError): number {
  const asked = typeof err.retryAfterSec === "number" && Number.isFinite(err.retryAfterSec) ? err.retryAfterSec : NaN;
  if (!Number.isNaN(asked)) return Math.min(Math.max(asked, 0), 30) * 1000;
  return 6000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function jsonFetch(provider: AiProviderId, url: string, headers: Record<string, string>, body: unknown): Promise<unknown> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const raw = await res.text();
  let json: unknown = null;
  try { json = raw ? JSON.parse(raw) : null; } catch { /* non-JSON error body */ }
  if (!res.ok) {
    const j = json as { error?: { message?: string } | string; message?: string } | null;
    const m = typeof j?.error === "string" ? j.error : j?.error?.message ?? j?.message;
    const errorMessage = typeof m === "string" ? m : null;
    // Retry-After for 429s (seconds, or HTTP date): honor the pause asked for.
    let retryAfterSec: number | undefined;
    if (res.status === 429) {
      const header = res.headers?.get("retry-after");
      if (header) {
        const secs = Number(header);
        retryAfterSec = Number.isFinite(secs) ? secs : Math.max(0, (Date.parse(header) - Date.now()) / 1000);
      }
    }
    const quota = res.status === 429 || res.status === 403 || res.status === 413 || (!!errorMessage && QUOTA_RE.test(errorMessage));
    throw new AiCallError(provider, errorMessage ?? `HTTP ${res.status}`, quota, res.status, retryAfterSec);
  }
  return json ?? raw;
}

function geminiUrl(model: string, key: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
}

/** One call with one key and one model; throws AiCallError on failure. */
async function generate(provider: AiProviderId, key: string, model: string, system: string, messages: AiChatMessage[]): Promise<string> {
  if (provider === "groq") {
    // OpenAI-compatible. gpt-oss is a reasoning model: « low » keeps the
    // thinking short (latency, and its tokens count in the same budget); the
    // reasoning comes back in its own field, never inside the answer.
    const json = await jsonFetch(provider, "https://api.groq.com/openai/v1/chat/completions", { authorization: `Bearer ${key}` }, {
      model,
      messages: [{ role: "system", content: system }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
      temperature: 0.2,
      max_completion_tokens: MAX_RESPONSE_TOKENS,
      reasoning_effort: "low",
    });
    const choices = (json as { choices?: { message?: { content?: string } }[] })?.choices ?? [];
    return choices.map((c) => c.message?.content ?? "").join("").trim();
  }
  const json = await jsonFetch(provider, geminiUrl(model, key), {}, {
    systemInstruction: { parts: [{ text: system }] },
    contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    generationConfig: { temperature: 0.2, maxOutputTokens: MAX_RESPONSE_TOKENS },
  });
  const candidates = (json as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates ?? [];
  return candidates.map((c) => (c.content?.parts ?? []).map((p) => p.text ?? "").join("")).join("").trim();
}

/**
 * Free plans limit requests per minute: the chat used to fire its answer AND
 * the fact extraction at the same time, the second got a 429 for sure, then
 * a retry 6 s later. Calls to one provider therefore go one at a time, at
 * least MIN_INTERVAL_MS apart (Groq free plan: 30 requests/min).
 */
const MIN_INTERVAL_MS: Record<AiProviderId, number> = { groq: 2_000, gemini: 1_000 };
/** After a persistent refusal (429 even after the retry), the provider is
 *  left alone this long: an immediate failure instead of hammering it. */
const RATE_LIMIT_COOLDOWN_MS = 60_000;

interface Gate { tail: Promise<void>; lastStartAt: number; coolUntil: number }
const gGates = globalThis as typeof globalThis & { __movvizAiGates?: Map<AiProviderId, Gate> };
const gates: Map<AiProviderId, Gate> = (gGates.__movvizAiGates ??= new Map());
function gateFor(provider: AiProviderId): Gate {
  let gate = gates.get(provider);
  if (!gate) { gate = { tail: Promise.resolve(), lastStartAt: 0, coolUntil: 0 }; gates.set(provider, gate); }
  return gate;
}

/** Runs one request inside a provider's queue. Every call to a provider must
 *  go through here, or it silently eats the quota the others pace on. */
async function withProviderGate<T>(provider: AiProviderId, run: () => Promise<T>, coolDownOnRateLimit: boolean): Promise<T> {
  const gate = gateFor(provider);
  const coolingDown = () => new AiCallError(provider, `Limite de débit atteinte — nouvel essai possible dans ${Math.ceil((gate.coolUntil - Date.now()) / 1000)} s`, true, 429);
  if (Date.now() < gate.coolUntil) throw coolingDown();
  let release!: () => void;
  const turn = gate.tail;
  gate.tail = new Promise<void>((resolve) => { release = resolve; });
  await turn;
  try {
    // A call queued before the pause must not leave during it.
    if (Date.now() < gate.coolUntil) throw coolingDown();
    const wait = gate.lastStartAt + MIN_INTERVAL_MS[provider] - Date.now();
    if (wait > 0) await sleep(wait);
    gate.lastStartAt = Date.now();
    return await run();
  } catch (e) {
    if (coolDownOnRateLimit && e instanceof AiCallError && isRateLimited(e) && !isQuotaSpent(e)) gate.coolUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
    throw e;
  } finally {
    release();
  }
}

export type GeminiProbe = "ok" | "unavailable" | "unknown";
const PROBE_TTL_MS: Record<Exclude<GeminiProbe, "unknown">, number> = { ok: 6 * 60 * 60 * 1000, unavailable: 24 * 60 * 60 * 1000 };
const gProbes = globalThis as typeof globalThis & { __movvizGeminiProbes?: Map<string, { result: GeminiProbe; at: number }> };
const geminiProbes: Map<string, { result: GeminiProbe; at: number }> = (gProbes.__movvizGeminiProbes ??= new Map());

/**
 * Really asks one Gemini model for a one-word answer with this key. Google's
 * Models API lists models it then refuses (retired 2.5 models, models without
 * a free quota), so a listing proves nothing — only an actual call does.
 * "unknown" (network error, ordinary rate limit) is never cached: it says
 * nothing about the model itself.
 */
export async function probeGeminiModel(key: string, model: string, keyTag: string): Promise<GeminiProbe> {
  const cacheKey = `${keyTag}:${model}`;
  const cached = geminiProbes.get(cacheKey);
  if (cached && cached.result !== "unknown" && Date.now() - cached.at < PROBE_TTL_MS[cached.result]) return cached.result;
  let result: GeminiProbe;
  try {
    await withProviderGate("gemini", () => jsonFetch("gemini", geminiUrl(model, key), {}, {
      contents: [{ role: "user", parts: [{ text: "Réponds OK." }] }],
      generationConfig: { maxOutputTokens: 256 },
    }), false);
    result = "ok";
  } catch (e) {
    result = e instanceof AiCallError && isModelUnavailable(e) ? "unavailable" : "unknown";
  }
  if (result !== "unknown") geminiProbes.set(cacheKey, { result, at: Date.now() });
  return result;
}

/** Every key of one provider in order (and for Gemini, the configured model
 *  then the other free ones when Google refuses it); throws the last failure. */
async function callProvider(config: AiConfig, provider: AiProviderId, system: string, messages: AiChatMessage[]): Promise<string> {
  const configured = config.providers[provider].model.trim();
  // An old or forged config must never quietly reach a paid model.
  const model = isFreeModel(provider, configured) ? configured : defaultModel(provider);
  const keys = config.providers[provider].keys.map((k) => k.key.trim()).filter(Boolean);
  if (keys.length === 0) throw new AiCallError(provider, "Aucune clé configurée", false);
  const modelsToTry = provider === "gemini"
    ? [model, ...GEMINI_RECOMMENDED_MODELS.map((m) => m.id).filter((id) => id !== model)]
    : [model];

  let lastError: AiCallError | null = null;
  for (const key of keys) {
    for (const modelId of modelsToTry) {
      let modelUnavailable = false;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          return await generate(provider, key, modelId, system, messages);
        } catch (e) {
          lastError = e instanceof AiCallError ? e : new AiCallError(provider, (e as Error).message, false);
          if (provider === "gemini" && isModelUnavailable(lastError)) { modelUnavailable = true; break; }
          // A spent quota won't come back in 6 s: next key at once. A plain
          // burst limit gets one transparent retry on the same key.
          if (isQuotaSpent(lastError)) break;
          if (attempt === 0 && isRateLimited(lastError)) {
            await sleep(rateLimitDelayMs(lastError));
            continue;
          }
          break;
        }
      }
      if (!modelUnavailable) break; // any other failure: next key
    }
  }
  throw lastError ?? new AiCallError(provider, "Échec inconnu", false);
}

/** Asks the AI: primary provider first, then the other one; returns the text
 *  and the provider that answered (shown as « via Groq » / « via Gemini »). */
export async function callAi(config: AiConfig, system: string, messages: AiChatMessage[]): Promise<{ text: string; provider: AiProviderId }> {
  const inputTokens = estimateTokens(system, messages);
  const order = [config.primary, ...AI_PROVIDERS.filter((p) => p !== config.primary)]
    .filter((p) => config.providers[p].keys.some((k) => k.key.trim()))
    // Groq's free plan refuses any request above 8 000 tokens/minute — the
    // chat's own prompt is ~14 000. Skip it for those instead of spending a
    // refused round trip on every message; it still serves the small calls.
    .filter((p, _, all) => p !== "groq" || inputTokens <= GROQ_FREE_MAX_INPUT_TOKENS || all.length === 1);
  let lastError: AiCallError | null = null;
  for (const provider of order) {
    try {
      // callProvider already retried once: a 429 reaching the gate is persistent.
      const text = await withProviderGate(provider, () => callProvider(config, provider, system, messages), true);
      if (text) return { text, provider };
      lastError = new AiCallError(provider, "Réponse vide du modèle", false);
    } catch (e) {
      lastError = e instanceof AiCallError ? e : new AiCallError(provider, (e as Error).message, false);
    }
  }
  throw lastError ?? new AiCallError(config.primary, "Aucune clé IA configurée", false);
}

/** Groq free plan: 8 000 tokens/minute, input + output — room left for the answer. */
const GROQ_FREE_MAX_INPUT_TOKENS = 6_500;

/** Rough token count (~3.5 characters per token for French prose). */
function estimateTokens(system: string, messages: AiChatMessage[]): number {
  return Math.ceil((system.length + messages.reduce((n, m) => n + m.content.length, 0)) / 3.5);
}

export interface AiCandidateResult {
  text: string;
  provider: AiProviderId;
}

/** One candidate reply (the dialogue director can pick among several). */
export async function callAiCandidates(config: AiConfig, system: string, messages: AiChatMessage[]): Promise<AiCandidateResult[]> {
  return [await callAi(config, system, messages)];
}

interface TavilyResult {
  title?: string;
  url?: string;
  content?: string;
}

/** One Tavily search (https://api.tavily.com/search). Null on any failure. */
async function tavilySearch(apiKey: string, query: string): Promise<{ answer: string | null; results: TavilyResult[] } | null> {
  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      // Tavily caps queries at 400 characters.
      body: JSON.stringify({ query: query.slice(0, 400), max_results: 6, include_answer: true, search_depth: "basic" }),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { answer?: unknown; results?: unknown };
    const results = Array.isArray(data.results) ? (data.results as TavilyResult[]) : [];
    return { answer: typeof data.answer === "string" ? data.answer : null, results };
  } catch {
    return null;
  }
}

/**
 * Web search for the assistant (« Recherche web » in Réglages → IA): the
 * question goes to a real search engine (Tavily), and its results are then
 * synthesized by the configured AI — the model itself never browses.
 * Returns null on ANY failure (disabled, no key, no result, AI down): callers
 * degrade to not having web facts, never to a broken reply.
 */
export async function searchWeb(config: AiConfig, prompt: string): Promise<string | null> {
  if (!config.webSearchEnabled) return null;
  const apiKey = config.webSearchKey?.trim();
  if (!apiKey) return null;
  const found = await tavilySearch(apiKey, prompt);
  if (!found || (!found.answer && found.results.length === 0)) return null;
  const sources = found.results
    .slice(0, 6)
    .map((r, i) => `[${i + 1}] ${r.title ?? ""} — ${r.url ?? ""}\n${(r.content ?? "").slice(0, 900)}`)
    .join("\n\n");
  const system = "Tu synthétises des résultats de recherche web, en français. Réponds UNIQUEMENT à partir des sources fournies : n'invente rien, et si elles ne permettent pas de répondre, dis-le. Réponse directe et concise, avec les liens utiles quand c'est pertinent.";
  const user = `Demande : ${prompt}\n\n${found.answer ? `Résumé du moteur de recherche : ${found.answer}\n\n` : ""}Sources :\n${sources}`;
  try {
    const { text } = await callAi(config, system, [{ role: "user", content: user }]);
    return text.trim() || null;
  } catch {
    return null;
  }
}

/** Compatibility name used by the scene cache. */
export async function searchTitleScene(config: AiConfig, prompt: string): Promise<string | null> {
  return searchWeb(config, prompt);
}
