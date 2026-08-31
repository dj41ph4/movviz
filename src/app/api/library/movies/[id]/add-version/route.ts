import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { searchAlternateVersion, grabAlternateVersion, type VersionCandidate } from "@/lib/library/addVersionSearch";
import { getMovie } from "@/lib/library/store";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/** Read-only search — never grabs. See addVersionSearch.ts for the relaxed (no quality/size limit) filter chain. */
export async function GET(req: NextRequest, { params }: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const result = await searchAlternateVersion(id);
  return NextResponse.json(result);
}

/**
 * Grabs a candidate the user picked from the search above. `mode` is the
 * explicit replace-vs-add choice (LOT6.10) — the actual write only happens
 * later in `/api/library/import` once the engine finishes, but that
 * callback needs to already know which behavior to apply, so `mode` is
 * recorded here via `markPendingAdditionalVersion` (see addVersionSearch.ts).
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const movie = getMovie(id);
  if (!movie) return NextResponse.json({ error: "movie not found" }, { status: 404 });

  const body = await req.json();
  const candidate: VersionCandidate | undefined = body.candidate;
  if (!candidate?.release) return NextResponse.json({ error: "candidate required" }, { status: 400 });
  const mode = body.mode === "replace" ? "replace" : "add";

  const result = await grabAlternateVersion(id, candidate, mode);
  return NextResponse.json(result);
}
