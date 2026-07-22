import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { getUserById, updateUser } from "@/lib/auth/store";
import { hashPassword } from "@/lib/auth/password";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Admin-only: set a new password for another local account (Plex-only accounts have nothing to reset). */
export async function POST(req: NextRequest, { params }: Ctx) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const target = getUserById(id);
  if (!target) return NextResponse.json({ error: "not found" }, { status: 404 });

  const body = await req.json();
  const next = String(body.newPassword ?? "");
  if (next.length < 8) {
    return NextResponse.json({ error: "password_too_short" }, { status: 400 });
  }

  updateUser(id, { passwordHash: hashPassword(next) });
  return NextResponse.json({ ok: true });
}
