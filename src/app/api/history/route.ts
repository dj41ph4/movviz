import { NextRequest, NextResponse } from "next/server";
import { loadActivityV2 } from "@/lib/activity/v2/store";
import type { ActivityEntry } from "@/lib/activity/v2/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as "movie" | "series" | null;
  const indexer = searchParams.get("indexer");
  const kind = searchParams.get("kind");
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 200);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

  let entries = loadActivityV2();

  if (type) entries = entries.filter((e) => e.media.type === type);
  if (indexer) entries = entries.filter((e) => e.release?.indexer === indexer);
  if (kind) {
    const kinds = kind.split(",");
    entries = entries.filter((e) => kinds.includes(e.kind));
  }

  const total = entries.length;
  const items = entries.slice(offset, offset + limit);

  return NextResponse.json({ items, total });
}
