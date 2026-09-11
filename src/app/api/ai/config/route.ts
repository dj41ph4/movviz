import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { jsonCacheReadFailed } from "@/lib/fsJsonCache";
import { AI_CONFIG_FILE, loadAiConfig, saveAiConfig } from "@/lib/ai/store";
import { AI_PROVIDER_ORDER, DEFAULT_OPENCODE_ZEN_MODEL, isOpenCodeZenFreeModel, type AiConfig, type AiProviderId, type AiProviderKey } from "@/lib/ai/types";

export const dynamic = "force-dynamic";

function redactConfig(config: AiConfig) {
  return {
    enabled: config.enabled,
    primary: config.primary,
    priority: config.priority,
    fallback: config.fallback,
    webSearchEnabled: config.webSearchEnabled,
    providers: Object.fromEntries(
      AI_PROVIDER_ORDER.map((id) => [
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
  const incomingPrimary = String(body.primary ?? current.primary);
  const requestedPriority = Array.isArray(body.priority) ? body.priority : current.priority;
  const priority = [...requestedPriority, ...AI_PROVIDER_ORDER]
    .filter((id, index, all): id is AiProviderId => typeof id === "string" && AI_PROVIDER_ORDER.includes(id as AiProviderId) && all.indexOf(id) === index);
  const primary = priority[0] ?? (AI_PROVIDER_ORDER.includes(incomingPrimary as AiProviderId) ? incomingPrimary : current.primary) as AiProviderId;

  const providers = { ...current.providers } as AiConfig["providers"];
  for (const id of AI_PROVIDER_ORDER) {
    const inc = body.providers?.[id];
    if (!inc || typeof inc !== "object") continue;
    const requestedModel = typeof inc.model === "string" ? inc.model.trim() : "";
    const model = id === "opencode"
      ? (isOpenCodeZenFreeModel(requestedModel) ? requestedModel : (isOpenCodeZenFreeModel(current.providers[id].model) ? current.providers[id].model : DEFAULT_OPENCODE_ZEN_MODEL))
      : (requestedModel || current.providers[id].model);
    providers[id] = {
      model,
      keys: mergeKeys(current.providers[id].keys, Array.isArray(inc.keys) ? inc.keys : []),
    };
  }

  const next = saveAiConfig({
    enabled: typeof body.enabled === "boolean" ? body.enabled : current.enabled,
    primary,
    priority,
    fallback: typeof body.fallback === "boolean" ? body.fallback : current.fallback,
    webSearchEnabled: typeof body.webSearchEnabled === "boolean" ? body.webSearchEnabled : current.webSearchEnabled,
    providers,
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
