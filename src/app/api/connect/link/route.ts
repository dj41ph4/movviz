import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { parseCommand } from "@/lib/connect/types";
import { createCastLink } from "@/lib/connect/castLink";
import { isRequestOnServerNetwork } from "@/lib/connect/network/sameNetwork";

export const dynamic = "force-dynamic";

/** Adresse publique du serveur, telle que l'appareil qui demande la voit. */
function publicBase(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || req.nextUrl.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || req.headers.get("host") || req.nextUrl.host;
  return `${proto === "https" ? "https" : "http"}://${host}`;
}

/**
 * Lien de lecture pour un écran que l'appareil a trouvé sur SON réseau (Google
 * Cast du navigateur ou du téléphone), où qu'il soit par rapport au serveur.
 */
export async function POST(req: NextRequest) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const command = parseCommand({ ...(body && typeof body === "object" ? body : {}), kind: "play" });
  if (!command || command.kind !== "play") return NextResponse.json({ error: "invalid_command" }, { status: 400 });
  const raw = (body as { model?: unknown } | null)?.model;
  const model = typeof raw === "string" ? raw.replace(/[^\w .+-]/g, "").slice(0, 80) : null;
  const rawVia = (body as { via?: unknown } | null)?.via;
  const via = rawVia === "dlna" || rawVia === "dlna-compat" ? rawVia : "cast";
  // L'écran est à côté de l'appareil : hors du réseau du serveur, le film passe par l'envoi de la box.
  const remote = !(await isRequestOnServerNetwork(req).catch(() => true));
  const result = await createCastLink(user.id, command, publicBase(req), model, via, remote);
  return result.ok ? NextResponse.json(result.link) : NextResponse.json({ error: result.error }, { status: 409 });
}
