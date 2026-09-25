import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { buildRewatchRow } from "@/lib/dashboard/rewatch";

export const dynamic = "force-dynamic";

/** Rangée « À revoir sans modération » de l'accueil desktop (voir rewatch.ts). */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ results: buildRewatchRow(user.id) });
}
