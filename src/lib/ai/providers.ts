import type { AiChatMessage, AiConfig, AiProviderId } from "./types";
import { AI_PROVIDER_ORDER, DEFAULT_OPENCODE_ZEN_MODEL, isOpenCodeZenFreeModel } from "./types";
import { FREE_MODEL_FALLBACKS, isAllowedFreeModel } from "./freeModels";

/**
 * Multi-provider LLM client with two independent fallback layers:
 *  1. Per-provider key rotation — a provider holds a LIST of API keys; a
 *     quota/rate-limit/error on one key automatically retries with the next
 *     (the whole point of "several free-tier keys": once the free quota of
 *     the first is spent, the second takes over).
 *  2. Provider fallback — if the primary provider (Mistral by default) is
 *     exhausted, the next one in line (OpenRouter, then Gemini) is tried,
 *     when `fallback` is enabled in the AI settings.
 *
 * URLs are hardcoded constants — no user-supplied URL is ever fetched, so
 * there is no SSRF surface here (AGENTS.md).
 */

const TIMEOUT_MS = 45_000;
// Bug fix (confirmed live): a bulk add_media request (~100 titles pasted at
// once, e.g. straight from a Netflix history export) produced JSON the
// model tried to fill for every title — the old 1024-token ceiling cut the
// response off mid-object, and the repair-tolerant JSON parser can't
// recover an unterminated array. Every retry hit the exact same wall and
// fell through to the generic "j'ai eu un souci" apology, no matter how the
// user rephrased. Raised well past what the prompt's own 25-item cap
// (intentParser.ts) actually needs, so hitting this ceiling should now mean
// something is genuinely wrong rather than a routine long list.
const MAX_RESPONSE_TOKENS = 4096;
const QUOTA_RE = /quota|rate limit|resource exhausted|insufficient_quota|429|too many requests|403|forbidden|invalid api key|api key not valid/i;

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

/** A 429/rate-limit is usually transient (shared free-tier quota, burst) —
 *  worth ONE retry after a pause, unlike a 403/auth failure which will never
 *  succeed on retry. Kept deliberately narrow: anything else falls through
 *  to the next key/provider immediately, no added latency. */
function isRateLimited(err: AiCallError): boolean {
  if (err.status === 429) return true;
  return /rate limit|too many requests|resource exhausted/i.test(err.message);
}

/** Respects the provider's Retry-After (capped), else a short fixed pause. */
export function rateLimitDelayMs(err: AiCallError): number {
  const asked = typeof err.retryAfterSec === "number" && Number.isFinite(err.retryAfterSec) ? err.retryAfterSec : NaN;
  if (!Number.isNaN(asked)) return Math.min(Math.max(asked, 0), 30) * 1000;
  return 6000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface RawResponse {
  text: string;
}

async function jsonFetch(providerId: AiProviderId, url: string, headers: Record<string, string>, body: unknown, method = "POST"): Promise<unknown> {
  const res = await fetch(url, {
    method,
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  });
  const raw = await res.text();
  let json: unknown = null;
  try { json = raw ? JSON.parse(raw) : null; } catch { /* non-JSON error body */ }
  const errorMessage = (() => {
    if (typeof raw !== "string") return null;
    try {
      const j = JSON.parse(raw) as { error?: { message?: string } | string; message?: string };
      const m = typeof j.error === "string" ? j.error : j.error?.message ?? j.message;
      return typeof m === "string" ? m : null;
    } catch { return null; }
  })();
  if (!res.ok) {
    // Capture Retry-After for 429s (seconds, or HTTP date) so callers can
    // honor the pause the provider asked for instead of guessing.
    let retryAfterSec: number | undefined;
    if (res.status === 429) {
      const header = res.headers?.get("retry-after");
      if (header) {
        const secs = Number(header);
        retryAfterSec = Number.isFinite(secs) ? secs : Math.max(0, (Date.parse(header) - Date.now()) / 1000);
      }
    }
    if (res.status === 429 || res.status === 403 || (errorMessage && QUOTA_RE.test(errorMessage))) {
      throw new AiCallError(providerId, errorMessage ?? `HTTP ${res.status}`, true, res.status, retryAfterSec);
    }
    throw new AiCallError(providerId, errorMessage ?? `HTTP ${res.status} (${res.statusText})`, false, res.status);
  }
  return json ?? raw;
}

function toOpenAiMessages(messages: AiChatMessage[]): { role: "user" | "assistant"; content: string }[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

/** Calls a single provider with a single key; throws AiCallError on failure. */
async function callWithKey(providerId: AiProviderId, url: string, headers: Record<string, string>, body: unknown): Promise<string> {
  const json = await jsonFetch(providerId, url, headers, body);
  let text = "";
  if (providerId === "gemini") {
    const cands = (json as { candidates?: { content?: { parts?: { text?: string }[] } }[] })?.candidates ?? [];
    text = cands.map((c) => (c.content?.parts ?? []).map((p) => p.text ?? "").join("")).join("");
  } else if (providerId === "opencode" && url.endsWith("/responses")) {
    const response = json as { output_text?: string; output?: { content?: { type?: string; text?: string }[] }[] };
    text = response.output_text ?? (response.output ?? [])
      .flatMap((item) => item.content ?? [])
      .filter((part) => part.type === "output_text")
      .map((part) => part.text ?? "")
      .join("");
  } else {
    const choices = (json as { choices?: { message?: { content?: string } }[] })?.choices ?? [];
    text = choices.map((c) => c.message?.content ?? "").join("");
  }
  return text.trim();
}

/** Tries every key of one provider in order; throws the last failure when all are exhausted. */
async function callProvider(config: AiConfig, providerId: AiProviderId, system: string, messages: AiChatMessage[]): Promise<string> {
  const provider = config.providers[providerId];
  const configuredModel = provider.model.trim();
  // Configuration files predate the strict free-only selector. Enforce the
  // same restriction at the actual call boundary so an old file or forged
  // request cannot quietly spend credits.
  const model = providerId === "opencode"
    ? (isOpenCodeZenFreeModel(configuredModel) ? configuredModel : DEFAULT_OPENCODE_ZEN_MODEL)
    : (isAllowedFreeModel(providerId, configuredModel) ? configuredModel : FREE_MODEL_FALLBACKS[providerId][0].id);
  const keys = provider.keys.filter((k) => k.key.trim().length > 0);
  if (keys.length === 0) throw new AiCallError(providerId, "Aucune clé API configurée pour ce fournisseur", false);

  let lastError: AiCallError | null = null;
  for (const entry of keys) {
    const key = entry.key.trim();
    // One transparent retry on rate-limit: a first 429 on a shared free-tier
    // quota often clears within seconds — no reason to burn the next key or
    // fall over to the next provider for a transient signal. Anything else
    // (auth, model error, second 429) moves on immediately.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (providerId === "gemini") {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
          return await callWithKey(providerId, url, { "content-type": "application/json" }, {
            systemInstruction: { parts: [{ text: system }] },
            contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
            generationConfig: { temperature: 0.2, maxOutputTokens: MAX_RESPONSE_TOKENS },
          });
        }
        if (providerId === "opencode") {
          const responsesProtocol = model === "muse-spark-1.3-contributor-free";
          const url = `https://opencode.ai/zen/v1/${responsesProtocol ? "responses" : "chat/completions"}`;
          const headers = { "content-type": "application/json", authorization: `Bearer ${key}` };
          const body = responsesProtocol
            ? { model, instructions: system, input: toOpenAiMessages(messages), max_output_tokens: MAX_RESPONSE_TOKENS }
            : { model, messages: [{ role: "system", content: system }, ...toOpenAiMessages(messages)], temperature: 0.2, max_tokens: MAX_RESPONSE_TOKENS };
          return await callWithKey(providerId, url, headers, body);
        }
        const url = providerId === "mistral"
          ? "https://api.mistral.ai/v1/chat/completions"
          : "https://openrouter.ai/api/v1/chat/completions";
        const headers: Record<string, string> = {
          "content-type": "application/json",
          authorization: `Bearer ${key}`,
          ...(providerId === "openrouter" ? { "X-Title": "Movviz" } : {}),
        };
        return await callWithKey(providerId, url, headers, {
          model,
          messages: [{ role: "system", content: system }, ...toOpenAiMessages(messages)],
          temperature: 0.2,
          max_tokens: MAX_RESPONSE_TOKENS,
        });
      } catch (e) {
        lastError = e instanceof AiCallError ? e : new AiCallError(providerId, (e as Error).message, false);
        if (attempt === 0 && isRateLimited(lastError)) {
          await sleep(rateLimitDelayMs(lastError));
          continue;
        }
        break;
      }
    }
  }
  throw lastError ?? new AiCallError(providerId, "Échec inconnu", false);
}

/** Extracts the assistant text from a Mistral Conversations API response —
 *  a different shape than Chat Completions (`outputs[]` mixing tool-
 *  execution entries and message entries, not a `choices[]` array). Only
 *  `message.output` entries are ever assistant-facing text; `content` can
 *  be a plain string or an array of `{type,text}` parts depending on the
 *  connector, so both are handled. */
function extractConversationText(json: unknown): string {
  const outputs = (json as { outputs?: unknown[] })?.outputs ?? [];
  const parts: string[] = [];
  for (const raw of outputs) {
    const out = raw as { type?: string; content?: unknown };
    if (out.type !== "message.output") continue;
    if (typeof out.content === "string") {
      parts.push(out.content);
    } else if (Array.isArray(out.content)) {
      for (const piece of out.content) {
        const p = piece as { text?: string };
        if (typeof p.text === "string") parts.push(p.text);
      }
    }
  }
  return parts.join("\n").trim();
}

/**
 * Web-grounded scene lookup (demande explicite user) — Mistral's
 * `web_search` built-in connector, which ONLY exists on the Conversations
 * API (`/v1/conversations`), a different endpoint/shape from the plain
 * Chat Completions API every other call in this file uses. Deliberately
 * Mistral-only: OpenRouter/Gemini have no equivalent wired here, and this
 * function is never used as a fallback target — callers gate on
 * `config.webSearchEnabled` AND a configured Mistral key before calling.
 * Returns null on ANY failure (no key, quota, empty result) — the caller
 * (contextBuilder.ts's scene cache) degrades to simply not having a scene
 * to reference, never a broken chat reply.
 */
export async function searchWeb(config: AiConfig, prompt: string): Promise<string | null> {
  if (!config.webSearchEnabled) return null;
  const provider = config.providers.mistral;
  const model = provider.model.trim() || "mistral-small-latest";
  const keys = provider.keys.filter((k) => k.key.trim().length > 0);
  if (keys.length === 0) return null;

  for (const entry of keys) {
    try {
      const json = await jsonFetch("mistral", "https://api.mistral.ai/v1/conversations", {
        "content-type": "application/json",
        authorization: `Bearer ${entry.key.trim()}`,
      }, {
        model,
        inputs: [{ role: "user", content: prompt }],
        tools: [{ type: "web_search" }],
      });
      const text = extractConversationText(json);
      if (text) return text;
    } catch {
      // try the next key — same key-rotation spirit as callProvider above
    }
  }
  return null;
}

/** Compatibility name used by the scene cache. General factual searches
 *  now share the exact same authenticated Mistral web connector. */
export async function searchTitleScene(config: AiConfig, prompt: string): Promise<string | null> {
  return searchWeb(config, prompt);
}

export interface AiCandidateResult {
  text: string;
  provider: AiProviderId;
}

/** Two independent Mistral opinions, one visible result. The second key is
 *  an optional quality lane, never a requirement: 0/1 key, a quota error or
 *  a network failure transparently falls back to the normal provider chain. */
export async function callAiCandidates(config: AiConfig, system: string, messages: AiChatMessage[]): Promise<AiCandidateResult[]> {
  const provider = config.providers.mistral;
  const keys = provider.keys.filter((entry) => entry.key.trim()).slice(0, 2);
  if (config.primary !== "mistral" || keys.length < 2) return [await callAi(config, system, messages)];

  const model = provider.model.trim() || "mistral-small-latest";
  const body = {
    model,
    messages: [{ role: "system", content: system }, ...toOpenAiMessages(messages)],
    temperature: 0.35,
    max_tokens: MAX_RESPONSE_TOKENS,
  };
  const settled = await Promise.allSettled(keys.map((entry) => callWithKey(
    "mistral",
    "https://api.mistral.ai/v1/chat/completions",
    { "content-type": "application/json", authorization: `Bearer ${entry.key.trim()}` },
    body,
  )));
  const candidates = settled
    .filter((result): result is PromiseFulfilledResult<string> => result.status === "fulfilled" && !!result.value.trim())
    .map((result) => ({ text: result.value, provider: "mistral" as const }));
  return candidates.length ? candidates : [await callAi(config, system, messages)];
}

/**
 * Calls the configured chain: primary provider first, then the others in
 * in the administrator's configured priority order when fallback is enabled. Returns
 * the assistant text plus the provider that actually answered (so the UI
 * can surface which free-tier quota is being used).
 */
export async function callAi(config: AiConfig, system: string, messages: AiChatMessage[]): Promise<{ text: string; provider: AiProviderId }> {
  const configured = Array.isArray(config.priority) && config.priority.length ? config.priority : [config.primary];
  const order = [...configured, ...AI_PROVIDER_ORDER]
    .filter((provider, index, all): provider is AiProviderId => AI_PROVIDER_ORDER.includes(provider) && all.indexOf(provider) === index);
  const chain = config.fallback ? order : [order[0]];

  let lastError: AiCallError | null = null;
  for (const providerId of chain) {
    try {
      const text = await callProvider(config, providerId, system, messages);
      if (text) return { text, provider: providerId };
      lastError = new AiCallError(providerId, "Réponse vide du modèle", false);
    } catch (e) {
      lastError = e instanceof AiCallError ? e : new AiCallError(providerId, (e as Error).message, false);
    }
  }
  throw lastError ?? new AiCallError(config.primary, "Aucun fournisseur disponible", false);
}
