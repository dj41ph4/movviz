import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { buildLifehubExport } from "@/lib/lifehub/exportHistory";

export const dynamic = "force-dynamic";

/**
 * Movviz → LifeHub (demande explicite user). Per-user by construction:
 * requireUser accepts the session OR the user's own `Authorization: Bearer
 * mvz_…` key (profil → clés API), and only that user's watched history is
 * ever read. `?since=<ISO date>` limits the answer to titles changed since.
 * Contract: docs/LIFEHUB_API_CONTRAT.md.
 */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sinceParam = req.nextUrl.searchParams.get("since");
  let sinceMs: number | null = null;
  if (sinceParam) {
    sinceMs = Date.parse(sinceParam);
    if (!Number.isFinite(sinceMs)) return NextResponse.json({ error: "invalid_since" }, { status: 400 });
  }

  return NextResponse.json(await buildLifehubExport(user.id, sinceMs), {
    headers: { "cache-control": "no-store" },
  });
}
