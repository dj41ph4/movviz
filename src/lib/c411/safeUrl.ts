/**
 * SSRF guard for the C411 site-session client (Discover lists).
 *
 * The C411 indexer's `baseUrl` comes from the user's own config file, so any
 * fetch derived from it must be validated before it fires: https only, no
 * credentials in the URL, no loopback/private/link-local hosts. C411 itself
 * is public internet — there is no legitimate reason for the origin to be a
 * LAN IP, unlike Plex (safePlexUrl deliberately allows those).
 */
export function safeC411Origin(origin: string): string | null {
  try {
    const u = new URL(origin);
    if (u.protocol !== "https:") return null;
    if (u.username || u.password) return null;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "0.0.0.0" || host === "::1") return null;
    if (/^127\./.test(host)) return null;
    if (/^10\./.test(host)) return null;
    if (/^192\.168\./.test(host)) return null;
    if (/^169\.254\./.test(host)) return null;
    if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return null;
    if (/^[0-9.]+$/.test(host)) return null; // any bare IPv4 that survived the ranges above
    return u.origin;
  } catch {
    return null;
  }
}

/** Derive `https://host` from a configured Torznab base URL (e.g. `https://c411.org/api`). */
export function c411OriginFromBaseUrl(baseUrl: string): string | null {
  try {
    const u = new URL(baseUrl);
    return safeC411Origin(u.origin);
  } catch {
    return null;
  }
}
