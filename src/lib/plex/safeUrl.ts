export function safePlexUrl(hostname: string): string | null {
  if (!hostname) return null;
  try {
    const u = new URL(hostname.includes("://") ? hostname : `http://${hostname}`);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    if (host === "localhost" || host === "0.0.0.0" || host === "::1") return null;
    if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.)/.test(host)) return null;
    if (/^169\.254\./.test(host)) return null;
    return u.origin;
  } catch {
    return null;
  }
}
