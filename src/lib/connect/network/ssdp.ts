import dgram from "node:dgram";

/** Téléviseur / lecteur DLNA (UPnP MediaRenderer) trouvé sur le réseau local. */
export interface DlnaRenderer {
  udn: string;
  name: string;
  model: string | null;
  /** URL de contrôle du service AVTransport (lecture, pause, position). */
  avTransportUrl: string;
  avTransportType: string;
}

const SSDP_ADDR = "239.255.255.250";
const SSDP_PORT = 1900;
const TARGET = "urn:schemas-upnp-org:device:MediaRenderer:1";

const tag = (xml: string, name: string): string | null => {
  const m = new RegExp(`<(?:[A-Za-z0-9_]+:)?${name}[^>]*>([\\s\\S]*?)</(?:[A-Za-z0-9_]+:)?${name}>`, "i").exec(xml);
  return m ? decodeXml(m[1].trim()) : null;
};

export function decodeXml(value: string): string {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}

/** Lit la description d'un appareil UPnP : nom, identifiant et URL de contrôle AVTransport. */
export function parseRendererDescription(xml: string, location: string): DlnaRenderer | null {
  const udn = tag(xml, "UDN");
  const name = tag(xml, "friendlyName");
  if (!udn || !name) return null;
  const services = xml.match(/<(?:[A-Za-z0-9_]+:)?service>[\s\S]*?<\/(?:[A-Za-z0-9_]+:)?service>/gi) ?? [];
  const av = services.find((s) => /urn:schemas-upnp-org:service:AVTransport:\d/i.test(s));
  if (!av) return null;
  const control = tag(av, "controlURL");
  const type = tag(av, "serviceType");
  if (!control || !type) return null;
  const base = tag(xml, "URLBase") || location;
  let avTransportUrl: string;
  try {
    avTransportUrl = new URL(control, base).href;
  } catch {
    return null;
  }
  if (!/^https?:$/.test(new URL(avTransportUrl).protocol)) return null;
  return { udn, name: name.slice(0, 60), model: tag(xml, "modelName"), avTransportUrl, avTransportType: type };
}

/** Une recherche SSDP (M-SEARCH) : la réponse de chaque appareil donne l'adresse de sa description. */
export async function ssdpSearch(target: string, timeoutMs = 2500): Promise<string[]> {
  const locations = new Set<string>();
  await new Promise<void>((resolve) => {
    let socket: dgram.Socket;
    try {
      socket = dgram.createSocket({ type: "udp4", reuseAddr: true });
    } catch {
      resolve();
      return;
    }
    const finish = () => {
      try { socket.close(); } catch { /* déjà fermé */ }
      resolve();
    };
    socket.on("error", finish);
    socket.on("message", (msg) => {
      const text = msg.toString("utf8");
      if (!/^HTTP\/1\.1 200/i.test(text)) return;
      const location = /^location:\s*(\S+)/im.exec(text)?.[1];
      if (location && /^https?:\/\//i.test(location)) locations.add(location);
    });
    socket.bind(0, () => {
      const query = Buffer.from(
        `M-SEARCH * HTTP/1.1\r\nHOST: ${SSDP_ADDR}:${SSDP_PORT}\r\nMAN: "ssdp:discover"\r\nMX: 2\r\nST: ${target}\r\nUSER-AGENT: Movviz/1 UPnP/1.1\r\n\r\n`,
      );
      // Deux envois : un paquet UDP perdu ne fait pas disparaître le téléviseur.
      socket.send(query, SSDP_PORT, SSDP_ADDR);
      setTimeout(() => { try { socket.send(query, SSDP_PORT, SSDP_ADDR); } catch { /* fermé */ } }, 400);
    });
    setTimeout(finish, timeoutMs);
  });
  return [...locations];
}

export async function searchDlnaRenderers(timeoutMs = 2500): Promise<DlnaRenderer[]> {
  const locations = await ssdpSearch(TARGET, timeoutMs);
  const found = await Promise.all(locations.slice(0, 32).map(async (location) => {
    try {
      const response = await fetch(location, { signal: AbortSignal.timeout(2500) });
      if (!response.ok) return null;
      const xml = (await response.text()).slice(0, 512 * 1024);
      return parseRendererDescription(xml, location);
    } catch {
      return null;
    }
  }));
  const byUdn = new Map<string, DlnaRenderer>();
  for (const r of found) if (r) byUdn.set(r.udn, r);
  return [...byUdn.values()];
}
