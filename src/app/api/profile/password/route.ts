import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { updateUser } from "@/lib/auth/store";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json();
  const current = String(body.currentPassword ?? "");
  const next = String(body.newPassword ?? "");

  // Plex-only accounts have no password yet — setting one the first time skips the "current password" check.
  if (user.passwordHash && !verifyPassword(current, user.passwordHash)) {
    return NextResponse.json({ error: "wrong_password" }, { status: 400 });
  }
  if (next.length < 8) {
    return NextResponse.json({ error: "password_too_short" }, { status: 400 });
  }

  updateUser(user.id, { passwordHash: hashPassword(next) });
  return NextResponse.json({ ok: true });
}
