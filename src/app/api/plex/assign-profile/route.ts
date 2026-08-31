import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getUserById, loadUsers, updateUser } from "@/lib/auth/store";

export const dynamic = "force-dynamic";

export async function PUT(req: NextRequest) {
  const admin = requireUser(req);
  if (!admin || admin.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { userId, plexManagedUserId } = await req.json();
  if (typeof userId !== "string" || !userId) {
    return NextResponse.json({ error: "missing userId" }, { status: 400 });
  }
  const target = getUserById(userId);
  if (!target) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }
  const managedId = typeof plexManagedUserId === "string" && plexManagedUserId.trim() ? plexManagedUserId.trim() : null;
  if (managedId && target.plexToken) {
    return NextResponse.json({ error: "user_has_own_plex_account" }, { status: 409 });
  }
  if (managedId && loadUsers().some((u) => u.id !== target.id && u.plexManagedUserId === managedId)) {
    return NextResponse.json({ error: "plex_profile_already_assigned" }, { status: 409 });
  }
  // Any profile change invalidates the previous PMS credential.  It will be
  // safely re-issued through Plex Home's switch/resources flow on first use.
  const updated = updateUser(userId, { plexManagedUserId: managedId, plexServerToken: null });
  return NextResponse.json({ ok: true });
}
