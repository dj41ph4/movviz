import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { updateUser } from "@/lib/auth/store";
import { loadPlexConfig, savePlexConfig } from "@/lib/plex/store";
import { checkPin, getPlexAccount } from "@/lib/plex/client";

export const dynamic = "force-dynamic";

/**
 * Polled by the "Connect Plex" button in Settings. Different from the login
 * flow (/api/auth/plex/poll): the admin is already authenticated here, so
 * this just records the server token and links their existing account —
 * no "already a friend of the server" gate, since the whole point is that
 * the server isn't connected yet.
 */
export async function POST(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await req.json();
  const pinId = Number(body.id);
  if (!pinId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const cfg = loadPlexConfig();
  const token = await checkPin(cfg.clientId, pinId);
  if (!token) return NextResponse.json({ done: false });

  const account = await getPlexAccount(cfg.clientId, token);
  if (!account) return NextResponse.json({ error: "plex_account_lookup_failed" }, { status: 502 });

  savePlexConfig({ ...cfg, adminToken: token });
  updateUser(admin.id, { plexId: account.id, plexToken: token, plexAvatar: account.thumb });

  return NextResponse.json({ done: true });
}
