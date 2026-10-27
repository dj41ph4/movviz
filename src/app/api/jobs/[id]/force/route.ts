import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { forceStartJob } from "@/lib/jobs/queue";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/**
 * Lance tout de suite un job en file — POST /api/jobs/[id]/force.
 * Passe devant l'activité des utilisateurs et les lectures en cours ; refuse (409) quand une
 * autre tâche lourde tourne ou que la file est pleine, avec la raison dans `error`.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { id } = await params;
  const result = forceStartJob(id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.error === "not_queued" ? 404 : 409 });
  return NextResponse.json({ ok: true });
}
