import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadPlexConfig } from "@/lib/plex/store";
import { safePlexUrl } from "@/lib/plex/safeUrl";
import { resolvePlexServerAuth } from "@/lib/plex/watchWrite";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ ratingKey: string }> };

export async function POST(req: NextRequest, context: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { ratingKey } = await context.params;

  let offset = 0;
  let state: string = "playing";
  try {
    const body = await req.json();
    offset = Number(body?.offset) || 0;
    if (typeof body?.state === "string") state = body.state;
  } catch {
    /* malformed body - defaults apply */
  }

  // A stop at 0 is a player that lost (or never had) its stream, not a real
  // position: mirrored to Plex it erased the viewer's resume point there.
  if (offset <= 0 && state === "stopped") return NextResponse.json({ ok: true, skipped: true });

  // A timeline update is a best-effort Plex mirror. Never hold the player's
  // progress request while resolving a Plex identity or waiting on its HTTP.
  void (async () => {
    const cfg = loadPlexConfig();
    if (!cfg.hostname) return;
    // Use the user's real server-scoped token, never the owner token.
    const auth = await resolvePlexServerAuth(user, cfg);
    if (!auth) return;
    const base = safePlexUrl(`${cfg.useSsl ? "https" : "http"}://${cfg.hostname}:${cfg.port}`);
    if (!base) return;
    const params = new URLSearchParams({
      key: ratingKey,
      identifier: "com.plexapp.plugins.library",
      time: String(offset),
      state,
    });
    await fetch(`${base}/:/progress?${params}`, {
        method: "GET",
        headers: {
          "X-Plex-Token": auth.token,
          "X-Plex-Client-Identifier": `movviz-${user.id}`,
          accept: "application/json",
        },
        signal: AbortSignal.timeout(5000),
      });
  })().catch(() => { /* Plex is optional; local progress is already saved. */ });

  return NextResponse.json({ ok: true });
}
