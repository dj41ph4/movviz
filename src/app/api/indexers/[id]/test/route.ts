import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { getIndexer, updateIndexer } from "@/lib/indexers/store";
import { testIndexer } from "@/lib/indexers/torznab";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const ix = getIndexer((await params).id);
  if (!ix) return NextResponse.json({ error: "not found" }, { status: 404 });
  const result = await testIndexer(ix);
  updateIndexer(ix.id, { lastTest: { ok: result.ok, at: Date.now(), detail: result.detail }, caps: result.caps });
  return NextResponse.json(result);
}
