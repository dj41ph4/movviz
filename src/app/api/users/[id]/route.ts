import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { getUserById, updateUser, deleteUser, loadUsers, destroySessionsForUser } from "@/lib/auth/store";
import { clearAiSession } from "@/lib/ai/store";
import { toPublicUser } from "@/lib/auth/types";
import { emitNotification } from "@/lib/notifications/store";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Admin-only: a single account's detail (for the /users/[id] page). */
export async function GET(req: NextRequest, { params }: Ctx) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const user = getUserById((await params).id);
  return user ? NextResponse.json(toPublicUser(user)) : NextResponse.json({ error: "not found" }, { status: 404 });
}

/** Admin-only: change a user's role or grant/revoke auto-approve. */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const allowed = [
    "role",
    "status",
    "autoApproveRequests",
    "autoRequestFromWatchlist",
    "discoverContinents",
    "requestLimitMovies",
    "requestLimitSeries",
    "canManageRequests",
  ] as const;
  const clean: Record<string, unknown> = {};
  for (const k of allowed) if (k in body) clean[k] = body[k];

  const { id } = await params;
  // Never demote the last admin — the system would have no administrator left.
  if (clean.role === "user") {
    const target = getUserById(id);
    if (target?.role === "admin") {
      const adminCount = loadUsers().filter((u) => u.role === "admin").length;
      if (adminCount <= 1) {
        return NextResponse.json({ error: "last_admin" }, { status: 400 });
      }
    }
  }
  // An admin can't demote themselves — avoids ever locking everyone out.
  if (id === admin.id && clean.role === "user") {
    return NextResponse.json({ error: "cannot_demote_self" }, { status: 400 });
  }

  const wasPending = getUserById(id)?.status === "pending";
  const updated = updateUser(id, clean);
  if (updated && wasPending && clean.status === "approved") {
    emitNotification("user_approved", `Compte ${updated.username} approuvé`, "/users", { username: updated.username });
  }
  return updated ? NextResponse.json(toPublicUser(updated)) : NextResponse.json({ error: "not found" }, { status: 404 });
}

/** Admin-only: delete an account — a still-pending registration (« Refuser »)
 *  or an existing one (« Supprimer ce compte » on its page). The account is
 *  signed out everywhere at once and its assistant conversation erased; its
 *  requests and history stay, as for any past activity on the server. */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const target = getUserById(id);
  if (!target) return NextResponse.json({ error: "not found" }, { status: 404 });
  // Same guards as demotion: never delete yourself, never the last admin.
  if (id === admin.id) return NextResponse.json({ error: "cannot_delete_self" }, { status: 400 });
  if (target.role === "admin" && loadUsers().filter((u) => u.role === "admin").length <= 1) {
    return NextResponse.json({ error: "last_admin" }, { status: 400 });
  }

  deleteUser(id);
  destroySessionsForUser(id);
  clearAiSession(id);
  return NextResponse.json({ ok: true });
}
