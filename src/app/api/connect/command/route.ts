import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getDevice, sendCommand } from "@/lib/connect/registry";
import { DEVICE_ID_RE, parseCommand } from "@/lib/connect/types";

export const dynamic = "force-dynamic";

/** Envoie un ordre (lire, pause, reprendre, aller à, arrêter) à un appareil de l'utilisateur. */
export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { targetId?: unknown; fromId?: unknown; command?: unknown } | null;
  const targetId = typeof body?.targetId === "string" ? body.targetId : "";
  if (!DEVICE_ID_RE.test(targetId)) return NextResponse.json({ error: "invalid_target" }, { status: 400 });
  const command = parseCommand(body?.command);
  if (!command) return NextResponse.json({ error: "invalid_command" }, { status: 400 });
  if (command.kind === "play") {
    const fromId = typeof body?.fromId === "string" && DEVICE_ID_RE.test(body.fromId) ? body.fromId : null;
    const from = fromId ? getDevice(user.id, fromId) : null;
    if (from) command.from = { id: from.id, name: from.name };
  }
  if (!getDevice(user.id, targetId)) return NextResponse.json({ error: "device_offline" }, { status: 404 });
  if (!sendCommand(user.id, targetId, command)) return NextResponse.json({ error: "not_a_receiver" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
