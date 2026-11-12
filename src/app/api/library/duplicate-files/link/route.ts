import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { engineLibraryRoots } from "@/lib/library/applyImportedFiles";
import { linkDuplicateFiles } from "@/lib/library/duplicateFiles";

export const dynamic = "force-dynamic";

const MAX_PATHS = 500;

/**
 * Rattache des fichiers « (n) » seuls (sans original, utilisés par personne) : ils
 * prennent le nom propre et sont liés au film ou à l'épisode correspondant sans fichier.
 */
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null) as { paths?: unknown } | null;
  const paths = body?.paths;
  if (!Array.isArray(paths) || paths.length === 0 || paths.length > MAX_PATHS || !paths.every((p) => typeof p === "string" && p)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const roots = await engineLibraryRoots();
  const result = await linkDuplicateFiles(paths as string[], roots, admin.username);
  return NextResponse.json({ done: result.done.length, failed: result.failed, freedBytes: result.freedBytes });
}
