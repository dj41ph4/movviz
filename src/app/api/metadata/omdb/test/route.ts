import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadOmdbConfig } from "@/lib/metadata/omdbStore";
import { testOmdbKey } from "@/lib/metadata/omdb";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const cfg = loadOmdbConfig();
  if (!cfg.apiKey) return NextResponse.json({ ok: false, error: "no_key" });
  const ok = await testOmdbKey(cfg.apiKey);
  return NextResponse.json({ ok, error: ok ? undefined : "invalid_key" });
}
