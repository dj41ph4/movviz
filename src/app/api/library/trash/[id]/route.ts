import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireUser } from "@/lib/auth/guard";
import { removeTrashItem } from "@/lib/library/trashStore";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = requireAdmin(req);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const [type, rawTmdb] = id.split("_");
  const tmdbId = Number(rawTmdb);
  if (!tmdbId || !type || !["movie", "series"].includes(type)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  removeTrashItem(tmdbId, type as "movie" | "series");
  return NextResponse.json({ ok: true });
}
