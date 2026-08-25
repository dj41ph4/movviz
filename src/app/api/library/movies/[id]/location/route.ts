import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { requireAdmin } from "@/lib/auth/guard";
import { getMovie, updateMovie } from "@/lib/library/store";
import { setPrimaryFile } from "@/lib/library/versions";
import { parseRelease } from "@/lib/naming/parser";
import { VIDEO_EXT } from "@/lib/library/indexScan";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/**
 * Manual "point this movie at its real file" fix — for when the automatic
 * add/import got the wrong file, or none at all. Admin-only (unlike the
 * generic monitored/qualityProfileId PATCH) since it touches what the
 * library considers the source of truth on disk. Goes through
 * setPrimaryFile() rather than a blind `{ file: {...} }` patch so a movie
 * with multiple versions doesn't desync — see versions.ts.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { path: newPath } = await req.json() as { path?: string };
  if (!newPath) return NextResponse.json({ error: "path required" }, { status: 400 });
  if (!VIDEO_EXT.test(newPath)) return NextResponse.json({ error: "not_a_video_file" }, { status: 400 });

  let stat: fs.Stats;
  try {
    stat = fs.statSync(newPath);
  } catch {
    return NextResponse.json({ error: "file_not_found" }, { status: 404 });
  }
  if (!stat.isFile()) return NextResponse.json({ error: "file_not_found" }, { status: 404 });

  const id = (await params).id;
  const movie = getMovie(id);
  if (!movie) return NextResponse.json({ error: "not found" }, { status: 404 });

  const parsed = parseRelease(path.basename(newPath));
  const file = {
    ...(movie.file ?? {}),
    path: newPath,
    quality: movie.file?.quality ?? parsed.resolution ?? "—",
    resolution: parsed.resolution ?? movie.file?.resolution ?? null,
    videoCodec: parsed.videoCodec ?? movie.file?.videoCodec ?? null,
    audioCodec: parsed.audioCodec ?? movie.file?.audioCodec ?? null,
    hdr: parsed.hdr ?? movie.file?.hdr ?? null,
    source: parsed.source ?? movie.file?.source ?? null,
    size: stat.size,
    addedAt: movie.file?.addedAt ?? Date.now(),
  };

  const versioned = setPrimaryFile(movie, file, { versionSource: "manual", reason: "Emplacement corrigé manuellement" });
  const updated = updateMovie(id, {
    file: versioned.file,
    versions: versioned.versions,
    status: "available",
    activeInfoHash: null,
  });
  return updated ? NextResponse.json(updated) : NextResponse.json({ error: "not found" }, { status: 404 });
}
