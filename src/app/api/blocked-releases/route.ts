import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireUser } from "@/lib/auth/guard";
import { blockRelease, loadBlockedReleases } from "@/lib/library/blockedReleases";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireUser(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ releases: loadBlockedReleases() });
}

export async function POST(req: NextRequest) {
  const user = requireAdmin(req);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json();
  const record = blockRelease({
    infoHash: typeof body.infoHash === "string" ? body.infoHash : "",
    releaseTitle: typeof body.releaseTitle === "string" ? body.releaseTitle : "",
    mediaTitle: typeof body.mediaTitle === "string" ? body.mediaTitle : "",
    indexer: typeof body.indexer === "string" ? body.indexer : "",
    blockedBy: user.username,
  });
  if (!record) return NextResponse.json({ error: "invalid_info_hash" }, { status: 400 });
  return NextResponse.json({ release: record }, { status: 201 });
}
