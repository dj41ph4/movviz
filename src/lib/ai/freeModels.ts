import type { AiProviderId } from "./types";

export interface FreeModelOption {
  id: string;
  label: string;
}

/** Safe local recovery choices. They are never paid models. */
export const FREE_MODEL_FALLBACKS: Record<AiProviderId, readonly FreeModelOption[]> = {
  mistral: [{ id: "mistral-small-latest", label: "Mistral Small — quota du plan gratuit" }],
  openrouter: [{ id: "openrouter/free", label: "OpenRouter Free — sélection automatique" }],
  gemini: [
    // Google a fermé la gamme 2.5 aux nouveaux utilisateurs (erreur « no
    // longer available… use gemini-3.5-flash-lite »). Une config encore
    // réglée sur un modèle retiré retombe automatiquement sur le premier.
    // Flash-Lite first: ~500 free requests/day, against ~20/day for Flash
    // (a chat burns through 20 in one evening). Also the order in which
    // callProvider falls back when Google refuses the configured model.
    { id: "gemini-3.5-flash-lite", label: "Gemini 3.5 Flash Lite — ~500 requêtes/jour" },
    { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash Lite — ~500 requêtes/jour" },
    { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash — ~20 requêtes/jour" },
    { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash — ~20 requêtes/jour" },
  ],
  opencode: [
    { id: "big-pickle", label: "Big Pickle" },
    { id: "mimo-v2.5-free", label: "MiMo V2.5 Free" },
    { id: "ling-3.0-flash-fin-free", label: "Ling 3.0 Flash Fin Free" },
    { id: "nemotron-3-ultra-free", label: "Nemotron 3 Ultra Free" },
    { id: "nemotron-3.5-lightning-free", label: "Nemotron 3.5 Lightning Free" },
    { id: "muse-spark-1.3-contributor-free", label: "Muse Spark 1.3 Contributor Free" },
  ],
};

/** Google does not provide price/free-tier metadata in its Models API.  This
 * allow-list is the official Gemini Developer API free-tier text catalogue
 * (ai.google.dev/gemini-api/docs/pricing, "Free of charge" rows). Being on it
 * does not mean a given key can use the model — Google keeps retired ones
 * from new users — so the settings list is then filtered by a real call
 * (probeGeminiModel), and callProvider skips any model Google refuses. */
const GEMINI_EXTRA_FREE_MODELS: readonly FreeModelOption[] = [
  { id: "gemini-3.7-flash", label: "Gemini 3.7 Flash — ~20 requêtes/jour" },
  { id: "gemini-3.6-flash", label: "Gemini 3.6 Flash — ~20 requêtes/jour" },
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview" },
  // Still free, but only for accounts that used them before Google closed
  // the 2.5 range to new users — the real-call filter keeps them or not.
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite (anciens comptes)" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash (anciens comptes)" },
];
const GEMINI_LABELS = new Map([...FREE_MODEL_FALLBACKS.gemini, ...GEMINI_EXTRA_FREE_MODELS].map((model) => [model.id, model.label]));
const GEMINI_FREE_TEXT_IDS = new Set(GEMINI_LABELS.keys());
const GEMINI_ORDER = [...GEMINI_LABELS.keys()];

const toNumber = (value: unknown) => {
  const n = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : NaN;
};

function title(id: string): string {
  return id.split(/[/-]/).map((part) => /^v?\d/.test(part) ? part.toUpperCase() : part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

export function isOpenCodeFree(id: string): boolean {
  return FREE_MODEL_FALLBACKS.opencode.some((model) => model.id === id);
}

export async function loadFreeModels(provider: AiProviderId, key?: string): Promise<FreeModelOption[]> {
  try {
    if (provider === "opencode") {
      const response = await fetch("https://opencode.ai/zen/v1/models", { cache: "no-store", signal: AbortSignal.timeout(8_000) });
      const data = await response.json() as { data?: { id?: unknown }[] };
      if (!response.ok) throw new Error("Zen models unavailable");
      const models = (data.data ?? []).flatMap((model) => typeof model.id === "string" && isOpenCodeFree(model.id) ? [{ id: model.id, label: title(model.id) }] : []);
      if (models.length) return models.sort((a, b) => a.label.localeCompare(b.label));
    }

    if (provider === "openrouter") {
      const response = await fetch("https://openrouter.ai/api/v1/models?output_modalities=text", {
        headers: key ? { authorization: `Bearer ${key}` } : undefined,
        cache: "no-store",
        signal: AbortSignal.timeout(8_000),
      });
      const data = await response.json() as { data?: { id?: unknown; name?: unknown; pricing?: Record<string, unknown> }[] };
      if (!response.ok) throw new Error("OpenRouter models unavailable");
      const models = (data.data ?? []).flatMap((model) => {
        if (typeof model.id !== "string" || !model.pricing) return [];
        const prices = Object.values(model.pricing).map(toNumber).filter(Number.isFinite);
        return prices.length && prices.every((price) => price === 0)
          ? [{ id: model.id, label: typeof model.name === "string" ? model.name : title(model.id) }]
          : [];
      });
      if (models.length) return [{ id: "openrouter/free", label: "OpenRouter Free — sélection automatique" }, ...models.sort((a, b) => a.label.localeCompare(b.label))];
    }

    if (provider === "gemini" && key) {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(key)}`, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
      const data = await response.json() as { models?: { name?: unknown; displayName?: unknown; supportedGenerationMethods?: unknown }[] };
      if (!response.ok) throw new Error("Gemini models unavailable");
      const models = (data.models ?? []).flatMap((model) => {
        const id = typeof model.name === "string" ? model.name.replace(/^models\//, "") : "";
        const methods = Array.isArray(model.supportedGenerationMethods) ? model.supportedGenerationMethods : [];
        return id && GEMINI_FREE_TEXT_IDS.has(id) && methods.includes("generateContent")
          ? [{ id, label: GEMINI_LABELS.get(id) ?? (typeof model.displayName === "string" ? model.displayName : title(id)) }]
          : [];
      });
      if (models.length) return models.sort((a, b) => GEMINI_ORDER.indexOf(a.id) - GEMINI_ORDER.indexOf(b.id));
    }
  } catch {
    // Falling back below is deliberate: an upstream catalogue failure may not
    // make settings unusable and must never widen into a paid model choice.
  }
  return [...FREE_MODEL_FALLBACKS[provider]];
}

export function isAllowedFreeModel(provider: AiProviderId, id: string): boolean {
  if (provider === "opencode") return isOpenCodeFree(id);
  if (provider === "openrouter") return id === "openrouter/free" || id.endsWith(":free");
  if (provider === "gemini") return GEMINI_FREE_TEXT_IDS.has(id);
  return id === "mistral-small-latest";
}
