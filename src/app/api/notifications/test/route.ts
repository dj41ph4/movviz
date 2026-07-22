import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { testTransport } from "@/lib/notifications/router";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (user?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const { kind } = await req.json();
  const ok = await testTransport(kind);
  return NextResponse.json({ ok });
}
