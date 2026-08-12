import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadPlexConfig } from "@/lib/plex/store";
import { safePlexUrl } from "@/lib/plex/safeUrl";
import { unregisterSession } from "@/lib/player/transcodeSessions";
import { plexClientHeaders } from "@/lib/player/plexStream";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ ratingKey: string }> };

export async function POST(req: NextRequest, context: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { ratingKey } = await context.params;
  // Must match the sid-suffixed session id the player's current attempt is
  // actually using (see transcode/route.ts) — otherwise this stops nothing
  // and Plex keeps the real transcode job running until it times out itself.
  const rawSid = req.nextUrl.searchParams.get("sid");
  const sid = rawSid && /^[a-z0-9]{1,16}$/i.test(rawSid) ? rawSid : null;
  const sessionId = `movviz-${user.id}-${ratingKey}${sid ? `-${sid}` : ""}`;
  const clientId = `movviz-${user.id}`;

  unregisterSession(user.id, ratingKey);

  const cfg = loadPlexConfig();
  if (cfg.hostname && cfg.adminToken) {
    const base = safePlexUrl(`${cfg.useSsl ? "https" : "http"}://${cfg.hostname}:${cfg.port}`);
    if (!base) return NextResponse.json({ error: "invalid_plex_url" }, { status: 500 });
    try {
      await fetch(
        `${base}/video/:/transcode/universal/stop?session=${encodeURIComponent(sessionId)}`,
        {
          method: "GET",
          headers: plexClientHeaders(cfg.adminToken, clientId, sessionId),
          signal: AbortSignal.timeout(5000),
        }
      );
    } catch (e) {
      console.error("[stream stop] error", ratingKey, e);
      /* ignore — best-effort */
    }
  }

  return NextResponse.json({ ok: true });
}