import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";

export async function POST(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const dir = process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data");
  try { fs.unlinkSync(path.join(dir, "setup-pending")); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") return NextResponse.json({ error: "cannot_finish_setup" }, { status: 500 }); }
  return NextResponse.json({ ok: true });
}
