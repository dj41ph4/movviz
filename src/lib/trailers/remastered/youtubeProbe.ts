/**
 * Sonde la résolution réelle d'une vidéo YouTube.
 * N'utilise que des fetches serveur vers youtube.com — pas de yt-dlp.
 * Toute incertitude => reject premium (fallback actuel), jamais "probablement 1080p".
 */

const FETCH_TIMEOUT_MS = 3500;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

export type ProbeResult =
  | { ok: true; height: number; width?: number }
  | { ok: false; reason: string };

function parseResolution(html: string): { width?: number; height: number } | null {
  // YouTube embed player config contains ytInitialPlayerResponse with streamingData/adaptiveFormats
  // Look for height fields. Also check qualityLabel like "1080p".
  // Prefer the maximum height found.
  let maxHeight = 0;
  let bestWidth: number | undefined = undefined;
  // Match "height":1080 or "height": 1080
  const heightMatches = [...html.matchAll(/"height"\s*:\s*(\d{2,4})/g)];
  for (const m of heightMatches) {
    const h = parseInt(m[1], 10);
    if (h > maxHeight && h <= 5000) {
      maxHeight = h;
    }
  }
  // Also parse qualityLabel
  const qualityMatches = [...html.matchAll(/"qualityLabel"\s*:\s*"(\d{3,4})p"/g)];
  for (const m of qualityMatches) {
    const h = parseInt(m[1], 10);
    if (h > maxHeight) maxHeight = h;
  }
  if (maxHeight === 0) return null;
  // Try to get width for that height if available nearby
  const widthMatches = [...html.matchAll(/"width"\s*:\s*(\d{2,4})/g)];
  if (widthMatches.length > 0) {
    // pick width corresponding to maxHeight if possible — best effort, take largest width
    let maxW = 0;
    for (const m of widthMatches) {
      const w = parseInt(m[1], 10);
      if (w > maxW && w <= 8000) maxW = w;
    }
    if (maxW > 0) bestWidth = maxW;
  }
  return { height: maxHeight, width: bestWidth };
}

export async function probeYoutubeResolution(key: string): Promise<ProbeResult> {
  const url = `https://www.youtube.com/watch?v=${encodeURIComponent(key)}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
    });
    if (!res.ok) return { ok: false, reason: `http_${res.status}` };
    const html = await res.text();
    // Blocked / private / removed videos have specific markers
    if (html.includes('"playabilityStatus":{"status":"ERROR"') || html.includes('"reason":{"simpleText":"Video unavailable"')) {
      return { ok: false, reason: "unavailable" };
    }
    const parsed = parseResolution(html);
    if (!parsed) return { ok: false, reason: "unknown_resolution" };
    if (parsed.height < 1080) return { ok: false, reason: `below_1080 height=${parsed.height}` };
    return { ok: true, height: parsed.height, width: parsed.width };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("TimeoutError") || msg.includes("timeout")) return { ok: false, reason: "timeout" };
    return { ok: false, reason: "fetch_error" };
  }
}

export function classifyHeight(height: number | undefined): "4K" | "QHD" | "FHD" | "reject" {
  if (!height || height < 1080) return "reject";
  if (height >= 2160) return "4K";
  if (height >= 1440) return "QHD";
  return "FHD";
}
