import type { NextRequest } from "next/server";

/**
 * Best-effort "is this request coming from the home network" signal, used
 * only to decide whether to prefer the same-origin NAS image route over
 * TMDb's CDN (see useLocalNetworkPriority.ts) — never a security boundary,
 * so a spoofed header only ever costs a slightly slower image load, never
 * exposes anything.
 *
 * Relies on the reverse proxy (Synology's own, or whatever sits in front of
 * the Docker container) setting x-forwarded-for/x-real-ip to the true
 * client address. Works for the common self-hosted topology where local
 * traffic reaches the container with a private source IP (direct LAN
 * access, or router hairpin NAT) while remote traffic arrives through
 * whatever public-facing path is configured — NOT guaranteed if local
 * traffic is ALSO routed through an external tunnel that masks the real
 * IP. Confirmed live once shipped rather than assumed.
 */
function stripIpv6Prefix(ip: string): string {
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

function isPrivateIp(rawIp: string): boolean {
  const ip = stripIpv6Prefix(rawIp.trim());

  if (ip === "::1" || ip === "127.0.0.1") return true;

  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 127) return true;
    if (a === 169 && b === 254) return true; // link-local
    return false;
  }

  const lower = ip.toLowerCase();
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true; // fc00::/7 ULA
  if (lower.startsWith("fe80:")) return true; // link-local

  return false;
}

function clientIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

export function isLocalRequest(req: NextRequest): boolean {
  const ip = clientIp(req);
  if (!ip) return false;
  return isPrivateIp(ip);
}
