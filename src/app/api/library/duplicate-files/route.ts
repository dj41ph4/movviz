import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { enqueueJob, isJobCancelled, isSourceActive } from "@/lib/jobs/queue";
import { engineLibraryRoots } from "@/lib/library/applyImportedFiles";
import { loadDuplicateReport, scanDuplicateFiles } from "@/lib/library/duplicateFiles";

export const dynamic = "force-dynamic";

const SOURCE_ID = "duplicate-files-scan";

/** Résultat du dernier balayage (fichiers « (2) », « (3)… » de la bibliothèque). */
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(loadDuplicateReport());
}

/** Lance le balayage dans la file de tâches. Lecture seule : rien n'est supprimé ici. */
export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (isSourceActive(SOURCE_ID)) return NextResponse.json({ queued: true });
  enqueueJob(
    "mediaProbe",
    "Recherche des doublons",
    1,
    async (setProgress, ctx) => {
      const roots = await engineLibraryRoots();
      await scanDuplicateFiles(roots, (current, total) => setProgress(current, total), {
        shouldCancel: () => isJobCancelled(ctx.jobId),
      });
    },
    SOURCE_ID,
    { heavy: true }
  );
  return NextResponse.json({ queued: true });
}
