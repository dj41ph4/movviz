import type { AiChatMessage, AiConfig, AiProviderId } from "./types";
import { AI_PROVIDERS } from "./types";
import { GEMINI_RECOMMENDED_MODELS, defaultModel, isFreeModel } from "./freeModels";

/**
 * AI client — Gemini. Safety nets that keep the assistant answering on free
 * keys:
 *  1. Keys in turn — call 1 on key 1, call 2 on key 2… then key 1 again:
 *     each key rests between two uses instead of the first one being worn
 *     out before the second is ever touched. A key that fails hands over to
 *     the next one within the same call.
 *  2. Model fallback — a model that is busy, out of its per-minute quota or
 *     refused hands over to the next free one (each has its own quota).
 * Every call goes through the provider's queue (see withProviderGate):
 * starts spaced, and a pause after a persistent refusal.
 *
 * URLs are hardcoded constants — no user-supplied URL is ever fetched, so
 * there is no SSRF surface here (AGENTS.md).
 */

// Per attempt. A reply normally takes 1-5 s (a 15-card recommendation up to
// ~15 s); 45 s used to be spent waiting on a stuck model before failing,
// when the next Gemini model would have answered in two.
const TIMEOUT_MS = 25_000;
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

/** The key's quota is used up (« Quota exceeded for metric… », « You
 *  exceeded your current quota ») — as opposed to a momentary burst. */
function isQuotaSpent(err: AiCallError): boolean {
  if (err.status === 413) return true;
  return /quota exceeded|exceeded your current quota|requests per day|tokens per day|request too large/i.test(err.message);
}

/** Worth trying the next Gemini model: its free quota is counted per MODEL
 *  (« limit: 15, model: gemini-3.5-flash-lite »), and Google overloads one
 *  model at a time (503 « This model is currently experiencing high
 *  demand »). Both came back as a failed message, one question in two,
 *  while the next model was free. */
export function isGeminiModelBusy(err: AiCallError): boolean {
  if (err.status === 429 || err.status === 500 || err.status === 503 || err.status === 504) return true;
  return /high demand|overloaded|currently unavailable|try again later|timeout|timed out|aborted|quota|rate limit|resource exhausted|too many requests|internal error/i.test(err.message);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function jsonFetch(provider: AiProviderId, url: string, headers: Record<string, string>, body: unknown, cancel?: AbortSignal): Promise<unknown> {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
    signal: cancel ? AbortSignal.any([timeout, cancel]) : timeout,
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
async function generate(provider: AiProviderId, key: string, model: string, system: string, messages: AiChatMessage[], cancel?: AbortSignal): Promise<string> {
  const json = await jsonFetch(provider, geminiUrl(model, key), {}, {
    systemInstruction: { parts: [{ text: system }] },
    contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
    generationConfig: { temperature: 0.2, maxOutputTokens: MAX_RESPONSE_TOKENS },
  }, cancel);
  const candidates = (json as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates ?? [];
  return candidates.map((c) => (c.content?.parts ?? []).map((p) => p.text ?? "").join("")).join("").trim();
}

/**
 * Free plans limit requests per minute: the chat used to fire its answer AND
 * the fact extraction at the same time, the second got a 429 for sure, then
 * a retry 6 s later. Starts are therefore spaced at least MIN_INTERVAL_MS.
 */
const MIN_INTERVAL_MS: Record<AiProviderId, number> = { gemini: 1_000 };
/** After a persistent refusal (429 even after the retry), the provider is
 *  left alone this long: an immediate failure instead of hammering it. */
const RATE_LIMIT_COOLDOWN_MS = 20_000;

/** Several users can be answered at once: free plans count requests per
 *  MINUTE, not requests in flight — so only the STARTS are spaced. Waiting
 *  for a whole answer (5-17 s) before the next user's even began made a
 *  second person wait for the first one's reply. */
const MAX_IN_FLIGHT = 3;

interface Gate { tail: Promise<void>; lastStartAt: number; coolUntil: number; inFlight: number; waiters: (() => void)[] }
const gGates = globalThis as typeof globalThis & { __movvizAiGates?: Map<AiProviderId, Gate> };
const gates: Map<AiProviderId, Gate> = (gGates.__movvizAiGates ??= new Map());
function gateFor(provider: AiProviderId): Gate {
  let gate = gates.get(provider);
  if (!gate) { gate = { tail: Promise.resolve(), lastStartAt: 0, coolUntil: 0, inFlight: 0, waiters: [] }; gates.set(provider, gate); }
  return gate;
}

/** Runs one request inside a provider's queue. Every call to a provider must
 *  go through here, or it silently eats the quota the others pace on. */
async function withProviderGate<T>(provider: AiProviderId, run: () => Promise<T>, coolDownOnRateLimit: boolean): Promise<T> {
  const gate = gateFor(provider);
  const coolingDown = () => new AiCallError(provider, `Limite de débit atteinte — nouvel essai possible dans ${Math.ceil((gate.coolUntil - Date.now()) / 1000)} s`, true, 429);
  if (Date.now() < gate.coolUntil) throw coolingDown();
  // 1) A start slot, in arrival order: at most MAX_IN_FLIGHT answers under
  //    way, and starts at least MIN_INTERVAL_MS apart.
  let release!: () => void;
  const turn = gate.tail;
  gate.tail = new Promise<void>((resolve) => { release = resolve; });
  await turn;
  try {
    while (gate.inFlight >= MAX_IN_FLIGHT) await new Promise<void>((resolve) => gate.waiters.push(resolve));
    // A call queued before the pause must not leave during it.
    if (Date.now() < gate.coolUntil) throw coolingDown();
    const wait = gate.lastStartAt + MIN_INTERVAL_MS[provider] - Date.now();
    if (wait > 0) await sleep(wait);
    gate.lastStartAt = Date.now();
    gate.inFlight++;
  } finally {
    release(); // the next caller may schedule its own start now
  }
  // 2) The request itself, alongside the others in flight.
  try {
    return await run();
  } catch (e) {
    if (coolDownOnRateLimit && e instanceof AiCallError && isRateLimited(e) && !isQuotaSpent(e)) gate.coolUntil = Date.now() + RATE_LIMIT_COOLDOWN_MS;
    throw e;
  } finally {
    gate.inFlight--;
    gate.waiters.shift()?.();
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

/** The configured model first, then the other free ones. */
async function callProvider(config: AiConfig, provider: AiProviderId, system: string, messages: AiChatMessage[]): Promise<string> {
  const configured = config.providers[provider].model.trim();
  // An old or forged config must never quietly reach a paid model.
  const model = isFreeModel(provider, configured) ? configured : defaultModel(provider);
  const keys = config.providers[provider].keys.map((k) => k.key.trim()).filter(Boolean);
  if (keys.length === 0) throw new AiCallError(provider, "Aucune clé configurée", false);
  return callGemini(keys, [model, ...GEMINI_RECOMMENDED_MODELS.map((m) => m.id).filter((id) => id !== model)], system, messages);
}

const gRotation = globalThis as typeof globalThis & { __movvizAiKeyTurn?: { next: number } };
const keyTurn = (gRotation.__movvizAiKeyTurn ??= { next: 0 });

/** The keys in this call's order: each call starts one key further than the
 *  previous one (demande explicite : message 1 sur la clé 1, message 2 sur la
 *  clé 2…, la 1re se repose pendant ce temps), the others follow as backup. */
export function keysInTurn(keys: string[]): string[] {
  if (keys.length < 2) return keys;
  const start = keyTurn.next++ % keys.length;
  return [...keys.slice(start), ...keys.slice(0, start)];
}

/** Every key of a model (in turn order), then the next model — at once, no pause:
 *  a busy, rate-limited or refused model hands over to the next free one
 *  (each has its own quota). A request Google rejects for what it IS (bad
 *  request, e.g. a malformed conversation) would fail on every model: it
 *  stops there instead of burning the other models' quota. */
/** Gemini usually answers in 1-3 s, but now and then one request hangs 10-15 s
 *  on Google's side (measured in prod: the same message took 10.3 s, then
 *  1.2 s four times in a row). Past this delay the same request also goes to
 *  the next key/model, and the first answer wins — the slow one is cancelled.
 *  Only a late request costs a second call; a normal one never does. */
export const GEMINI_HEDGE_MS = 4_000;
/** At most this many requests in flight for one message. */
const GEMINI_MAX_IN_FLIGHT = 2;

async function callGemini(keys: string[], models: string[], system: string, messages: AiChatMessage[]): Promise<string> {
  const ordered = keysInTurn(keys);
  const attempts = models.flatMap((model) => ordered.map((key) => ({ model, key })));
  return new Promise<string>((resolve, reject) => {
    let next = 0;
    let inFlight = 0;
    let settled = false;
    let lastError: AiCallError | null = null;
    let hedgeTimer: ReturnType<typeof setTimeout> | null = null;
    const controllers = new Set<AbortController>();
    const finish = (outcome: () => void) => {
      settled = true;
      if (hedgeTimer) clearTimeout(hedgeTimer);
      for (const controller of controllers) controller.abort();
      outcome();
    };
    const launch = () => {
      if (settled) return;
      if (next >= attempts.length) {
        if (inFlight === 0) finish(() => reject(lastError ?? new AiCallError("gemini", "Échec inconnu", false)));
        return;
      }
      const { model, key } = attempts[next++];
      const controller = new AbortController();
      controllers.add(controller);
      inFlight++;
      if (hedgeTimer) clearTimeout(hedgeTimer);
      hedgeTimer = setTimeout(() => { if (inFlight < GEMINI_MAX_IN_FLIGHT) launch(); }, GEMINI_HEDGE_MS);
      hedgeTimer.unref?.();
      generate("gemini", key, model, system, messages, controller.signal).then(
        (text) => {
          inFlight--;
          controllers.delete(controller);
          if (!settled) finish(() => resolve(text));
        },
        (e) => {
          inFlight--;
          controllers.delete(controller);
          if (settled) return;
          lastError = e instanceof AiCallError ? e : new AiCallError("gemini", (e as Error).message, false);
          // A request Google rejects for what it IS would fail everywhere.
          if (!isModelUnavailable(lastError) && !isGeminiModelBusy(lastError) && !isQuotaSpent(lastError) && lastError.status !== 403) {
            const error = lastError;
            finish(() => reject(error));
            return;
          }
          launch();
        },
      );
    };
    launch();
  });
}

/** Asks the AI; returns the text and the provider that answered. */
export async function callAi(config: AiConfig, system: string, conversation: AiChatMessage[]): Promise<{ text: string; provider: AiProviderId }> {
  // The model always answers the USER: trailing assistant turns are dropped
  // (Gemini 3 rejects a request ending with a model turn outright).
  const messages = trimTrailingAssistantTurns(conversation);
  const order = AI_PROVIDERS.filter((p) => config.providers[p].keys.some((k) => k.key.trim()));
  let lastError: AiCallError | null = null;
  for (const provider of order) {
    try {
      // Every key and model already tried: a 429 reaching the gate is persistent.
      const text = await withProviderGate(provider, () => callProvider(config, provider, system, messages), true);
      if (text) return { text, provider };
      lastError = new AiCallError(provider, "Réponse vide du modèle", false);
    } catch (e) {
      lastError = e instanceof AiCallError ? e : new AiCallError(provider, (e as Error).message, false);
    }
  }
  throw lastError ?? new AiCallError(config.primary, "Aucune clé IA configurée", false);
}

function trimTrailingAssistantTurns(messages: AiChatMessage[]): AiChatMessage[] {
  let end = messages.length;
  while (end > 1 && messages[end - 1].role === "assistant") end--;
  return end === messages.length ? messages : messages.slice(0, end);
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
