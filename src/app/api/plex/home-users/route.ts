import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadPlexConfig } from "@/lib/plex/store";
import { getPlexHomeUsers } from "@/lib/plex/client";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const cfg = loadPlexConfig();
  if (!cfg.adminToken) {
    return NextResponse.json({ users: [] });
  }
  const users = await getPlexHomeUsers(cfg.adminToken);
  return NextResponse.json({ users });
}
