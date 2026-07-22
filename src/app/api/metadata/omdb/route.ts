import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadOmdbConfig, saveOmdbConfig } from "@/lib/metadata/omdbStore";
import { omdbConfigured } from "@/lib/metadata/omdb";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const cfg = loadOmdbConfig();
  return NextResponse.json({ configured: omdbConfigured(), hasStoredKey: !!cfg.apiKey });
}

export async function PUT(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json();
  saveOmdbConfig({ apiKey: String(body.apiKey || "").trim() || null });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  saveOmdbConfig({ apiKey: null });
  return NextResponse.json({ ok: true });
}
