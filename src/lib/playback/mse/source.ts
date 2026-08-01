/**
 * MSE source resolver — server-side.
 *
 * Resolves a Plex media part URL for a ratingKey (same logic as the direct
 * stream route) and builds/caches the fMP4 manifest (moov parse via Range
 * requests). All Plex fetches happen server-side with the admin token; the
 * browser only ever sees the derived manifest JSON + init/media segments.
 *
 * Cache lives in globalThis (Next.js bundles routes separately) and expires
 * with the stream cache TTL from settings (default 300s).
 */
import { loadPlexConfig } from "@/lib/plex/store";
import { safePlexUrl } from "@/lib/plex/safeUrl";
import { plexClientHeaders } from "@/lib/player/plexStream";
import { getStreamCacheTtl } from "@/lib/settings/betaPlayer";
import { buildManifest } from "@/lib/playback/mp4/segmenter";
import type { Mp4Manifest } from "@/lib/playback/mp4/segmenter";

export interface ResolvedMseSource {
  manifest: Mp4Manifest;
  headers: Record<string, string>;
}

interface CacheEntry {
  manifest: Mp4Manifest;
  headers: Record<string, string>;
  expires: number;
}

type ManifestCache = Map<string, CacheEntry>;

function manifestCache(): ManifestCache {
  const g = globalThis as unknown as { __movvizMseManifests?: ManifestCache };
  if (!g.__movvizMseManifests) g.__movvizMseManifests = new Map();
  return g.__movvizMseManifests;
}

export async function getMseManifest(ratingKey: string, userId: string): Promise<ResolvedMseSource | null> {
  const cache = manifestCache();
  const ttlMs = getStreamCacheTtl() * 1000;
  const cached = cache.get(ratingKey);
  if (cached && cached.expires > Date.now()) {
    return { manifest: cached.manifest, headers: cached.headers };
  }

  const cfg = loadPlexConfig();
  if (!cfg.hostname || !cfg.adminToken) return null;
  const base = safePlexUrl(`${cfg.useSsl ? "https" : "http"}://${cfg.hostname}:${cfg.port}`);
  if (!base) return null;
  const headers = plexClientHeaders(cfg.adminToken, `movviz-${userId}`);

  try {
    const metaRes = await fetch(`${base}/library/metadata/${ratingKey}`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!metaRes.ok) return null;
    const data = await metaRes.json();
    const metadata = data?.MediaContainer?.Metadata?.[0];
    const media = metadata?.Media?.[0];
    const part = media?.Part?.[0];
    if (!part?.id && !part?.key) return null;

    const streamPath =
      typeof part.key === "string" && part.key.startsWith("/")
        ? part.key
        : `/library/parts/${part.id}/file.${media.container || "mp4"}`;
    const sourceUrl = `${base}${streamPath}`;

    const manifest = await buildManifest(sourceUrl, headers);
    if (!manifest) return null;

    const entry: CacheEntry = {
      manifest,
      headers,
      expires: Date.now() + Math.max(ttlMs, 10000),
    };
    if (cache.size >= 20) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    cache.set(ratingKey, entry);
    return { manifest, headers };
  } catch (e) {
    console.error("[mse source] build failed", ratingKey, e);
    return null;
  }
}
