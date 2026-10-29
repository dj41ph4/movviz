import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { enqueueJob, isJobCancelled, isSourceActive } from "@/lib/jobs/queue";
import { loadCorruptReport, scanCorruptFiles } from "@/lib/library/corruptFiles";

export const dynamic = "force-dynamic";

const SOURCE_ID = "corrupt-files-scan";

/** Résultat du dernier balayage (liste des fichiers vides ou incomplets). */
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(loadCorruptReport());
}

/** Lance le balayage dans la file de tâches, comme les autres actions longues. Lecture seule. */
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (isSourceActive(SOURCE_ID)) return NextResponse.json({ queued: true });
  enqueueJob(
    "mediaProbe",
    "Recherche des fichiers corrompus",
    1,
    async (setProgress, ctx) => {
      await scanCorruptFiles((current, total) => setProgress(current, total), {
        shouldCancel: () => isJobCancelled(ctx.jobId),
      });
    },
    SOURCE_ID,
    { heavy: true }
  );
  return NextResponse.json({ queued: true });
}
