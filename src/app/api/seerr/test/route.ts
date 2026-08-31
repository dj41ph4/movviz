import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadSeerrConfig } from "@/lib/seerr/store";
import { testSeerrConnection } from "@/lib/seerr/client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const result = await testSeerrConnection(loadSeerrConfig());
  return NextResponse.json(result);
}
