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

const g = globalThis as typeof globalThis & { __movvizYtOrientationInFlight?: Map<string, Promise<boolean>>; __movvizYtOrientationFailedAt?: Map<string, number> };
const inFlight: Map<string, Promise<boolean>> = (g.__movvizYtOrientationInFlight ??= new Map());
/** Keys whose check failed (network, timeout, 5xx) — not retried for an
 *  hour. Failures used to be forgotten at once, so every fiche opening
 *  queried the same unanswerable videos again and waited up to 3 s each. */
const failedAt: Map<string, number> = (g.__movvizYtOrientationFailedAt ??= new Map());
const RETRY_FAILED_AFTER_MS = 60 * 60 * 1000;
/** excludePortrait never holds a response longer than this: a check still
 *  running is kept (fail-open, same as a failure) and finishes in the
 *  background for next time. */
const CHECK_BUDGET_MS = 400;

/** Fails OPEN (false = "treat as landscape, let it play") on any network or
 *  parse error — a broken orientation check must never block an otherwise
 *  valid trailer, only ever prune one confirmed portrait. */
export async function isPortraitYouTubeVideo(key: string): Promise<boolean> {
  const cached = load()[key];
  if (cached !== undefined) return cached;

  const pending = inFlight.get(key);
  if (pending) return pending;
  const failed = failedAt.get(key);
  if (failed != null && Date.now() - failed < RETRY_FAILED_AFTER_MS) return false;

  const check = (async () => {
    try {
      const url = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/shorts/${key}`)}&format=json`;
      const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(OEMBED_TIMEOUT_MS) });
      if (!response.ok) {
        // 4xx: YouTube has no Short under this id (private, removed, not
        // embeddable) — a definite answer, kept like any other. 5xx: a
        // passing failure, retried later.
        if (response.status >= 400 && response.status < 500) writeJsonCached(FILE, { ...load(), [key]: false });
        else failedAt.set(key, Date.now());
        return false;
      }
      const data = (await response.json()) as { width?: number; height?: number };
      const portrait = !!data.width && !!data.height && data.height > data.width;
      writeJsonCached(FILE, { ...load(), [key]: portrait });
      return portrait;
    } catch {
      failedAt.set(key, Date.now());
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
  const budget = new Promise<false>((resolve) => setTimeout(() => resolve(false), CHECK_BUDGET_MS));
  const flags = await Promise.all(keys.map((key) => Promise.race([isPortraitYouTubeVideo(key), budget])));
  return keys.filter((_, i) => !flags[i]);
}

/** Cache-only counterpart of excludePortrait — never queries oEmbed. Keeps
 *  only keys already confirmed landscape; an unchecked key is dropped rather
 *  than risked, since resolving it would mean a network round-trip. Used by
 *  the dashboard's fast local hero fallback, which must never block on the
 *  network (see suggestionEngine.ts's buildLibraryHeroFallbackSlides). */
export function excludeUnknownOrPortrait(keys: string[]): string[] {
  if (keys.length === 0) return keys;
  const store = load();
  return keys.filter((key) => store[key] === false);
}
