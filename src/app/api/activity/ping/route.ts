import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { markUserActivity } from "@/lib/priority/userActivity";

export const dynamic = "force-dynamic";

/**
 * Ping d'activité utilisateur émis par le client (UserActivityPing) à chaque
 * clic/pointerdown réel. Pourquoi : le layout racine marque l'activité au
 * re-rendu serveur, mais l'App Router ne re-rend PAS les layouts à chaque
 * navigation client (ils sont servis depuis le cache routeur) — le clic de
 * navigation lui-même restait donc invisible de l'arrière-plan, qui ne
 * cédait pas la main pendant le chargement de la page. Un vrai POST HTTP
 * touche le processus serveur de façon déterministe (même globalThis que
 * les boucles de fond) : yieldToUser cède immédiatement, quel que soit le
 * chemin de navigation.
 */
export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  markUserActivity(user);
  return new NextResponse(null, { status: 204 });
}
