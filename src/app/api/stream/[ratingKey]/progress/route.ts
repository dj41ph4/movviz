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

  const cfg = loadPlexConfig();
  // A timeline update is a write to Plex's per-profile state.  It must use a
  // real server-scoped token; the former admin token + X-Plex-Profile header
  // could record another user's progress under the owner account.
  const auth = cfg.hostname ? await resolvePlexServerAuth(user, cfg) : null;
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
