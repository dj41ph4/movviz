import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { systemInfo } from "@/lib/system";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireAdmin(req)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(systemInfo());
}
