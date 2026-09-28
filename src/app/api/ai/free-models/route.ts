import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { requireAdmin } from "@/lib/auth/guard";
import { AI_PROVIDERS } from "@/lib/ai/types";
import { loadAiConfig } from "@/lib/ai/store";
import { loadFreeModels, type FreeModelOption } from "@/lib/ai/freeModels";
import { probeGeminiModel } from "@/lib/ai/providers";

export const dynamic = "force-dynamic";

/** Returns only zero-cost / included-quota text choices, never provider keys. */
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const config = loadAiConfig();
  // ?all=1 : every model Google lets these keys call (generateContent), per
  // key number — to spot a free high-quota fallback. Ids only, never a key.
  if (req.nextUrl.searchParams.get("all") === "1") {
    const keys = config.providers.gemini.keys.map((k) => k.key.trim()).filter(Boolean);
    const perKey = await Promise.all(keys.map(async (key, i) => {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`, { cache: "no-store", signal: AbortSignal.timeout(8_000) });
        const data = await res.json() as { models?: { name?: string; supportedGenerationMethods?: string[] }[] };
        return [`clé${i + 1}`, (data.models ?? []).filter((m) => m.supportedGenerationMethods?.includes("generateContent")).map((m) => (m.name ?? "").replace(/^models\//, ""))] as const;
      } catch (error) {
        return [`clé${i + 1}`, [`erreur : ${(error as Error).message}`]] as const;
      }
    }));
    return NextResponse.json({ models: Object.fromEntries(perKey) });
  }
  const entries = await Promise.all(AI_PROVIDERS.map(async (provider) => {
    const key = config.providers[provider].keys.find((entry) => entry.key.trim())?.key.trim();
    const models = await loadFreeModels(provider, key);
    return [provider, provider === "gemini" && key ? await keepWorkingGeminiModels(key, models) : models] as const;
  }));
  return NextResponse.json({ providers: Object.fromEntries(entries) });
}

/** Only the Gemini models that really answer with THIS key. A model Google
 *  refuses (retired, no free quota for this account) is dropped; one that
 *  could not be checked right now (network, momentary rate limit) stays,
 *  labelled as such, rather than being hidden on a transient hiccup. */
async function keepWorkingGeminiModels(key: string, models: FreeModelOption[]): Promise<FreeModelOption[]> {
  const keyTag = createHash("sha256").update(key).digest("hex").slice(0, 16);
  const kept: FreeModelOption[] = [];
  for (const model of models) {
    const probe = await probeGeminiModel(key, model.id, keyTag);
    if (probe === "ok") kept.push(model);
    else if (probe === "unknown") kept.push({ ...model, label: `${model.label} — non vérifié` });
  }
  return kept;
}
