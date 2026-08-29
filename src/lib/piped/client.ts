import type { PipedStream, PipedStreamsResponse } from "./types";
import { getHealthyPipedInstances, markFailure, markSuccess } from "./instances";

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const PER_INSTANCE_TIMEOUT_MS = 1_500;
const TOTAL_BUDGET_MS = 3_000;
const CACHE_TTL_MS = 3 * 60 * 1000;

type ResolveCacheEntry = {
  value: PipedStreamsResponse;
  expiresAt: number;
};

const g = globalThis as typeof globalThis & {
  __movvizPipedResolveCache?: Map<string, ResolveCacheEntry>;
  __movvizPipedResolveInFlight?: Map<string, Promise<PipedStreamsResponse | null>>;
};

function resolveCache(): Map<string, ResolveCacheEntry> {
  if (!(g.__movvizPipedResolveCache instanceof Map)) g.__movvizPipedResolveCache = new Map<string, ResolveCacheEntry>();
  return g.__movvizPipedResolveCache as Map<string, ResolveCacheEntry>;
}

function inFlightMap(): Map<string, Promise<PipedStreamsResponse | null>> {
  if (!(g.__movvizPipedResolveInFlight instanceof Map))
    g.__movvizPipedResolveInFlight = new Map<string, Promise<PipedStreamsResponse | null>>();
  return g.__movvizPipedResolveInFlight as Map<string, Promise<PipedStreamsResponse | null>>;
}

function isHttpsUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

function toNumberOrNull(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function toStringOrNull(v: unknown): string | null {
  if (typeof v === "string") {
    const t = v.trim();
    return t ? t : null;
  }
  return null;
}

function validatePipedStream(raw: unknown): PipedStream | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const url = typeof o.url === "string" ? o.url.trim() : "";
  if (!url || !isHttpsUrl(url)) return null;

  const mimeTypeRaw = typeof o.mimeType === "string" ? o.mimeType : typeof o.mime_type === "string" ? (o.mime_type as string) : "";
  const mimeType = mimeTypeRaw.trim();
  if (!mimeType) return null;

  const codec = toStringOrNull(o.codec);
  const quality = toStringOrNull(o.quality);

  const width = toNumberOrNull(o.width);
  const height = toNumberOrNull(o.height);
  const bitrate = toNumberOrNull(o.bitrate) ?? toNumberOrNull(o.bitRate);

  const initStart = toNumberOrNull(o.initStart) ?? toNumberOrNull(o.init_start);
  const initEnd = toNumberOrNull(o.initEnd) ?? toNumberOrNull(o.init_end);
  const indexStart = toNumberOrNull(o.indexStart) ?? toNumberOrNull(o.index_start);
  const indexEnd = toNumberOrNull(o.indexEnd) ?? toNumberOrNull(o.index_end);
  if (initStart == null || initEnd == null || indexStart == null || indexEnd == null) return null;
  if (initStart < 0 || initEnd < initStart || indexStart < 0 || indexEnd < indexStart) return null;

  const videoOnly = typeof o.videoOnly === "boolean" ? o.videoOnly : typeof o.video_only === "boolean" ? (o.video_only as boolean) : false;

  return {
    url,
    mimeType,
    codec,
    quality,
    width,
    height,
    bitrate,
    initStart,
    initEnd,
    indexStart,
    indexEnd,
    videoOnly,
  };
}

function validatePipedResponse(raw: unknown): PipedStreamsResponse | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const durationRaw = toNumberOrNull(o.duration);
  if (durationRaw == null || durationRaw <= 0) return null;

  const dashRaw = typeof o.dash === "string" ? o.dash.trim() : null;
  const hlsRaw = typeof o.hls === "string" ? o.hls.trim() : null;
  const dash = dashRaw && isHttpsUrl(dashRaw) ? dashRaw : null;
  const hls = hlsRaw && isHttpsUrl(hlsRaw) ? hlsRaw : null;

  const audioRaw = Array.isArray(o.audioStreams) ? o.audioStreams : Array.isArray(o.audio_streams) ? o.audio_streams : [];
  const videoRaw = Array.isArray(o.videoStreams) ? o.videoStreams : Array.isArray(o.video_streams) ? o.video_streams : [];

  const audioStreams: PipedStream[] = [];
  for (const item of audioRaw as unknown[]) {
    const s = validatePipedStream(item);
    if (s) audioStreams.push(s);
  }
  const videoStreams: PipedStream[] = [];
  for (const item of videoRaw as unknown[]) {
    const s = validatePipedStream(item);
    if (s) videoStreams.push(s);
  }

  if (!audioStreams.length && !videoStreams.length) return null;

  const title = toStringOrNull(o.title) ?? undefined;

  return {
    title: title ?? undefined,
    duration: durationRaw,
    dash,
    hls,
    audioStreams,
    videoStreams,
  };
}

function getCached(videoId: string): PipedStreamsResponse | null {
  const cache = resolveCache();
  const hit = cache.get(videoId);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    cache.delete(videoId);
    return null;
  }
  return hit.value;
}

function setCached(videoId: string, value: PipedStreamsResponse): void {
  const cache = resolveCache();
  cache.set(videoId, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  if (cache.size > 200) {
    const oldest = cache.keys().next().value as string | undefined;
    if (oldest) cache.delete(oldest);
  }
}

export function isValidPipedVideoId(videoId: string): boolean {
  return VIDEO_ID_RE.test(videoId);
}

export async function resolvePiped(videoId: string): Promise<PipedStreamsResponse | null> {
  if (!VIDEO_ID_RE.test(videoId)) return null;

  const cached = getCached(videoId);
  if (cached) return cached;

  const inFlight = inFlightMap();
  const existing = inFlight.get(videoId);
  if (existing) return existing;

  const promise = resolvePipedInternal(videoId).finally(() => {
    inFlight.delete(videoId);
  });
  inFlight.set(videoId, promise);
  return promise;
}

async function resolvePipedInternal(videoId: string): Promise<PipedStreamsResponse | null> {
  const startOverall = Date.now();
  let instances: string[];
  try {
    instances = await getHealthyPipedInstances();
  } catch {
    return null;
  }
  const candidates = instances.slice(0, 2);
  if (!candidates.length) return null;

  for (const base of candidates) {
    const elapsed = Date.now() - startOverall;
    const remaining = TOTAL_BUDGET_MS - elapsed;
    if (remaining <= 100) break;
    const timeout = Math.min(PER_INSTANCE_TIMEOUT_MS, remaining);

    const normalizedBase = base.replace(/\/+$/, "");
    if (!isHttpsUrl(normalizedBase)) {
      markFailure(base);
      continue;
    }
    const endpoint = `${normalizedBase}/streams/${encodeURIComponent(videoId)}`;
    if (!isHttpsUrl(endpoint)) {
      markFailure(base);
      continue;
    }

    const t0 = Date.now();
    try {
      const res = await fetch(endpoint, {
        cache: "no-store",
        signal: AbortSignal.timeout(timeout),
        headers: { accept: "application/json" },
      });
      if (!res.ok) {
        markFailure(base);
        continue;
      }
      let raw: unknown = null;
      try { raw = await res.json() as unknown; } catch { raw = null; }
      const parsed = validatePipedResponse(raw);
      if (!parsed) {
        markFailure(base);
        continue;
      }
      if (parsed.audioStreams.length === 0 && parsed.videoStreams.length === 0) {
        markFailure(base);
        continue;
      }
      const latency = Date.now() - t0;
      markSuccess(base, latency);
      setCached(videoId, parsed);
      return parsed;
    } catch {
      markFailure(base);
      continue;
    }
  }
  return null;
}

export function __resetPipedClientForTests(): void {
  g.__movvizPipedResolveCache = new Map();
  g.__movvizPipedResolveInFlight = new Map();
}
