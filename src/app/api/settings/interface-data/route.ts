import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getInterfaceDataMode } from "@/lib/settings/interfaceDataMode";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireUser(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ mode: getInterfaceDataMode() });
}
