import type { AiChatMessage, AiConfig, AiProviderId } from "./types";
import { AI_PROVIDER_ORDER } from "./types";

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
const QUOTA_RE = /quota|rate limit|resource exhausted|insufficient_quota|429|too many requests|403|forbidden|invalid api key|api key not valid/i;

export class AiCallError extends Error {
  readonly provider: AiProviderId;
  readonly quota: boolean;
  constructor(provider: AiProviderId, message: string, quota: boolean) {
    super(message);
    this.name = "AiCallError";
    this.provider = provider;
    this.quota = quota;
  }
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
    if (res.status === 429 || res.status === 403 || (errorMessage && QUOTA_RE.test(errorMessage))) {
      throw new AiCallError(providerId, errorMessage ?? `HTTP ${res.status}`, true);
    }
    throw new AiCallError(providerId, errorMessage ?? `HTTP ${res.status} (${res.statusText})`, false);
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
  } else {
    const choices = (json as { choices?: { message?: { content?: string } }[] })?.choices ?? [];
    text = choices.map((c) => c.message?.content ?? "").join("");
  }
  return text.trim();
}

/** Tries every key of one provider in order; throws the last failure when all are exhausted. */
async function callProvider(config: AiConfig, providerId: AiProviderId, system: string, messages: AiChatMessage[]): Promise<string> {
  const provider = config.providers[providerId];
  const model = provider.model.trim() || (providerId === "mistral" ? "mistral-small-latest" : providerId === "openrouter" ? "deepseek/deepseek-chat" : "gemini-2.5-flash-lite");
  const keys = provider.keys.filter((k) => k.key.trim().length > 0);
  if (keys.length === 0) throw new AiCallError(providerId, "Aucune clé API configurée pour ce fournisseur", false);

  let lastError: AiCallError | null = null;
  for (const entry of keys) {
    const key = entry.key.trim();
    try {
      if (providerId === "gemini") {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`;
        return await callWithKey(providerId, url, { "content-type": "application/json" }, {
          systemInstruction: { parts: [{ text: system }] },
          contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
          generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
        });
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
        max_tokens: 1024,
      });
    } catch (e) {
      lastError = e instanceof AiCallError ? e : new AiCallError(providerId, (e as Error).message, false);
    }
  }
  throw lastError ?? new AiCallError(providerId, "Échec inconnu", false);
}

/**
 * Calls the configured chain: primary provider first, then the others in
 * order (Mistral → OpenRouter → Gemini) when fallback is enabled. Returns
 * the assistant text plus the provider that actually answered (so the UI
 * can surface which free-tier quota is being used).
 */
export async function callAi(config: AiConfig, system: string, messages: AiChatMessage[]): Promise<{ text: string; provider: AiProviderId }> {
  const order: AiProviderId[] = [config.primary, ...AI_PROVIDER_ORDER.filter((p) => p !== config.primary)];
  const chain = config.fallback ? order : [config.primary];

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