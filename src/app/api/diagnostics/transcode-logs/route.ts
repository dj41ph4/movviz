import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { getTranscodeLogs, clearTranscodeLogs } from "@/lib/player/transcodeLogs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireAdmin(req);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ logs: getTranscodeLogs() });
}

export async function DELETE(req: NextRequest) {
  const user = requireAdmin(req);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  clearTranscodeLogs();
  return NextResponse.json({ ok: true });
}
