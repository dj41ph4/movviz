import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { getIndexer, updateIndexer } from "@/lib/indexers/store";
import { testIndexer } from "@/lib/indexers/torznab";
import { testExtToIndexer } from "@/lib/indexers/exttoTest";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const ix = getIndexer((await params).id);
  if (!ix) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (ix.key === "extto") {
    const result = await testExtToIndexer(ix);
    updateIndexer(ix.id, { lastTest: { ok: result.ok, at: Date.now(), detail: result.detail } });
    return NextResponse.json(result);
  }
  const result = await testIndexer(ix);
  updateIndexer(ix.id, { lastTest: { ok: result.ok, at: Date.now(), detail: result.detail }, caps: result.caps });
  return NextResponse.json(result);
}
