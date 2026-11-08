import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { cacheBreakdown, listCaches } from "@/lib/cache/registry";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const breakdown = req.nextUrl.searchParams.get("breakdown");
  if (breakdown) {
    const data = cacheBreakdown(breakdown);
    return data ? NextResponse.json(data) : NextResponse.json({ error: "unknown_cache" }, { status: 404 });
  }
  return NextResponse.json({ caches: listCaches() });
}
