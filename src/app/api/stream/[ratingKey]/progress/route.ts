import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { loadPlexConfig } from "@/lib/plex/store";

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
  if (cfg.hostname && cfg.adminToken) {
    const base = `${cfg.useSsl ? "https" : "http"}://${cfg.hostname}:${cfg.port}`;
    try {
      await fetch(
        `${base}/:/progress?key=${encodeURIComponent(ratingKey)}&offset=${offset}&state=${encodeURIComponent(state)}`,
        {
          method: "GET",
          headers: {
            "X-Plex-Token": cfg.adminToken,
            "X-Plex-Client-Identifier": `movviz-${user.id}`,
            accept: "application/json",
          },
          signal: AbortSignal.timeout(5000),
        }
      );
    } catch {
      /* ignore — best-effort */
    }
  }

  return NextResponse.json({ ok: true });
}