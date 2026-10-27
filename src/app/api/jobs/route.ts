import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getJobs, getJobHolds } from "@/lib/jobs/queue";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireUser(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // `holds` : pourquoi chaque job en file attend (activité d'un utilisateur, lecture, tâche
  // lourde en cours…), affiché dans la file d'attente à côté du bouton « Forcer ».
  return NextResponse.json({ jobs: getJobs(), holds: getJobHolds() });
}
