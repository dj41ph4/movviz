import type { NextRequest } from "next/server";
import { getCurrentUser } from "./session";
import { getUserById } from "./store";
import { resolveTokenUserId } from "@/lib/tokens/store";
import type { User } from "./types";
import { isUserInteraction, markUserActivity } from "@/lib/priority/userActivity";

/**
 * Session cookie first (browser), falling back to a personal API token
 * (external scripts). A "pending" account (self-registered, not yet
 * approved by an admin) resolves to null here — it has a valid session for
 * /api/auth/me to show the "waiting for approval" screen, but nothing else.
 */
export function requireUser(req: NextRequest): User | null {
  // Point de marquage d'activité utilisateur : TOUTES les routes API
  // authentifiées passent par ce garde (les pages chargent ensuite des
  // fetchs /api/*). requireAdmin délègue à requireUser, donc un seul appel
  // couvre les deux. Marqué UNIQUEMENT pour une requête réellement
  // authentifiée (session ou token valide) — un robot qui martèle des
  // routes non authentifiées ne doit pas maintenir l'utilisateur « actif ».
  // Le callback d'import du moteur utilise x-movviz-token, pas ce garde —
  // aucun faux positif d'activité côté machine.
  // isUserInteraction() écarte les pollers frontend (statut moteur 500 ms,
  // /api/jobs 2 s, /api/perf 5 s…) : sans ce filtre, la simple ouverture
  // d'une page maintiendrait l'utilisateur « actif » en permanence et
  // l'arrière-plan ne reprendrait jamais.
  const sessionUser = getCurrentUser(req);
  if (sessionUser) {
    if (sessionUser.status === "pending") return null;
    if (isUserInteraction(req.nextUrl.pathname, req.method)) markUserActivity(sessionUser);
    return sessionUser;
  }

  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const userId = resolveTokenUserId(token);
  const tokenUser = userId ? getUserById(userId) : null;
  if (!tokenUser || tokenUser.status === "pending") return null;
  if (isUserInteraction(req.nextUrl.pathname, req.method)) markUserActivity(tokenUser);
  return tokenUser;
}

export function requireAdmin(req: NextRequest): User | null {
  const u = requireUser(req);
  return u && u.role === "admin" ? u : null;
}
