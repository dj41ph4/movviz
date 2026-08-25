import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireUser } from "@/lib/auth/guard";
import {
  getInterfaceDataMode,
  setInterfaceDataMode,
  type InterfaceDataMode,
} from "@/lib/settings/interfaceDataMode";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!requireUser(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ mode: getInterfaceDataMode() });
}

export async function PUT(req: NextRequest) {
  if (!requireAdmin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as { mode?: unknown } | null;
  if (body?.mode !== "optimized" && body?.mode !== "compatibility") {
    return NextResponse.json({ error: "invalid_mode" }, { status: 400 });
  }
  setInterfaceDataMode(body.mode as InterfaceDataMode);
  return NextResponse.json({ mode: getInterfaceDataMode() });
}
