import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadPlexConfig } from "@/lib/plex/store";
import { safePlexUrl } from "@/lib/plex/safeUrl";
import { resolveToken } from "@/lib/plex/watchWrite";

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

  const cfg = loadPlexConfig();
  // Bug fix (confirmed live while scoping the Continue Watching row): this
  // call was missing `identifier=com.plexapp.plugins.library` — without it
  // Plex doesn't recognize the ping as a real library-item timeline update,
  // so playback through Movviz's own player never actually moved the item
  // in Plex's on-deck / partially-watched state despite the request itself
  // succeeding. Also always used the ADMIN token regardless of who was
  // actually playing — Plex attributes a progress update to whichever
  // account's token made the request (same principle as setPlexWatched),
  // so a non-admin user's playback was silently being recorded under the
  // admin's own watch history instead of their own.
  const auth = cfg.hostname ? resolveToken(user, cfg) : null;
  if (cfg.hostname && auth) {
    const base = safePlexUrl(`${cfg.useSsl ? "https" : "http"}://${cfg.hostname}:${cfg.port}`);
    if (!base) return NextResponse.json({ error: "invalid_plex_url" }, { status: 500 });
    const params = new URLSearchParams({
      key: ratingKey,
      identifier: "com.plexapp.plugins.library",
      time: String(offset),
      state,
    });
    try {
      await fetch(`${base}/:/progress?${params}`, {
        method: "GET",
        headers: {
          "X-Plex-Token": auth.token,
          "X-Plex-Client-Identifier": `movviz-${user.id}`,
          ...(auth.managedUserId ? { "X-Plex-Profile": auth.managedUserId } : {}),
          accept: "application/json",
        },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      /* ignore — best-effort */
    }
  }

  return NextResponse.json({ ok: true });
}