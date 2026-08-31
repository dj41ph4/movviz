import { NextResponse } from "next/server";
import { INDEXER_CATALOG } from "@/lib/indexers/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ catalog: INDEXER_CATALOG });
}
