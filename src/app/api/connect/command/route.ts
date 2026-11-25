import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getDevice, sendCommand } from "@/lib/connect/registry";
import { DEVICE_ID_RE, parseCommand } from "@/lib/connect/types";
import { isNetworkDevice, networkControl, networkPlay } from "@/lib/connect/network/manager";

/** Adresse du serveur telle que l'appareil qui demande la voit : l'écran réseau ira chercher la vidéo là. */
function publicBase(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || req.nextUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || req.headers.get("host") || req.nextUrl.host;
  return `${proto === "https" ? "https" : "http"}://${host}`;
}

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
  if (isNetworkDevice(targetId)) {
    if (command.kind === "play") {
      const result = await networkPlay(user.id, targetId, command, publicBase(req));
      return result.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: result.error }, { status: result.error === "device_offline" ? 404 : 409 });
    }
    return (await networkControl(user.id, targetId, command)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "device_refused" }, { status: 409 });
  }
  if (!getDevice(user.id, targetId)) return NextResponse.json({ error: "device_offline" }, { status: 404 });
  if (!sendCommand(user.id, targetId, command)) return NextResponse.json({ error: "not_a_receiver" }, { status: 409 });
  return NextResponse.json({ ok: true });
}
