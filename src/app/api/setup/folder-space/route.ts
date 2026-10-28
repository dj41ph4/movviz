import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const input = req.nextUrl.searchParams.get("path")?.trim() ?? "";
  if (!input || !path.isAbsolute(input)) return NextResponse.json({ error: "invalid_path" }, { status: 400 });
  const target = path.resolve(input);
  let existing = target;
  for (;;) {
    try {
      const stat = await fs.stat(existing);
      if (!stat.isDirectory()) return NextResponse.json({ error: "not_a_directory" }, { status: 400 });
      const disk = await fs.statfs(existing);
      return NextResponse.json({ free: disk.bavail * disk.bsize, total: disk.blocks * disk.bsize, basedOnParent: existing !== target });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") return NextResponse.json({ error: "unavailable" }, { status: 400 });
      const parent = path.dirname(existing);
      // Do not claim the system disk is the future volume when the requested
      // mount itself is missing. On Windows a drive root is a real volume.
      if (parent === existing || (parent === path.parse(parent).root && process.platform !== "win32")) return NextResponse.json({ error: "unavailable" }, { status: 400 });
      existing = parent;
    }
  }
}
