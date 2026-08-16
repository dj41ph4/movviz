import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadAiConfig } from "@/lib/ai/store";
import { callAi } from "@/lib/ai/providers";
import { AI_PROVIDER_ORDER, type AiConfig, type AiProviderId } from "@/lib/ai/types";

export const dynamic = "force-dynamic";

/** Real connectivity test from Settings → AI: calls the requested provider
 *  (default: the configured primary) with a tiny prompt and reports the
 *  latency + model actually used. Mirrors the indexer "test" button. */
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  const requested = String(body?.provider ?? "");
  const stored = loadAiConfig();

  const provider: AiProviderId = AI_PROVIDER_ORDER.includes(requested as AiProviderId)
    ? (requested as AiProviderId)
    : stored.primary;

  const testConfig: AiConfig = { ...stored, primary: provider, fallback: false };
  if (testConfig.providers[provider].keys.filter((k) => k.key.trim()).length === 0) {
    return NextResponse.json({ ok: false, detail: "no_keys" }, { status: 400 });
  }

  const t0 = Date.now();
  try {
    const { text, provider: used } = await callAi(testConfig, "Tu réponds exactement par le mot OK, rien d'autre.", [
      { role: "user", content: "Test de connexion" },
    ]);
    return NextResponse.json({ ok: true, provider: used, latency: Date.now() - t0, reply: text.slice(0, 200) });
  } catch (e) {
    const err = e as { message?: string; quota?: boolean };
    return NextResponse.json({ ok: false, provider, latency: Date.now() - t0, detail: err.quota ? "quota" : (err.message ?? "error") }, { status: 502 });
  }
}