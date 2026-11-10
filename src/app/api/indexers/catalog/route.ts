import { NextRequest, NextResponse } from "next/server";
import { INDEXER_CATALOG } from "@/lib/indexers/catalog";
import { requireUser } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireUser(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ catalog: INDEXER_CATALOG });
}
