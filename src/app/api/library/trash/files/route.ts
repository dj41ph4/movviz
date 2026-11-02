import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { purgeAllTrashFiles } from "@/lib/library/trashPurge";

export const dynamic = "force-dynamic";

/** Permanently deletes every file sitting in the configured trash folders (admin, irreversible). */
export async function DELETE(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(await purgeAllTrashFiles());
}
