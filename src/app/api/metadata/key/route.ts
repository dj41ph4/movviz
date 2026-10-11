import { NextRequest, NextResponse } from "next/server";
import { loadTmdbKey, saveTmdbKey, clearTmdbKey } from "@/lib/metadata/store";
import { tmdbConfigured } from "@/lib/metadata/tmdb";
import { requireAdmin, requireUser } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireUser(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const configured = tmdbConfigured();
  const fromEnv = !!process.env.MOVVIZ_TMDB_API_KEY;
  const hasStoredKey = !!loadTmdbKey();
  // Neither an env override nor a custom key saved — the bundled default key is what's actually in use.
  const isDefault = !fromEnv && !hasStoredKey;
  console.log("[api/metadata/key] GET — configured=" + configured + " fromEnv=" + fromEnv + " hasStoredKey=" + hasStoredKey + " MOVVIZ_CONFIG_DIR=" + (process.env.MOVVIZ_CONFIG_DIR ?? "—"));
  return NextResponse.json({ configured, fromEnv, hasStoredKey, isDefault });
}

export async function PUT(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json();
  const key = String(body.apiKey ?? "").trim();
  if (!key) return NextResponse.json({ error: "apiKey required" }, { status: 400 });
  console.log("[api/metadata/key] PUT — saving key=***" + key.slice(-4));
  saveTmdbKey(key);
  return NextResponse.json({ ok: true });
}

/** Drops the custom key, reverting to the bundled default. */
export async function DELETE(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  clearTmdbKey();
  return NextResponse.json({ ok: true });
}
