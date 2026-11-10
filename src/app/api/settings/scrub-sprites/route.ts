import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireUser } from "@/lib/auth/guard";
import { isScrubSpritesEnabled, setScrubSpritesEnabled } from "@/lib/settings/scrubSprites";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireUser(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ enabled: isScrubSpritesEnabled() });
}

export async function PUT(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  if (typeof body.enabled !== "boolean") return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  setScrubSpritesEnabled(body.enabled);
  return NextResponse.json({ enabled: isScrubSpritesEnabled() });
}
