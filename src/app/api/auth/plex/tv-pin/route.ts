import { NextResponse } from "next/server";
import { loadPlexConfig } from "@/lib/plex/store";
import { createTvPin, buildAuthUrl } from "@/lib/plex/client";

export const dynamic = "force-dynamic";

/** Dedicated short-code flow for Android TV / big-screen clients. */
export async function POST() {
  const cfg = loadPlexConfig();
  const pin = await createTvPin(cfg.clientId);
  if (!pin) return NextResponse.json({ error: "plex_unreachable" }, { status: 502 });
  return NextResponse.json({ id: pin.id, code: pin.code, authUrl: buildAuthUrl(cfg.clientId, pin.code) });
}
