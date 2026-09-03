import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getUserWatchHistory } from "@/lib/userContext/history";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const url = new URL(req.url);
  const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit") ?? 50)));
  const cursor = url.searchParams.get("cursor");
  const before = cursor ? Number(cursor.split(":")[0]) : undefined;
  if (before != null && !Number.isFinite(before)) return NextResponse.json({ error: "invalid_cursor" }, { status: 400 });
  const items = getUserWatchHistory({ userId: user.id, limit: limit + 1, until: before == null ? undefined : before - 1 });
  const hasMore = items.length > limit;
  const page = items.slice(0, limit);
  const nextCursor = hasMore && page.length ? `${page[page.length - 1].watchedAt}:0` : null;
  return NextResponse.json({ items: page, nextCursor });
}
