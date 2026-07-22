import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { updateUser } from "@/lib/auth/store";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  const admin = requireUser(req);
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { userId, plexManagedUserId } = await req.json();
  if (!userId) {
    return NextResponse.json({ error: "missing userId" }, { status: 400 });
  }
  const updated = updateUser(userId, { plexManagedUserId: plexManagedUserId ?? null });
  if (!updated) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
