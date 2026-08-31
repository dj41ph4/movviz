import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { resyncAnimeSeasonsFromTvdb } from "@/lib/library/autoGrabSeries";

export const dynamic = "force-dynamic";
type Ctx = { params: Promise<{ id: string }> };

/**
 * Rebuilds an already-in-library series' season/episode structure from TVDB
 * when TVDB breaks it into more (and more accurate) seasons than TMDb did —
 * see resyncAnimeSeasonsFromTvdb for the remapping rules.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const { id } = await params;
  const result = await resyncAnimeSeasonsFromTvdb(id);
  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : 409;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result);
}
