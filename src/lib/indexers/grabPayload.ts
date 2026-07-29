import { getIndexer } from "./store";
import { markRateLimited } from "./rateLimit";

/**
 * Resolve a release (magnet or a protected .torrent/nzb URL) into whatever
 * the download engine's /torrents endpoint accepts. Shared by manual grabs
 * from Search and automatic grabs triggered when a library title is added.
 */
export async function buildGrabPayload({
  magnetUrl,
  downloadUrl,
  indexerId,
}: {
  magnetUrl?: string | null;
  downloadUrl?: string | null;
  indexerId?: string | null;
}): Promise<{ torrentId: string } | { torrentFile: string } | { error: string }> {
  if (magnetUrl) return { torrentId: magnetUrl };
  if (!downloadUrl) return { error: "no magnet or download url" };

  try {
    const source = indexerId ? getIndexer(indexerId) : null;
    const headers: Record<string, string> = {};
    if (source?.authType === "credentials" && source.username) {
      headers.authorization = `Basic ${Buffer.from(`${source.username}:${source.password}`).toString("base64")}`;
    } else if (source?.authType === "x-api-key" && source.apiKey) {
      headers["X-Api-Key"] = source.apiKey;
    }
    // Append apikey as query param for apikey-based indexers (not already in URL)
    let url = downloadUrl;
    if (source?.authType === "apikey" && source.apiKey) {
      try {
        const u = new URL(downloadUrl);
        if (!u.searchParams.has("apikey")) {
          u.searchParams.set("apikey", source.apiKey);
          url = u.toString();
        }
      } catch { /* keep original url if parsing fails */ }
    }
    const res = await fetch(url, { cache: "no-store", headers, signal: AbortSignal.timeout(12_000) });
    if (!res.ok) {
      // Fetching the actual .torrent file is a third kind of request to the
      // indexer, on top of the RSS refresh and Torznab search — a 429 here
      // was previously invisible to the rate-limit tracker, so the very next
      // search would query this indexer again immediately instead of backing
      // off like every other 429 path already does.
      //
      // Some private trackers answer rapid-fire download requests with 401
      // instead of 429 once a per-minute download quota is exceeded — the
      // search itself (a separate Torznab request) still succeeds and returns
      // valid results, so this looks like an auth failure but isn't one: the
      // exact same URL, opened once by hand a minute later, works fine. An
      // automatic run grabbing many movies back-to-back can trip this well
      // before a human clicking manually ever would. Treat it the same as a
      // 429 — back off this indexer for the cooldown window rather than
      // hammering it again on the very next candidate.
      if ((res.status === 429 || res.status === 401) && indexerId) markRateLimited(indexerId);
      throw new Error(`HTTP ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return { torrentFile: buf.toString("base64") };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
