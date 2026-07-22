import { NextResponse } from "next/server";
import { loadPlexConfig } from "@/lib/plex/store";
import { createPin, buildAuthUrl } from "@/lib/plex/client";

export const dynamic = "force-dynamic";

export async function POST() {
  const cfg = loadPlexConfig();
  const pin = await createPin(cfg.clientId);
  if (!pin) return NextResponse.json({ error: "plex_unreachable" }, { status: 502 });
  return NextResponse.json({ id: pin.id, authUrl: buildAuthUrl(cfg.clientId, pin.code) });
}
