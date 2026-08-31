import path from "node:path";
import { readJsonCached, writeJsonCached } from "@/lib/fsJsonCache";

/**
 * Is a YouTube video portrait-oriented (a vertical, Shorts-style teaser)?
 * TMDb's own /videos endpoint never exposes width/height for a video — only
 * YouTube's public oEmbed does (unauthenticated, CORS-open, returns the
 * embed's natural width/height). A video's orientation never changes, so
 * results are cached forever in a small JSON store instead of re-querying
 * oEmbed on every metadata fetch — see tmdb.ts's selectVideoCandidates(),
 * which now runs every carousel/details candidate through this before
 * returning it, so a vertical clip never gets picked as the ambient preview
 * (confirmed live: since teasers were prioritized over trailers for the
 * carousel context, more of the vertical social-cut teasers studios now
 * publish were surfacing there, stretched/cropped into a 16:9 box).
 *
 * Must query oEmbed through the `/shorts/{id}` URL, never `/watch?v={id}` —
 * confirmed live on a real vertical Mutiny teaser (e4AzAqWaQyg): querying
 * via `/watch?v=` always returns YouTube's generic default embed size
 * (1000x563, 16:9) regardless of the video's real shape, while the exact
 * same video queried via `/shorts/` correctly returns 563x1000 (9:16). The
 * `/shorts/` path also returns the correct (landscape) size for an ordinary
 * non-Short video — verified against a real Mutiny trailer — so there is no
 * need to special-case a 404 or try both paths.
 */

const CONFIG_DIR =
  process.env.MOVVIZ_CONFIG_DIR ??
  process.env.MOVVIZ_DATA_DIR ??
  path.join(process.cwd(), ".movviz-data");
// v2: every entry recorded before the /shorts/ URL fix (below) was computed
// from oEmbed's generic default (always landscape) and is wrong for every
// real Short. A new filename abandons that cache instead of trusting stale
// `false` results forever — the old file is simply never read again.
const FILE = path.join(CONFIG_DIR, "youtube-orientation-cache-v2.json");
const OEMBED_TIMEOUT_MS = 3000;

type Store = Record<string, boolean>;

function load(): Store {
  return readJsonCached<Store>(FILE, {});
}

const g = globalThis as typeof globalThis & { __movvizYtOrientationInFlight?: Map<string, Promise<boolean>> };
const inFlight: Map<string, Promise<boolean>> = (g.__movvizYtOrientationInFlight ??= new Map());

/** Fails OPEN (false = "treat as landscape, let it play") on any network or
 *  parse error — a broken orientation check must never block an otherwise
 *  valid trailer, only ever prune one confirmed portrait. */
export async function isPortraitYouTubeVideo(key: string): Promise<boolean> {
  const cached = load()[key];
  if (cached !== undefined) return cached;

  const pending = inFlight.get(key);
  if (pending) return pending;

  const check = (async () => {
    try {
      const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/shorts/${key}`)}&format=json`;
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(OEMBED_TIMEOUT_MS) });
      if (!response.ok) return false;
      const data = (await response.json()) as { width?: number; height?: number };
      const portrait = !!data.width && !!data.height && data.height > data.width;
      writeJsonCached(FILE, { ...load(), [key]: portrait });
      return portrait;
    } catch {
      return false;
    } finally {
      inFlight.delete(key);
    }
  })();
  inFlight.set(key, check);
  return check;
}

/** Runs every candidate's orientation check in parallel (bounded — the input
 *  is always TMDb's already-ranked top few, never a large list) and drops
 *  the portrait ones, preserving the original rank order. */
export async function excludePortrait(keys: string[]): Promise<string[]> {
  if (keys.length === 0) return keys;
  const flags = await Promise.all(keys.map((key) => isPortraitYouTubeVideo(key)));
  return keys.filter((_, i) => !flags[i]);
}
