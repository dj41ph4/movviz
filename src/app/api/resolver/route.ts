import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadResolverConfig, saveResolverConfig } from "@/lib/resolver/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(loadResolverConfig());
}

export async function PATCH(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await req.json();
  if (body.url !== undefined && typeof body.url !== "string") {
    return NextResponse.json({ error: "url must be a string" }, { status: 400 });
  }
  const config = loadResolverConfig();
  if (body.url !== undefined) config.url = body.url;
  saveResolverConfig(config);
  return NextResponse.json(config);
}
