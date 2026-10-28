import fs from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const paths = [body?.completedPath, body?.downloadPath];
  if (paths.some((p) => typeof p !== "string" || !path.isAbsolute(p) || path.resolve(p) === path.parse(path.resolve(p)).root)) return NextResponse.json({ error: "invalid_path" }, { status: 400 });
  try {
    for (const folder of paths as string[]) {
      await fs.mkdir(folder, { recursive: true });
      await fs.access(folder, constants.W_OK | constants.X_OK);
    }
  } catch {
    return NextResponse.json({ error: "folder_unavailable" }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
