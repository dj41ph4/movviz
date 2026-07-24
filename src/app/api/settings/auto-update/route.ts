import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { isAutoUpdateEnabled, setAutoUpdateEnabled } from "@/lib/settings/autoUpdate";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest) {
  const admin = requireAdmin(_req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ enabled: isAutoUpdateEnabled() });
}

export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { enabled } = await req.json();
  setAutoUpdateEnabled(!!enabled);
  return NextResponse.json({ enabled: isAutoUpdateEnabled() });
}