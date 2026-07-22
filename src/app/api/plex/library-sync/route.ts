import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { syncPlexLibrary } from "@/lib/plex/librarySync";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const result = await syncPlexLibrary({ force: !!body.force });
  if (!result) return NextResponse.json({ error: "plex_not_configured" }, { status: 400 });
  return NextResponse.json(result);
}
