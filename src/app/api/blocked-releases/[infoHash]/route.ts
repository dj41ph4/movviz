import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { unblockRelease } from "@/lib/library/blockedReleases";

export const dynamic = "force-dynamic";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ infoHash: string }> }) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { infoHash } = await params;
  return NextResponse.json({ removed: unblockRelease(infoHash) });
}
