import { NextRequest, NextResponse } from "next/server";
import { getEngineToken } from "@/lib/engine/token";
import fsp from "node:fs/promises";
import { decodeLibraryRef } from "@/lib/library/types";
import { applyImportedFiles, type ImportedFile } from "@/lib/library/applyImportedFiles";

export const dynamic = "force-dynamic";

/**
 * Called by the download engine once a monitored title's files have been
 * renamed and moved into the library folder. This is the step that actually
 * makes a completed grab show up as "available" instead of vanishing into an
 * anonymous folder on disk.
 */

/**
 * Vérification post-import (mission 1f) : ne jamais marquer "available" un
 * fichier qui n'existe pas à destination. Le moteur réessaie le callback
 * (~15 s, voir AbstractBackend.tick) tant que la réponse n'est pas 2xx —
 * renvoyer une erreur ici laisse donc le retry idempotent se charger du cas
 * où le déplacement n'est pas encore visible (latence réseau/stockage),
 * tandis qu'un état "available" posé trop tôt resterait faux à vie.
 */
async function missingDestinationFiles(files: ImportedFile[]): Promise<string[]> {
  const missing: string[] = [];
  for (const f of files) {
    if (!f.path) continue;
    try {
      await fsp.access(f.path);
    } catch {
      missing.push(f.path);
    }
  }
  return missing;
}

export async function POST(req: NextRequest) {
  if (req.headers.get("x-movviz-token") !== getEngineToken()) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = await req.json();
  const ref = decodeLibraryRef(String(body.libraryRef ?? ""));
  const files: ImportedFile[] = Array.isArray(body.files) ? body.files : [];
  const infoHash: string | undefined = typeof body.infoHash === "string" ? body.infoHash : undefined;
  if (!ref) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }
  // An empty files array is a legitimate call, not a malformed one — the
  // engine now also notifies when a season/series pack downloaded fully but
  // matched none of its targeted episodes (release genuinely doesn't
  // contain them, e.g. a mismatched season-numbering scheme). applyImportedFiles
  // handles files=[] correctly: every episode still claiming this infoHash
  // gets released back to "missing" via releaseIfOrphaned instead of
  // staying stuck on "downloading" forever.

  // Post-import verification — refuse to mark anything available whose file
  // isn't actually at its reported destination. A non-2xx makes the engine
  // keep retrying the callback, so this heals itself when the files show up.
  const missing = await missingDestinationFiles(files);
  if (missing.length > 0) {
    const refId = "movieId" in ref ? ref.movieId : ref.seriesId;
    console.error(`[import] ${missing.length} fichier(s) introuvable(s) à destination — callback retenté par le moteur (${ref.kind}:${refId})`);
    return NextResponse.json({ error: "destination_missing", count: missing.length }, { status: 503 });
  }

  // Shared implementation — the recover-downloads fallback import goes
  // through the exact same code so both paths produce identical state.
  const result = await applyImportedFiles(ref, files, infoHash);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === "movie not found" || result.error === "series not found" ? 404 : 500 });
  }
  return NextResponse.json({ ...result });
}
