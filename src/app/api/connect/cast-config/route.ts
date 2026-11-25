import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/**
 * Récepteur Google Cast à lancer. MOVVIZ_CAST_APP_ID = identifiant (8 caractères)
 * d'un « Styled Media Receiver » enregistré dans la console Google Cast avec la
 * feuille de style /cast/receiver.css : logo Movviz au lancement et en attente.
 *
 * Un récepteur NON publié ne marche que sur les appareils enregistrés dans la
 * console : chez un ami, le cast échouerait. Il n'est donc utilisé qu'une fois
 * publié (MOVVIZ_CAST_APP_PUBLISHED=1). Sinon : le lecteur par défaut de Google.
 */
export async function GET(req: NextRequest) {
  if (!requireUser(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const raw = (process.env.MOVVIZ_CAST_APP_ID ?? "").trim().toUpperCase();
  const published = process.env.MOVVIZ_CAST_APP_PUBLISHED === "1";
  return NextResponse.json({ appId: published && /^[0-9A-F]{8}$/.test(raw) ? raw : null }, { headers: { "cache-control": "no-store" } });
}
