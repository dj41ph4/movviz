import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import { getMovie, updateMovie, removeMovie } from "@/lib/library/store";
import { requireUser } from "@/lib/auth/guard";
import { logActivity } from "@/lib/activity/store";
import { emitNotification } from "@/lib/notifications/store";
import { trashMovieFile } from "@/lib/library/trashDelete";
import { addTrashEntry } from "@/lib/library/trashStore";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const movie = getMovie((await params).id);
  return movie ? NextResponse.json(movie) : NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const patch = await req.json();
  const allowed = ["monitored", "qualityProfileId", "tags"] as const;
  const clean: Record<string, unknown> = {};
  for (const k of allowed) if (k in patch) clean[k] = patch[k];
  const updated = updateMovie((await params).id, clean);
  return updated ? NextResponse.json(updated) : NextResponse.json({ error: "not found" }, { status: 404 });
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = (await params).id;
  const movie = getMovie(id);
  const deleteFiles = req.nextUrl.searchParams.get("deleteFiles") === "true";

  if (deleteFiles && movie?.file?.path) {
    // Trash (when configured) always wins over a permanent delete — moving
    // the file must succeed before the library record is removed, so a
    // failed move (permissions, disk full, …) surfaces as an error instead
    // of silently leaving the file behind while the app thinks it's gone.
    let trashedTo: string | null;
    try {
      trashedTo = await trashMovieFile(movie.file.path);
    } catch (err) {
      return NextResponse.json({ error: "trash_failed", detail: (err as Error).message }, { status: 500 });
    }
    if (trashedTo) {
      addTrashEntry({ id: movie.id, kind: "movie", title: movie.title, trashPath: trashedTo, deletedAt: Date.now() });
    } else {
      try { fs.unlinkSync(movie.file.path); } catch { /* already gone */ }
      const dir = movie.file.path.split(/[/\\]/).slice(0, -1).join("/");
      try { fs.rmdirSync(dir, { recursive: true }); } catch { /* ignore */ }
    }
  }
  removeMovie(id);
  if (movie) {
    logActivity("removed", user.username, movie.title, null);
    if (deleteFiles) emitNotification("library_item_deleted", `${movie.title} supprimé de la bibliothèque`, "/library", { title: movie.title });
  }
  return NextResponse.json({ removed: true, filesDeleted: deleteFiles });
}
