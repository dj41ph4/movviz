import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireUser } from "@/lib/auth/guard";
import { plexConfigured } from "@/lib/plex/store";
import { effectiveMarkerSourceMode, getMarkerSourceMode, setMarkerSourceMode } from "@/lib/settings/markerSources";

export const dynamic = "force-dynamic";

function snapshot() {
  return { mode: getMarkerSourceMode(), effectiveMode: effectiveMarkerSourceMode(), plexLinked: plexConfigured() };
}

export async function GET(req: NextRequest) {
  if (!requireUser(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(snapshot());
}

export async function PUT(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body || (body.mode !== "all" && body.mode !== "plex-only" && body.mode !== "api-only")) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  setMarkerSourceMode(body.mode);
  return NextResponse.json(snapshot());
}
