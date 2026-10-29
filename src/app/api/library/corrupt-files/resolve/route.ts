import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { enqueueJob, isJobCancelled, isSourceActive } from "@/lib/jobs/queue";
import { resolveCorruptFiles, type CorruptAction, type CorruptTarget } from "@/lib/library/corruptFilesResolve";
import { searchMissingFor } from "@/lib/library/searchMissing";

export const dynamic = "force-dynamic";

const SOURCE_ID = "corrupt-files-replace";
const MAX_TARGETS = 2000;

function parseTargets(raw: unknown): CorruptTarget[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_TARGETS) return null;
  const out: CorruptTarget[] = [];
  for (const t of raw) {
    if (!t || typeof t !== "object") return null;
    const o = t as Record<string, unknown>;
    if ((o.kind !== "movie" && o.kind !== "episode") || typeof o.id !== "string" || !o.id) return null;
    if (o.kind === "episode" && (!Number.isInteger(o.seasonNumber) || !Number.isInteger(o.episodeNumber))) return null;
    out.push({
      kind: o.kind,
      id: o.id,
      seasonNumber: o.kind === "episode" ? (o.seasonNumber as number) : undefined,
      episodeNumber: o.kind === "episode" ? (o.episodeNumber as number) : undefined,
    });
  }
  return out;
}

/**
 * Supprime les fichiers corrompus choisis ; « replace » les repasse en manquants
 * puis lance, dans la file de tâches, la recherche habituelle des manquants
 * (un titre à la fois) limitée à ces titres.
 */
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null) as { action?: unknown; items?: unknown } | null;
  const action = body?.action;
  const targets = parseTargets(body?.items);
  if ((action !== "delete" && action !== "replace") || !targets) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const result = await resolveCorruptFiles(targets, action as CorruptAction, admin.username);

  let searchQueued = false;
  if (action === "replace" && (result.movieIds.length > 0 || result.seriesIds.length > 0)) {
    const movieIds = result.movieIds;
    const seriesIds = result.seriesIds;
    if (!isSourceActive(SOURCE_ID)) {
      enqueueJob(
        "qualityUpgrade",
        "Remplacement des fichiers corrompus",
        1,
        async (setProgress, ctx) => {
          await searchMissingFor({ movieIds, seriesIds }, (current, total) => setProgress(current, total), {
            shouldCancel: () => isJobCancelled(ctx.jobId),
          });
        },
        SOURCE_ID,
        { heavy: true }
      );
      searchQueued = true;
    }
  }
  return NextResponse.json({ done: result.done.length, failed: result.failed, searchQueued });
}
