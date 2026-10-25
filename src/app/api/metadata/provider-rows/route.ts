import { NextResponse } from "next/server";
import { PROVIDER_ROWS } from "@/lib/metadata/providerCatalog";

export const dynamic = "force-dynamic";

/** Rangées de la page « plateforme » (TV / mobile), dans l'ordre d'affichage.
 *  Les rangées sans aucun titre sur la plateforme sont masquées côté client
 *  après leur premier chargement. */
export async function GET() {
  return NextResponse.json({ rows: PROVIDER_ROWS.map(({ key, label }) => ({ key, label })) });
}
