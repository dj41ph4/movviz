import { getIndexer } from "./store";
import { markRateLimited } from "./rateLimit";
import { throttleIndexerRequest } from "./rateLimit";

/**
 * Resolve a release (magnet or a protected .torrent/nzb URL) into whatever
 * the download engine's /torrents endpoint accepts. Shared by manual grabs
 * from Search and automatic grabs triggered when a library title is added.
 */
/** Dernier couple de labels d'un hôte (« api.c411.org » → « c411.org ») ; une adresse IP ou un nom simple reste entier. */
function siteOf(hostname: string): string {
  const host = hostname.toLowerCase();
  if (/^[\d.]+$/.test(host) || host.includes(":") || !host.includes(".")) return host;
  return host.split(".").slice(-2).join(".");
}

/**
 * Vrai si l'adresse de téléchargement appartient au même site que l'indexeur. Sert à ne jamais envoyer les
 * identifiants d'un indexeur vers un hôte choisi par l'appelant (adresse fournie par le navigateur).
 */
export function sameIndexerSite(downloadUrl: string, baseUrl: string | null | undefined): boolean {
  if (!baseUrl) return true; // Indexeur sans adresse connue : aucun point de comparaison, comportement historique.
  try {
    return siteOf(new URL(downloadUrl).hostname) === siteOf(new URL(baseUrl).hostname);
  } catch {
    return false;
  }
}

export async function buildGrabPayload({
  magnetUrl,
  downloadUrl,
  indexerId,
  clientSupplied = false,
}: {
  magnetUrl?: string | null;
  downloadUrl?: string | null;
  indexerId?: string | null;
  /** L'adresse vient d'une requête du navigateur (grab manuel), pas directement d'une réponse d'indexeur. */
  clientSupplied?: boolean;
}): Promise<{ torrentId: string } | { torrentFile: string } | { error: string }> {
  if (magnetUrl) return { torrentId: magnetUrl };
  if (!downloadUrl) return { error: "no magnet or download url" };

  try {
    const indexer = indexerId ? getIndexer(indexerId) : null;
    // Adresse fournie par le navigateur vers un autre site que l'indexeur : on télécharge sans ses identifiants,
    // sinon n'importe quel compte connecté pourrait se les faire envoyer sur un serveur à lui.
    const source = indexer && clientSupplied && !sameIndexerSite(downloadUrl, indexer.baseUrl) ? null : indexer;
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
    // Fetching the .torrent file counts against the indexer's per-minute
    // quota too (e.g. c411: 15 req/min) — wait for a free slot first.
    if (source?.baseUrl) await throttleIndexerRequest(source.baseUrl);
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
