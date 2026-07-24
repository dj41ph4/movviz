import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/guard";
import { loadPlexConfig } from "@/lib/plex/store";
import { safePlexUrl } from "@/lib/plex/safeUrl";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const admin = requireAdmin(req);
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const cfg = loadPlexConfig();
  if (!cfg.hostname || !cfg.adminToken) return NextResponse.json({ sessions: [] });

  const scheme = cfg.useSsl ? "https" : "http";
  const plexUrl = safePlexUrl(`${scheme}://${cfg.hostname}:${cfg.port}`);
  if (!plexUrl) return NextResponse.json({ sessions: [] });

  let data: any;
  try {
    const res = await fetch(`${plexUrl}/status/sessions`, {
      headers: { "X-Plex-Token": cfg.adminToken, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    data = await res.json();
  } catch {
    return NextResponse.json({ sessions: [] });
  }

  const sessions = (data.MediaContainer?.Metadata ?? []).map((s: any) => ({
    title: s.title || s.grandparentTitle || "Inconnu",
    type: s.type,
    user: s.User?.title || "Inconnu",
    userThumb: s.User?.thumb || null,
    state: s.Player?.state || "paused",
    progress: s.viewOffset ? Math.round((s.viewOffset / s.duration) * 100) : 0,
    duration: s.duration || 0,
    bitrate: s.session?.bitrate || 0,
    bandwidth: s.session?.bandwidth || 0,
    device: s.Player?.title || "Inconnu",
    videoCodec: s.Media?.videoCodec || null,
    audioCodec: s.Media?.audioCodec || null,
    resolution: s.Media?.videoResolution || null,
  }));

  return NextResponse.json({ sessions });
}
