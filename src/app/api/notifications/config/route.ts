import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadTransportConfig, saveTransportConfig } from "@/lib/notifications/config";
import type { NotificationTransportConfig } from "@/lib/notifications/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(loadTransportConfig());
}

export async function PUT(req: NextRequest) {
  const user = requireUser(req);
  if (user?.role !== "admin") return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json()) as Partial<NotificationTransportConfig>;
  const current = loadTransportConfig();
  const merged: NotificationTransportConfig = { ...current, ...body };
  saveTransportConfig(merged);
  return NextResponse.json(merged);
}
