import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { clearCache } from "@/lib/cache/registry";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ name: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { name } = await params;
  const ok = clearCache(decodeURIComponent(name));
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not found" }, { status: 404 });
}
