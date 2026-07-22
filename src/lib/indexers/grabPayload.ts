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
    const headers: Record<string, string> =
      source?.authType === "credentials" && source.username
        ? { authorization: `Basic ${Buffer.from(`${source.username}:${source.password}`).toString("base64")}` }
        : {};
    const res = await fetch(downloadUrl, { cache: "no-store", headers, signal: AbortSignal.timeout(12_000) });
    if (!res.ok) {
      // Fetching the actual .torrent file is a third kind of request to the
      // indexer, on top of the RSS refresh and Torznab search — a 429 here
      // was previously invisible to the rate-limit tracker, so the very next
      // search would query this indexer again immediately instead of backing
      // off like every other 429 path already does.
      if (res.status === 429 && indexerId) markRateLimited(indexerId);
      throw new Error(`HTTP ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    return { torrentFile: buf.toString("base64") };
  } catch (e) {
    return { error: (e as Error).message };
  }
}
