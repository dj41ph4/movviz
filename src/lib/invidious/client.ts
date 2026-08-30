import type { InvidiousFormat, InvidiousStreamsResponse } from "./types";
import { getHealthyInvidiousInstances, markFailure, markSuccess } from "./instances";
import type { PipedStreamsResponse } from "../piped/types";

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const PER_INSTANCE_TIMEOUT_MS = 1500;
const TOTAL_BUDGET_MS = 3000;

function toPipedResponse(inv: InvidiousStreamsResponse): PipedStreamsResponse | null {
  const all = [...inv.adaptiveFormats, ...inv.formatStreams];
  const videoStreams = all
    .filter((f) => f.type?.includes("video/") && f.height && f.height > 0)
    .map((f) => ({
      url: f.url,
      mimeType: f.type.split(";")[0].trim(),
      codec: f.type.split('codecs="')[1]?.split('"')[0] ?? null,
      quality: f.qualityLabel || f.quality || null,
      width: f.width ?? null,
      height: f.height ?? null,
      bitrate: null,
      initStart: f.initStart ?? null,
      initEnd: f.initEnd ?? null,
      indexStart: f.indexStart ?? null,
      indexEnd: f.indexEnd ?? null,
      videoOnly: !f.type.includes("audio"),
    }))
    .filter((s) => s.url && s.mimeType);

  const audioStreams = all
    .filter((f) => f.type?.includes("audio/"))
    .map((f) => ({
      url: f.url,
      mimeType: f.type.split(";")[0].trim(),
      codec: f.type.split('codecs="')[1]?.split('"')[0] ?? null,
      quality: f.quality || null,
      width: null,
      height: null,
      bitrate: null,
      initStart: f.initStart ?? null,
      initEnd: f.initEnd ?? null,
      indexStart: f.indexStart ?? null,
      indexEnd: f.indexEnd ?? null,
      videoOnly: false,
    }))
    .filter((s) => s.url && s.mimeType);

  if (!videoStreams.length && !audioStreams.length) return null;
  return { duration: 100, videoStreams, audioStreams, dash: null, hls: null };
}

export async function resolveInvidious(videoId: string): Promise<PipedStreamsResponse | null> {
  if (!VIDEO_ID_RE.test(videoId)) return null;
  let instances: string[];
  try {
    instances = await getHealthyInvidiousInstances();
  } catch {
    return null;
  }
  const candidates = instances.slice(0, 2);
  if (!candidates.length) return null;
  const startOverall = Date.now();
  for (const base of candidates) {
    const elapsed = Date.now() - startOverall;
    const remaining = TOTAL_BUDGET_MS - elapsed;
    if (remaining <= 100) break;
    const timeout = Math.min(PER_INSTANCE_TIMEOUT_MS, remaining);
    const endpoint = `${base.replace(/\/+$/, "")}/api/v1/videos/${encodeURIComponent(videoId)}`;
    const t0 = Date.now();
    try {
      const res = await fetch(endpoint, { cache: "no-store", signal: AbortSignal.timeout(timeout), headers: { accept: "application/json" } });
      if (!res.ok) {
        markFailure(base);
        continue;
      }
      const raw = (await res.json()) as unknown as InvidiousStreamsResponse;
      const pipedLike = toPipedResponse(raw);
      if (!pipedLike) {
        markFailure(base);
        continue;
      }
      markSuccess(base, Date.now() - t0);
      return pipedLike;
    } catch {
      markFailure(base);
      continue;
    }
  }
  return null;
}
