import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadDashboardLayout, saveDashboardLayout } from "@/lib/dashboard/store";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  return NextResponse.json({ userId: user.id, layout: loadDashboardLayout(user.id) });
}

export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const saved = saveDashboardLayout(user.id, body);
  return NextResponse.json({ userId: user.id, layout: saved });
}
