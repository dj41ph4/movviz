import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireAdmin } from "@/lib/auth/guard";
import { getCardTrailerZoomConfig, setCardTrailerZoomOffset } from "@/lib/settings/cardTrailerZoomConfig";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireUser(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(getCardTrailerZoomConfig());
}

export async function PATCH(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (typeof body?.offset !== "number") return NextResponse.json({ error: "bad_request" }, { status: 400 });
  const cfg = setCardTrailerZoomOffset(body.offset);
  return NextResponse.json(cfg);
}
