import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import fs from "node:fs";
import path from "node:path";
import { listDirs } from "@/lib/system";
import { VIDEO_EXT } from "@/lib/library/indexScan";

export const dynamic = "force-dynamic";

/**
 * Same folder listing as the Settings folder picker, plus the video files at
 * that level — used for manually pointing a broken library entry at its real
 * file when the on-disk name no longer matches anything the automatic
 * matching can guess (e.g. the file sits in a folder named for a different
 * title after a bad rename).
 */
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const target = req.nextUrl.searchParams.get("path") ?? "";
  const base = listDirs(target);
  if (base.isRoot || !base.path) return NextResponse.json({ ...base, files: [] });

  let files: { name: string; path: string }[] = [];
  try {
    files = fs
      .readdirSync(base.path, { withFileTypes: true })
      .filter((d) => d.isFile() && VIDEO_EXT.test(d.name))
      .map((d) => ({ name: d.name, path: path.join(base.path, d.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    files = [];
  }

  return NextResponse.json({ ...base, files });
}
