import { NextRequest, NextResponse } from "next/server";
import { providerRowsFor } from "@/lib/metadata/providerCatalog";

export const dynamic = "force-dynamic";

/** Rangées de la page « plateforme » (TV / mobile), dans l'ordre d'affichage.
 *  `provider` ajoute les rangées propres à une plateforme (Marvel, Pixar… sur
 *  Disney+). Sans paramètre (anciennes applis) : rangées communes seulement.
 *  Les rangées sans aucun titre sont masquées côté client après chargement. */
export async function GET(req: NextRequest) {
  const provider = Number(new URL(req.url).searchParams.get("provider"));
  return NextResponse.json({ rows: providerRowsFor(Number.isInteger(provider) && provider > 0 ? provider : null) });
}
