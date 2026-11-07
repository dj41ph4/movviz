import { NextRequest, NextResponse } from "next/server";
import { providerRowsFor } from "@/lib/metadata/providerCatalog";
import { requireUser } from "@/lib/auth/guard";
import { loadDashboardLayout } from "@/lib/dashboard/store";
import { activeSeason } from "@/lib/seasonal/calendar";

export const dynamic = "force-dynamic";

/** Rangées de la page « plateforme » (TV / mobile), dans l'ordre d'affichage.
 *  `provider` ajoute les rangées propres à une plateforme (Marvel, Pixar… sur
 *  Disney+). Sans paramètre (anciennes applis) : rangées communes seulement.
 *  Les rangées sans aucun titre sont masquées côté client après chargement. */
export async function GET(req: NextRequest) {
  const provider = Number(new URL(req.url).searchParams.get("provider"));
  // Rangée d'événement du moment en tête (Halloween, Noël…), sauf si l'utilisateur l'a masquée.
  const user = requireUser(req);
  const layout = user ? loadDashboardLayout(user.id) : null;
  const dateParam = new URL(req.url).searchParams.get("date");
  const now = dateParam && /^d{4}-d{2}-d{2}$/.test(dateParam) ? new Date(`${dateParam}T12:00:00Z`) : new Date();
  const enabled = layout?.sections.find((s) => s.id === "seasonal")?.visible !== false;
  const season = enabled ? activeSeason(now, layout?.seasonDates) : null;
  return NextResponse.json({ rows: providerRowsFor(Number.isInteger(provider) && provider > 0 ? provider : null, season) });
}
