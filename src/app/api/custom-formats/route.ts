import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadCustomFormats, addCustomFormat } from "@/lib/customFormats/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ formats: loadCustomFormats() });
}

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const name = String(body.name ?? "").trim();
  const terms = Array.isArray(body.terms) ? body.terms.map(String).filter(Boolean) : [];
  if (!name || terms.length === 0) {
    return NextResponse.json({ error: "name and at least one term required" }, { status: 400 });
  }

  const cf = addCustomFormat({
    id: `cf_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name,
    score: Number.isFinite(Number(body.score)) ? Number(body.score) : 0,
    terms,
    enabled: body.enabled ?? true,
  });

  return NextResponse.json(cf, { status: 201 });
}
