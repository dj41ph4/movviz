import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { stopTask } from "@/lib/scheduler/engine";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Bouton « Arrêter » — retire la tâche de la file, ou demande son arrêt si
 *  elle tourne (arrêt coopératif, effectif au prochain point de cession). */
export async function POST(req: NextRequest, { params }: Ctx) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const result = stopTask((await params).id);
  return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json(result, { status: 404 });
}
