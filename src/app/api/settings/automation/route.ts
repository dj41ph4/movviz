import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { isAutoSearchMissingEnabled, setAutoSearchMissingEnabled } from "@/lib/settings/automation";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ autoSearchMissingEnabled: isAutoSearchMissingEnabled() });
}

export async function PATCH(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (typeof body?.autoSearchMissingEnabled !== "boolean") return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  const cfg = setAutoSearchMissingEnabled(body.autoSearchMissingEnabled);
  return NextResponse.json(cfg);
}
