import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { reportState } from "@/lib/connect/registry";
import { DEVICE_ID_RE, parseState } from "@/lib/connect/types";

export const dynamic = "force-dynamic";

/** Un appareil récepteur rapporte ce qu'il lit (ce que les autres appareils affichent en télécommande). */
export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { deviceId?: unknown; state?: unknown } | null;
  const deviceId = typeof body?.deviceId === "string" ? body.deviceId : "";
  const state = parseState(body?.state);
  if (!DEVICE_ID_RE.test(deviceId) || !state) return NextResponse.json({ error: "invalid_state" }, { status: 400 });
  if (!reportState(user.id, deviceId, state)) return NextResponse.json({ error: "unknown_device" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
