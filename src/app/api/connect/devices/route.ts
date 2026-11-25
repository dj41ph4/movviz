import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { listDevices, registerDevice, removeDevice } from "@/lib/connect/registry";
import { DEVICE_ID_RE, parseLeave, parseRegistration } from "@/lib/connect/types";
import { listNetworkDevices } from "@/lib/connect/network/manager";
import { isRequestOnServerNetwork } from "@/lib/connect/network/sameNetwork";

export const dynamic = "force-dynamic";

/** Appareils en ligne de l'utilisateur (celui qui demande inclus : l'interface le masque elle-même). */
export async function GET(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Apps Movviz d'abord, puis les écrans du réseau local (Chromecast, DLNA) trouvés par le serveur :
  // seulement si l'appareil est sur ce réseau (hors de chez soi, ce sont les écrans proches du
  // téléphone qui comptent) ; un écran qui lit déjà pour lui reste pilotable de partout.
  const [all, home] = await Promise.all([
    listNetworkDevices(user.id).catch(() => []),
    isRequestOnServerNetwork(req).catch(() => true),
  ]);
  const network = home ? all : all.filter((d) => d.state && d.state.status !== "idle");
  return NextResponse.json({ devices: [...listDevices(user.id), ...network] }, { headers: { "cache-control": "no-store" } });
}

/** Déclaration + battement de cœur (toutes les 20 s) d'un appareil Movviz. */
export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const leaving = parseLeave(body);
  if (leaving) {
    removeDevice(user.id, leaving);
    return NextResponse.json({ ok: true });
  }
  const registration = parseRegistration(body);
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
