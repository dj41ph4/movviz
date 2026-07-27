import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getDevicePreferences, saveDevicePreferences } from "@/lib/setup/devicePreferences";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ devices: getDevicePreferences(user.id) });
}

export async function PUT(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json();
  const devices = saveDevicePreferences(user.id, body.devices);
  return NextResponse.json({ devices });
}
