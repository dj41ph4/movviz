import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getMovie, updateMovie } from "@/lib/library/store";
import { grabUpgradeCandidate } from "@/lib/library/searchAndReplace";
import { markPendingVersionIntent } from "@/lib/library/pendingVersionIntent";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  const movie = getMovie(id);
  if (!movie) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!movie.file) return NextResponse.json({ error: "no_file_to_replace" }, { status: 400 });

  try {
    const result = await grabUpgradeCandidate(id);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 404 });

    // Mark this grab as an "optimize" — after import, delete the old file
    markPendingVersionIntent(result.infoHash, "optimize");

    return NextResponse.json({ ok: true, infoHash: result.infoHash });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
