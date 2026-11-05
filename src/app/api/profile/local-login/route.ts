import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getUserByUsername, updateUser } from "@/lib/auth/store";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { validateLocalCredentials } from "@/lib/auth/localCredentials";

export const dynamic = "force-dynamic";

/**
 * Pseudo local : permet à un compte (notamment un compte Plex sans mot de passe) de se connecter
 * avec un pseudo et un mot de passe, sans passer par Plex. Même utilisateur, mêmes données.
 * La connexion Plex, elle, retrouve le compte par son identifiant Plex : elle n'est pas touchée.
 */
export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const username = String(body.username ?? "").trim();
  const password = String(body.password ?? "");
  const currentPassword = String(body.currentPassword ?? "");

  const error = validateLocalCredentials({
    user,
    username,
    password,
    currentPassword,
    findByUsername: getUserByUsername,
    verifyPassword,
  });
  if (error) {
    return NextResponse.json({ error }, { status: error === "username_taken" ? 409 : error === "wrong_password" ? 403 : 400 });
  }

  updateUser(user.id, {
    username,
    ...(password ? { passwordHash: hashPassword(password) } : {}),
  });
  return NextResponse.json({ ok: true, username });
}
