import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getMovie, updateMovie } from "@/lib/library/store";
import { removeVersion, setPrimaryVersion } from "@/lib/library/versions";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string; versionId: string }> };

/** `{ action: "setPrimary" }` — LOT6.5 versions UI (compare/set primary/remove). */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, versionId } = await params;
  const movie = getMovie(id);
  if (!movie) return NextResponse.json({ error: "movie not found" }, { status: 404 });

  const body = await req.json();
  if (body.action !== "setPrimary") return NextResponse.json({ error: "unsupported action" }, { status: 400 });

  const updated = setPrimaryVersion(movie, versionId);
  const saved = updateMovie(id, { file: updated.file, versions: updated.versions });
  return NextResponse.json(saved);
}

/** Removes one version — refuses to remove the last remaining one (a movie with a file always keeps at least one). */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id, versionId } = await params;
  const movie = getMovie(id);
  if (!movie) return NextResponse.json({ error: "movie not found" }, { status: 404 });

  const ownedCount = movie.versions?.length ?? (movie.file ? 1 : 0);
  if (ownedCount <= 1) return NextResponse.json({ error: "cannot remove the only version" }, { status: 400 });

  const updated = removeVersion(movie, versionId);
  const saved = updateMovie(id, { file: updated.file, versions: updated.versions });
  return NextResponse.json(saved);
}
