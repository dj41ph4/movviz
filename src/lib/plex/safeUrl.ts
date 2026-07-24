export function safePlexUrl(hostname: string): string | null {
  if (!hostname) return null;
  try {
    const u = new URL(hostname.includes("://") ? hostname : `http://${hostname}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    // Block loopback and link-local only — Plex servers are typically on
    // private LAN IPs (192.168.x.x / 10.x.x.x), which are perfectly valid.
    if (host === "0.0.0.0" || host === "::1") return null;
    if (/^127\./.test(host)) return null;
    if (/^169\.254\./.test(host)) return null;
    return u.origin;
  } catch {
    return null;
  }
}
