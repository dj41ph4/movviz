import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadPlexConfig } from "@/lib/plex/store";
import { testPlexServer } from "@/lib/plex/client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const ok = await testPlexServer(loadPlexConfig());
  return NextResponse.json({ ok });
}
