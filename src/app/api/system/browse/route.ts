import { NextRequest, NextResponse } from "next/server";
import { listDirs } from "@/lib/system";
import { requireAdmin } from "@/lib/auth/guard";

export const dynamic = "force-dynamic";

/** Filesystem browser backing Settings' folder picker — admin-only, same as the page it lives on. */
export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const target = req.nextUrl.searchParams.get("path") ?? "";
  return NextResponse.json(listDirs(target));
}
