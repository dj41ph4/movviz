import { networkInterfaces } from "node:os";
import type { NextRequest } from "next/server";
import { ssdpSearch } from "./ssdp";

/**
 * L'appareil qui demande est-il chez lui, sur le réseau du serveur ? Les écrans
 * trouvés par le serveur (Chromecast, DLNA) ne sont proposés qu'à ce moment-là :
 * hors de chez soi, l'icône Caster montre les écrans proches du téléphone ou de
 * Chrome, pas ceux du salon.
 *
 * Chez soi, l'appareil passe souvent par l'adresse publique (même nom de domaine
 * qu'en déplacement) : le proxy voit alors l'adresse publique de la box, que le
 * serveur demande à la box elle-même (UPnP, GetExternalIPAddress), sans aucun
 * service extérieur. En IPv6, chaque appareil a sa propre adresse publique :
 * même préfixe /64 que le serveur = même réseau.
 *
 * Dans le doute (aucune adresse client, box muette), on garde la liste complète :
 * jamais de régression pour celui qui caste depuis son canapé.
 */

export interface ServerAddresses {
  publicV4: string | null;
  v6Prefixes: string[];
}

const strip = (ip: string) => (ip.startsWith("::ffff:") ? ip.slice(7) : ip).trim().toLowerCase();

function isPrivateV4(ip: string): boolean {
  const m = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(ip);
  if (!m) return false;
  const a = Number(m[1]), b = Number(m[2]);
  return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254) || (a === 100 && b >= 64 && b <= 127);
}

/** Les 4 premiers groupes (préfixe /64) d'une adresse IPv6, ou null. */
export function v6Prefix64(raw: string): string | null {
  const ip = strip(raw).split("%")[0];
  if (!ip.includes(":") || /[^0-9a-f:]/.test(ip)) return null;
  const halves = ip.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const fill = 8 - head.length - tail.length;
  if (fill < 0 || (halves.length === 1 && fill !== 0)) return null;
  const groups = [...head, ...Array(fill).fill("0"), ...tail].map((g) => parseInt(g || "0", 16).toString(16));
  return groups.slice(0, 4).join(":");
}

const isPrivateV6 = (ip: string) => ip === "::1" || /^f[cd]/.test(ip) || ip.startsWith("fe80:");

/** true = même réseau ou impossible à dire ; false = l'appareil est ailleurs, à coup sûr. */
export function isSameNetwork(rawClient: string | null, server: ServerAddresses): boolean {
  if (!rawClient) return true;
  const ip = strip(rawClient);
  if (ip.includes(".")) {
    if (isPrivateV4(ip)) return true;
    return server.publicV4 ? ip === server.publicV4 : true;
  }
  if (isPrivateV6(ip)) return true;
  const prefix = v6Prefix64(ip);
  if (!prefix || server.v6Prefixes.length === 0) return true;
  return server.v6Prefixes.includes(prefix);
}

// ── Adresses du serveur (réseau « host ») ──────────────────────────────────

const holder = globalThis as typeof globalThis & { __movvizPublicV4?: { value: string | null; at: number; pending: Promise<void> | null } };
const cache = (holder.__movvizPublicV4 ??= { value: null, at: 0, pending: null });
const REFRESH_MS = 10 * 60_000;
const IGD = ["urn:schemas-upnp-org:device:InternetGatewayDevice:1", "urn:schemas-upnp-org:device:InternetGatewayDevice:2"];

const tag = (xml: string, name: string) => new RegExp(`<(?:\\w+:)?${name}>([^<]*)</(?:\\w+:)?${name}>`, "i").exec(xml)?.[1]?.trim() ?? null;

/** Adresse publique de la box via UPnP IGD (GetExternalIPAddress). */
async function askGateway(): Promise<string | null> {
  const locations = [...new Set((await Promise.all(IGD.map((t) => ssdpSearch(t, 2000).catch(() => [])))).flat())];
  for (const location of locations.slice(0, 4)) {
    try {
      const desc = await (await fetch(location, { signal: AbortSignal.timeout(2500) })).text();
      for (const [, block] of desc.matchAll(/<service>([\s\S]*?)<\/service>/gi)) {
        const type = tag(block, "serviceType");
        const control = tag(block, "controlURL");
        if (!type || !control || !/WAN(IP|PPP)Connection/.test(type)) continue;
        const body = `<?xml version="1.0"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/" s:encodingStyle="http://schemas.xmlsoap.org/soap/encoding/"><s:Body><u:GetExternalIPAddress xmlns:u="${type}"/></s:Body></s:Envelope>`;
        const res = await fetch(new URL(control, location), {
          method: "POST", body, signal: AbortSignal.timeout(2500),
          headers: { "content-type": 'text/xml; charset="utf-8"', soapaction: `"${type}#GetExternalIPAddress"` },
        });
        const ip = tag(await res.text(), "NewExternalIPAddress");
        if (ip && /^\d{1,3}(\.\d{1,3}){3}$/.test(ip) && !isPrivateV4(ip)) return ip;
      }
    } catch { /* box suivante */ }
  }
  return null;
}

function serverV6Prefixes(): string[] {
  const out = new Set<string>();
  for (const list of Object.values(networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.internal || a.family !== "IPv6" || isPrivateV6(a.address.toLowerCase())) continue;
      const p = v6Prefix64(a.address);
      if (p) out.add(p);
    }
  }
  return [...out];
}

export async function serverAddresses(waitMs = 2500): Promise<ServerAddresses> {
  if (Date.now() - cache.at > REFRESH_MS && !cache.pending) {
    cache.pending = askGateway()
      .then((ip) => { if (ip) cache.value = ip; })
      .catch(() => {})
      .finally(() => { cache.at = Date.now(); cache.pending = null; });
  }
  if (cache.at === 0 && cache.pending) await Promise.race([cache.pending, new Promise((r) => setTimeout(r, waitMs))]);
  return { publicV4: cache.value, v6Prefixes: serverV6Prefixes() };
}

export function requestIp(req: NextRequest): string | null {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || req.headers.get("x-real-ip")?.trim() || null;
}

export async function isRequestOnServerNetwork(req: NextRequest): Promise<boolean> {
  return isSameNetwork(requestIp(req), await serverAddresses());
}
