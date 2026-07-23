import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireUser } from "@/lib/auth/guard";
import { isBetaPlayerEnabled, setBetaPlayerEnabled, getStreamCacheTtl, setStreamCacheTtl } from "@/lib/settings/betaPlayer";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireUser(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ enabled: isBetaPlayerEnabled(), streamCacheTtl: getStreamCacheTtl() });
}

export async function PUT(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  if (typeof body.enabled === "boolean") setBetaPlayerEnabled(body.enabled);
  if (typeof body.streamCacheTtl === "number") setStreamCacheTtl(body.streamCacheTtl);
  return NextResponse.json({ enabled: isBetaPlayerEnabled(), streamCacheTtl: getStreamCacheTtl() });
}
