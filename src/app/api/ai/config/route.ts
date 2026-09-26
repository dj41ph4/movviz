import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { jsonCacheReadFailed } from "@/lib/fsJsonCache";
import { AI_CONFIG_FILE, loadAiConfig, saveAiConfig } from "@/lib/ai/store";
import { AI_PROVIDERS, type AiConfig, type AiProviderId, type AiProviderKey } from "@/lib/ai/types";
import { defaultModel, isFreeModel } from "@/lib/ai/freeModels";

export const dynamic = "force-dynamic";

function redactConfig(config: AiConfig) {
  return {
    enabled: config.enabled,
    primary: config.primary,
    webSearchEnabled: config.webSearchEnabled,
    voiceInputEnabled: config.voiceInputEnabled,
    voiceOutputEnabled: config.voiceOutputEnabled,
    promptVariant: config.promptVariant === "compact" ? "compact" : "full",
    // Like provider keys: only whether one is stored, never the key itself.
    hasWebSearchKey: !!config.webSearchKey,
    providers: Object.fromEntries(
      AI_PROVIDERS.map((id) => [
        id,
        {
          model: config.providers[id].model,
          keys: config.providers[id].keys.map((k) => ({ id: k.id, hasKey: !!k.key })),
        },
      ])
    ),
  };
}

/** API keys never leave the server — the settings UI only sees hasKey
 *  flags; a blank key on save means "keep the stored one". Same policy as
 *  the indexer store's redact(). */
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(redactConfig(loadAiConfig()));
}

export async function PUT(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  // Garde anti-écrasement : si la lecture de ai.json a échoué (transitoire),
  // loadAiConfig() retourne DEFAULT_AI_CONFIG (clés vides) — sauvegarder
  // effacerait les clés API stockées. On refuse plutôt que de détruire.
  if (jsonCacheReadFailed(AI_CONFIG_FILE)) {
    return NextResponse.json({ error: "config temporarily unreadable — save refused, API keys preserved" }, { status: 503 });
  }
  const current = loadAiConfig();
  const primary: AiProviderId = AI_PROVIDERS.includes(body.primary) ? body.primary : current.primary;

  const providers = { ...current.providers };
  for (const id of AI_PROVIDERS) {
    const inc = body.providers?.[id];
    if (!inc || typeof inc !== "object") continue;
    const requestedModel = typeof inc.model === "string" ? inc.model.trim() : "";
    const currentModel = current.providers[id].model;
    // Free models only — never let a request pick a paid one.
    const model = isFreeModel(id, requestedModel) ? requestedModel : isFreeModel(id, currentModel) ? currentModel : defaultModel(id);
    providers[id] = {
      model,
      keys: mergeKeys(current.providers[id].keys, Array.isArray(inc.keys) ? inc.keys : []),
    };
  }

  const next = saveAiConfig({
    enabled: typeof body.enabled === "boolean" ? body.enabled : current.enabled,
    primary,
    providers,
    webSearchEnabled: typeof body.webSearchEnabled === "boolean" ? body.webSearchEnabled : current.webSearchEnabled,
    voiceInputEnabled: typeof body.voiceInputEnabled === "boolean" ? body.voiceInputEnabled : current.voiceInputEnabled,
    voiceOutputEnabled: typeof body.voiceOutputEnabled === "boolean" ? body.voiceOutputEnabled : current.voiceOutputEnabled,
    promptVariant: body.promptVariant === "compact" || body.promptVariant === "full" ? body.promptVariant : current.promptVariant ?? "full",
    // A new key replaces the stored one; an empty field keeps it; « Supprimer » clears it.
    webSearchKey: typeof body.webSearchKey === "string" && body.webSearchKey.trim()
      ? body.webSearchKey.trim()
      : body.clearWebSearchKey === true ? undefined : current.webSearchKey,
  });
  return NextResponse.json(redactConfig(next));
}

function mergeKeys(current: AiProviderKey[], incoming: { id?: string; key?: string }[]): AiProviderKey[] {
  const result: AiProviderKey[] = [];
  for (const inc of incoming) {
    const key = String(inc.key ?? "").trim();
    if (key) {
      const existing = inc.id ? current.find((k) => k.id === inc.id) : undefined;
      result.push({ id: existing?.id ?? `k_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, key });
    } else if (inc.id) {
      const existing = current.find((k) => k.id === inc.id);
      if (existing) result.push(existing);
    }
  }
  return result;
}
