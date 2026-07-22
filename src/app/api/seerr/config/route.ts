import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadSeerrConfig, saveSeerrConfig } from "@/lib/seerr/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const cfg = loadSeerrConfig();
  return NextResponse.json({ baseUrl: cfg.baseUrl, configured: !!cfg.baseUrl && !!cfg.apiKey });
}

export async function PUT(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json();
  const cfg = loadSeerrConfig();
  saveSeerrConfig({
    baseUrl: String(body.baseUrl ?? cfg.baseUrl).trim(),
    apiKey: typeof body.apiKey === "string" && body.apiKey.length > 0 ? body.apiKey : cfg.apiKey,
  });
  return NextResponse.json({ ok: true });
}
