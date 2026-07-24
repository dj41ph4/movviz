import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadPlexConfig } from "@/lib/plex/store";
import { safePlexUrl } from "@/lib/plex/safeUrl";
import { unregisterSession } from "@/lib/player/transcodeSessions";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ ratingKey: string }> };

export async function POST(req: NextRequest, context: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { ratingKey } = await context.params;
  const sessionId = `movviz-${user.id}-${ratingKey}`;
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
          headers: {
            "X-Plex-Token": cfg.adminToken,
            "X-Plex-Client-Identifier": clientId,
            accept: "application/json",
          },
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