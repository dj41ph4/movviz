import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { listDevices, registerDevice, removeDevice } from "@/lib/connect/registry";
import { DEVICE_ID_RE, parseRegistration } from "@/lib/connect/types";

export const dynamic = "force-dynamic";

/** Appareils en ligne de l'utilisateur (celui qui demande inclus : l'interface le masque elle-même). */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ devices: listDevices(user.id) }, { headers: { "cache-control": "no-store" } });
}

/** Déclaration + battement de cœur (toutes les 20 s) d'un appareil Movviz. */
export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const registration = parseRegistration(await req.json().catch(() => null));
  if (!registration) return NextResponse.json({ error: "invalid_device" }, { status: 400 });
  registerDevice(user.id, registration);
  return NextResponse.json({ ok: true });
}

/** L'appareil se retire (fermeture de l'app) : il disparaît de la liste à l'instant. */
export async function DELETE(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id") ?? "";
  if (!DEVICE_ID_RE.test(id)) return NextResponse.json({ error: "invalid_device" }, { status: 400 });
  removeDevice(user.id, id);
  return NextResponse.json({ ok: true });
}
