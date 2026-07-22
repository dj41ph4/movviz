import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadUsers, getUserByUsername, addUser } from "@/lib/auth/store";
import { toPublicUser, type User } from "@/lib/auth/types";
import { hashPassword } from "@/lib/auth/password";

export const dynamic = "force-dynamic";

/** Admin-only: list every account, to manage roles and auto-approve. */
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ users: loadUsers().map(toPublicUser) });
}

/** Admin-only: create a local account directly — skips the pending-approval flow, the admin already vouches for it. */
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");

  if (username.length < 3) return NextResponse.json({ error: "username_too_short" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "password_too_short" }, { status: 400 });
  if (getUserByUsername(username)) return NextResponse.json({ error: "username_taken" }, { status: 409 });

  const user: User = {
    id: `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    username,
    passwordHash: hashPassword(password),
    role: "user",
    status: "approved",
    autoApproveRequests: false,
    autoRequestFromWatchlist: false,
      discoverContinents: [],
      requestLimitMovies: null,
      requestLimitSeries: null,
      canManageRequests: false,
      plexId: null,
      plexToken: null,
      plexManagedUserId: null,
      plexAvatar: null,
    createdAt: Date.now(),
  };
  addUser(user);
  return NextResponse.json(toPublicUser(user), { status: 201 });
}
