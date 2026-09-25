import type { AiProviderId } from "./types";

export interface FreeModelOption {
  id: string;
  label: string;
}

/**
 * Gemini models with a free quota, recommended first. Flash-Lite leads:
 * ~500 free requests/day, against ~20/day for Flash (a chat burns through 20
 * in one evening). Also the order in which callProvider moves on when Google
 * refuses the configured model — Google closed the 2.5 range to new users
 * (« no longer available… use gemini-3.5-flash-lite »), so a config still
 * set to a retired model lands on the first one here.
 */
export const GEMINI_RECOMMENDED_MODELS: readonly FreeModelOption[] = [
  { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite — ~500 requêtes/jour" },
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite — ~500 requêtes/jour" },
  { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash — ~20 requêtes/jour" },
  { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash — ~20 requêtes/jour" },
];

/** The rest of Google's free-tier text catalogue (ai.google.dev/gemini-api/
 *  docs/pricing, « Free of charge » rows). Being listed does not mean a given
 *  key can use a model: the settings list is filtered by a real call
 *  (probeGeminiModel). */
const GEMINI_OTHER_FREE_MODELS: readonly FreeModelOption[] = [
  { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash — ~20 requêtes/jour" },
  { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash — ~20 requêtes/jour" },
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview" },
  // Still free, but only for accounts that used them before Google closed
  // the 2.5 range to new users — the real-call filter keeps them or not.
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (anciens comptes)" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (anciens comptes)" },
];

const GEMINI_LABELS = new Map([...GEMINI_RECOMMENDED_MODELS, ...GEMINI_OTHER_FREE_MODELS].map((model) => [model.id, model.label]));
const GEMINI_ORDER = [...GEMINI_LABELS.keys()];

/** Free Gemini models this key's account can see (Google's Models API ∩ the
 *  free catalogue), recommended first; the recommended list when Google
 *  cannot be reached — never a paid model. */
export async function loadGeminiModels(key?: string): Promise<FreeModelOption[]> {
  if (key) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
      const data = await response.json() as { models?: { name?: unknown; supportedGenerationMethods?: unknown }[] };
      if (response.ok) {
        const models = (data.models ?? []).flatMap((model) => {
          const id = typeof model.name === "string" ? model.name.replace(/^models\//, "") : "";
          const methods = Array.isArray(model.supportedGenerationMethods) ? model.supportedGenerationMethods : [];
          const label = GEMINI_LABELS.get(id);
          return label && methods.includes("generateContent") ? [{ id, label }] : [];
        });
        if (models.length) return models.sort((a, b) => GEMINI_ORDER.indexOf(a.id) - GEMINI_ORDER.indexOf(b.id));
      }
    } catch {
      // Recommended list below: a catalogue hiccup must not empty the settings.
    }
  }
  return [...GEMINI_RECOMMENDED_MODELS];
}

export function isFreeGeminiModel(id: string): boolean {
  return GEMINI_LABELS.has(id);
}

/** Free models the settings offer for a provider (Gemini: filtered by what
 *  this key's account can see). */
export async function loadFreeModels(_provider: AiProviderId, key?: string): Promise<FreeModelOption[]> {
  return loadGeminiModels(key);
}

/** Never lets an old or forged config reach a paid model. */
export function isFreeModel(_provider: AiProviderId, id: string): boolean {
  return isFreeGeminiModel(id);
}

/** The model used when the configured one is not an allowed free model. */
export function defaultModel(_provider: AiProviderId): string {
  return GEMINI_RECOMMENDED_MODELS[0].id;
}
