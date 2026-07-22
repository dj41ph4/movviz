import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { removeWatchlistItem } from "@/lib/watchlist/store";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ type: string; id: string }> };

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { type, id } = await params;
  removeWatchlistItem(user.id, type, Number(id));
  return NextResponse.json({ removed: true });
}
