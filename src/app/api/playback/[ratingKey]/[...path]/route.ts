import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/guard";
import { getMseManifest } from "@/lib/playback/mse/source";
import { buildInitSegment, buildMediaSegment } from "@/lib/playback/mp4/segmenter";
import type { Mp4Manifest, Mp4Track } from "@/lib/playback/mp4/segmenter";
import { getStreamCacheTtl } from "@/lib/settings/betaPlayer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Ctx = { params: Promise<{ ratingKey: string; path: string[] }> };

function corsOrigin(req: NextRequest): string {
  const referer = req.headers.get("referer");
  if (referer) {
    try {
      const u = new URL(referer);
      return `${u.protocol}//${u.host}`;
    } catch {
      /* fallthrough */
    }
  }
  return req.headers.get("origin") || "null";
}

function findTrack(m: Mp4Manifest, id: string): Mp4Track | null {
  if (m.video && String(m.video.id) === id) return m.video;
  return m.audio.find((t) => String(t.id) === id) ?? null;
}

function serializeManifest(m: Mp4Manifest) {
  const track = (t: Mp4Track) => ({
    id: t.id,
    kind: t.kind,
    timescale: t.timescale,
    codec: t.codec,
    width: t.width ?? null,
    height: t.height ?? null,
    channels: t.channels ?? null,
    sampleRate: t.sampleRate ?? null,
    segments: m.segments[t.id],
  });
  return {
    durationSec: m.durationSec,
    video: track(m.video!),
    audio: m.audio.map(track),
  };
}

export async function GET(req: NextRequest, ctx: Ctx) {
  const user = requireUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { ratingKey, path } = await ctx.params;
  if (path.length === 0) return NextResponse.json({ error: "bad_path" }, { status: 404 });

  const src = await getMseManifest(ratingKey, user.id);
  if (!src) return NextResponse.json({ error: "mse_unavailable" }, { status: 502 });

  const ttl = getStreamCacheTtl();
  const cacheControl = ttl > 0 ? `private, max-age=${ttl}` : "private, no-store";
  const cors: Record<string, string> = {
    "access-control-allow-origin": corsOrigin(req),
    "access-control-allow-credentials": "true",
  };

  const [kind, a, b] = path;

  try {
    if (kind === "manifest") {
      return NextResponse.json(serializeManifest(src.manifest), {
        headers: { "cache-control": cacheControl, ...cors },
      });
    }

    if (kind === "init" && a) {
      const track = findTrack(src.manifest, a);
      if (!track) return NextResponse.json({ error: "track_not_found" }, { status: 404 });
      const buf = buildInitSegment(src.manifest, track);
      return new NextResponse(new Uint8Array(buf), {
        headers: { "content-type": "video/mp4", "cache-control": cacheControl, ...cors },
      });
    }

    if (kind === "video" && a) {
      const track = src.manifest.video;
      const seg = track ? src.manifest.segments[track.id]?.[Number(a)] : undefined;
      if (!track || !seg) return NextResponse.json({ error: "segment_not_found" }, { status: 404 });
      const buf = await buildMediaSegment(src.manifest, track, seg, src.headers);
      return new NextResponse(new Uint8Array(buf), {
        headers: { "content-type": "video/mp4", "cache-control": cacheControl, ...cors },
      });
    }

    if (kind === "audio" && a && b) {
      const track = src.manifest.audio.find((t) => String(t.id) === a);
      const seg = track ? src.manifest.segments[track.id]?.[Number(b)] : undefined;
      if (!track || !seg) return NextResponse.json({ error: "segment_not_found" }, { status: 404 });
      const buf = await buildMediaSegment(src.manifest, track, seg, src.headers);
      return new NextResponse(new Uint8Array(buf), {
        headers: { "content-type": "video/mp4", "cache-control": cacheControl, ...cors },
      });
    }

    return NextResponse.json({ error: "bad_path" }, { status: 404 });
  } catch (e) {
    console.error("[playback mse] error", ratingKey, path.join("/"), e);
    return NextResponse.json({ error: "segment_error" }, { status: 500 });
  }
}
