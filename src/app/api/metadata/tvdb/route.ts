import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadTvdbConfig, saveTvdbConfig } from "@/lib/metadata/tvdbStore";
import { tvdbConfigured } from "@/lib/metadata/tvdb";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const cfg = loadTvdbConfig();
  return NextResponse.json({ configured: tvdbConfigured(), hasStoredKey: !!cfg.apiKey, useForAnime: cfg.useForAnime, language: cfg.language });
}

export async function PUT(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json();
  const cfg = loadTvdbConfig();
  saveTvdbConfig({
    ...cfg,
    apiKey: "apiKey" in body ? String(body.apiKey || "").trim() || null : cfg.apiKey,
    useForAnime: "useForAnime" in body ? !!body.useForAnime : cfg.useForAnime,
  });
  return NextResponse.json({ ok: true });
}
