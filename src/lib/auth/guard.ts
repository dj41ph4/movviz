import type { NextRequest } from "next/server";
import { getCurrentUser } from "./session";
import { getUserById } from "./store";
import { resolveTokenUserId } from "@/lib/tokens/store";
import type { User } from "./types";

/**
 * Session cookie first (browser), falling back to a personal API token
 * (external scripts). A "pending" account (self-registered, not yet
 * approved by an admin) resolves to null here — it has a valid session for
 * /api/auth/me to show the "waiting for approval" screen, but nothing else.
 */
export function requireUser(req: NextRequest): User | null {
  const sessionUser = getCurrentUser(req);
  if (sessionUser) return sessionUser.status === "pending" ? null : sessionUser;

  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const userId = resolveTokenUserId(token);
  const tokenUser = userId ? getUserById(userId) : null;
  return tokenUser && tokenUser.status !== "pending" ? tokenUser : null;
}

export function requireAdmin(req: NextRequest): User | null {
  const u = requireUser(req);
  return u && u.role === "admin" ? u : null;
}
