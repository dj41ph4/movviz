import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadAiConfig, saveAiConfig } from "@/lib/ai/store";
import { AI_PROVIDER_ORDER, type AiConfig, type AiProviderId, type AiProviderKey } from "@/lib/ai/types";

export const dynamic = "force-dynamic";

function redactConfig(config: AiConfig) {
  return {
    enabled: config.enabled,
    primary: config.primary,
    fallback: config.fallback,
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

  const current = loadAiConfig();
  const incomingPrimary = String(body.primary ?? current.primary);
  const primary = (AI_PROVIDER_ORDER.includes(incomingPrimary as AiProviderId) ? incomingPrimary : current.primary) as AiProviderId;

  const providers = { ...current.providers } as AiConfig["providers"];
  for (const id of AI_PROVIDER_ORDER) {
    const inc = body.providers?.[id];
    if (!inc || typeof inc !== "object") continue;
    providers[id] = {
      model: typeof inc.model === "string" && inc.model.trim() ? inc.model.trim() : current.providers[id].model,
      keys: mergeKeys(current.providers[id].keys, Array.isArray(inc.keys) ? inc.keys : []),
    };
  }

  const next = saveAiConfig({
    enabled: typeof body.enabled === "boolean" ? body.enabled : current.enabled,
    primary,
    fallback: typeof body.fallback === "boolean" ? body.fallback : current.fallback,
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