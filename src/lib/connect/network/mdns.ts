import dgram from "node:dgram";

/** Appareil Google Cast (Chromecast, Google TV, TV avec Google Cast intégré, enceinte). */
export interface CastReceiverInfo {
  id: string;
  name: string;
  model: string | null;
  host: string;
  port: number;
  /** Capacités annoncées (bit 0 = vidéo). Une enceinte seule n'a pas la vidéo. */
  video: boolean;
}

const MDNS_ADDR = "224.0.0.251";
const MDNS_PORT = 5353;
const SERVICE = "_googlecast._tcp.local";

function encodeName(name: string): Buffer {
  const parts = name.split(".").filter(Boolean).map((label) => {
    const b = Buffer.from(label, "utf8");
    return Buffer.concat([Buffer.from([b.length]), b]);
  });
  return Buffer.concat([...parts, Buffer.from([0])]);
}

/** Requête DNS « PTR _googlecast._tcp.local » (bit QU : réponse directe acceptée). */
export function buildQuery(): Buffer {
  const header = Buffer.from([0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0]);
  const question = Buffer.concat([encodeName(SERVICE), Buffer.from([0x00, 0x0c, 0x80, 0x01])]);
  return Buffer.concat([header, question]);
}

function readName(buf: Buffer, offset: number, depth = 0): { name: string; next: number } {
  const labels: string[] = [];
  let pos = offset;
  let next = -1;
  while (pos < buf.length && depth < 20) {
    const len = buf[pos];
    if (len === 0) { pos += 1; break; }
    if ((len & 0xc0) === 0xc0) {
      if (pos + 1 >= buf.length) break;
      const pointer = ((len & 0x3f) << 8) | buf[pos + 1];
      if (next < 0) next = pos + 2;
      const inner = readName(buf, pointer, depth + 1);
      labels.push(inner.name);
      pos = -1;
      break;
    }
    labels.push(buf.toString("utf8", pos + 1, pos + 1 + len));
    pos += 1 + len;
  }
  return { name: labels.filter(Boolean).join("."), next: next >= 0 ? next : pos };
}

interface RR { name: string; type: number; data: Buffer; offset: number }

/** Décode les enregistrements d'une réponse mDNS (réponses + additionnels). */
export function parseRecords(buf: Buffer): RR[] {
  if (buf.length < 12) return [];
  const qd = buf.readUInt16BE(4);
  const total = buf.readUInt16BE(6) + buf.readUInt16BE(8) + buf.readUInt16BE(10);
  let pos = 12;
  for (let i = 0; i < qd && pos < buf.length; i++) pos = readName(buf, pos).next + 4;
  const out: RR[] = [];
  for (let i = 0; i < total && pos + 10 <= buf.length; i++) {
    const { name, next } = readName(buf, pos);
    pos = next;
    if (pos + 10 > buf.length) break;
    const type = buf.readUInt16BE(pos);
    const len = buf.readUInt16BE(pos + 8);
    const start = pos + 10;
    if (start + len > buf.length) break;
    out.push({ name, type, data: buf.subarray(start, start + len), offset: start });
    pos = start + len;
  }
  return out;
}

function parseTxt(data: Buffer): Record<string, string> {
  const out: Record<string, string> = {};
  let pos = 0;
  while (pos < data.length) {
    const len = data[pos];
    const entry = data.toString("utf8", pos + 1, pos + 1 + len);
    const eq = entry.indexOf("=");
    if (eq > 0) out[entry.slice(0, eq).toLowerCase()] = entry.slice(eq + 1);
    pos += 1 + len;
  }
  return out;
}

/** Assemble PTR → SRV (port, hôte) → A (adresse) → TXT (nom affiché, modèle). */
export function receiversFrom(packets: Buffer[]): CastReceiverInfo[] {
  const srv = new Map<string, { port: number; target: string }>();
  const txt = new Map<string, Record<string, string>>();
  const addr = new Map<string, string>();
  const instances = new Set<string>();
  for (const buf of packets) {
    for (const rr of parseRecords(buf)) {
      if (rr.type === 12 && rr.name.toLowerCase() === SERVICE) instances.add(readName(buf, rr.offset).name);
      else if (rr.type === 33 && rr.data.length >= 7) srv.set(rr.name, { port: rr.data.readUInt16BE(4), target: readName(buf, rr.offset + 6).name });
      else if (rr.type === 16) txt.set(rr.name, parseTxt(rr.data));
      else if (rr.type === 1 && rr.data.length === 4) addr.set(rr.name.toLowerCase(), [...rr.data].join("."));
    }
  }
  const out = new Map<string, CastReceiverInfo>();
  for (const instance of instances) {
    const s = srv.get(instance);
    const t = txt.get(instance) ?? {};
    if (!s) continue;
    const host = addr.get(s.target.toLowerCase());
    if (!host) continue;
    const id = (t.id || instance).replace(/[^A-Za-z0-9]/g, "").slice(0, 40) || instance;
    const caps = Number(t.ca ?? "0");
    out.set(id, {
      id,
      name: (t.fn || instance.split("._googlecast")[0] || "Chromecast").slice(0, 60),
      model: t.md || null,
      host,
      port: s.port,
      video: !Number.isFinite(caps) || caps === 0 || (caps & 1) === 1,
    });
  }
  return [...out.values()];
}

export async function searchCastReceivers(timeoutMs = 2500): Promise<CastReceiverInfo[]> {
  const packets: Buffer[] = [];
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
    socket.on("message", (msg) => { if (packets.length < 200) packets.push(msg); });
    socket.bind(0, () => {
      const query = buildQuery();
      socket.send(query, MDNS_PORT, MDNS_ADDR);
      setTimeout(() => { try { socket.send(query, MDNS_PORT, MDNS_ADDR); } catch { /* fermé */ } }, 500);
    });
    setTimeout(finish, timeoutMs);
  });
  return receiversFrom(packets);
}
