import type { NextRequest } from "next/server";
import { resolveTokenUserId } from "@/lib/tokens/store";
import { getUserById } from "@/lib/auth/store";
import type { User } from "@/lib/auth/types";

/**
 * Authentification de l'extension navigateur : jeton personnel uniquement
 * (en-tête Bearer), jamais de cookie de session. Les routes /api/extension
 * sont publiques côté proxy parce que l'extension n'a pas de cookie ; ce
 * garde est donc la seule barrière.
 */
export function requireExtensionUser(req: NextRequest): User | null {
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : null;
  const userId = resolveTokenUserId(token);
  const user = userId ? getUserById(userId) : null;
  if (!user || user.status === "pending") return null;
  return user;
}
