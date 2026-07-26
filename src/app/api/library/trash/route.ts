import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireUser } from "@/lib/auth/guard";
import { loadTrash, clearTrash } from "@/lib/library/trashStore";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const items = loadTrash();
  return NextResponse.json({ items });
}

export async function DELETE(req: NextRequest) {
  const user = requireAdmin(req);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  clearTrash();
  return NextResponse.json({ ok: true });
}
