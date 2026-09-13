import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { AI_PROVIDER_ORDER } from "@/lib/ai/types";
import { loadAiConfig } from "@/lib/ai/store";
import { loadFreeModels } from "@/lib/ai/freeModels";

export const dynamic = "force-dynamic";

/** Returns only zero-cost / included-quota text choices, never provider keys. */
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const config = loadAiConfig();
  const entries = await Promise.all(AI_PROVIDER_ORDER.map(async (provider) => {
    const key = config.providers[provider].keys.find((entry) => entry.key.trim())?.key.trim();
    return [provider, await loadFreeModels(provider, key)] as const;
  }));
  return NextResponse.json({ providers: Object.fromEntries(entries) });
}
