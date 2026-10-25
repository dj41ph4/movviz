import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { resolveWatchRegion } from "@/lib/metadata/tmdb";
import { providerRowDef, providerRowPage } from "@/lib/metadata/providerCatalog";

export const dynamic = "force-dynamic";

/** Une page d'une rangée de plateforme : films et séries mélangés (voir
 *  interleaveByShare). Sert aussi la grille « Voir tout » de la rangée. */
export async function GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const providerId = Number(sp.get("provider"));
  const key = sp.get("key") ?? "";
  const page = Math.max(1, Number(sp.get("page") ?? "1") || 1);
  if (!Number.isInteger(providerId) || providerId <= 0 || !providerRowDef(key)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }
  const region = resolveWatchRegion(requireUser(req)?.id ?? "");
  return NextResponse.json(await providerRowPage(providerId, key, page, region));
}
