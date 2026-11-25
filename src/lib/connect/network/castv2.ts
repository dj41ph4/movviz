import tls from "node:tls";
import { EventEmitter } from "node:events";

/**
 * Protocole Google Cast (CASTV2) côté émetteur, sans dépendance : messages
 * protobuf CastMessage préfixés de leur longueur, sur TLS (port 8009). Lance
 * le lecteur par défaut de Google (Default Media Receiver, aucune inscription
 * requise) et lui fait lire une URL, puis le pilote.
 */

export const DEFAULT_MEDIA_RECEIVER = "CC1AD845";
const NS_CONNECTION = "urn:x-cast:com.google.cast.tp.connection";
const NS_HEARTBEAT = "urn:x-cast:com.google.cast.tp.heartbeat";
const NS_RECEIVER = "urn:x-cast:com.google.cast.receiver";
const NS_MEDIA = "urn:x-cast:com.google.cast.media";
const SENDER = "sender-movviz";

function varint(n: number): Buffer {
  const out: number[] = [];
  let v = n >>> 0;
  while (v > 0x7f) { out.push((v & 0x7f) | 0x80); v >>>= 7; }
  out.push(v);
  return Buffer.from(out);
}

function field(tagByte: number, value: string): Buffer {
  const b = Buffer.from(value, "utf8");
  return Buffer.concat([Buffer.from([tagByte]), varint(b.length), b]);
}

/** CastMessage : version 0, source, destination, espace de noms, type 0 (texte), contenu JSON. */
export function encodeMessage(source: string, destination: string, namespace: string, payload: unknown): Buffer {
  const body = Buffer.concat([
    Buffer.from([0x08, 0x00]),
    field(0x12, source),
    field(0x1a, destination),
    field(0x22, namespace),
    Buffer.from([0x28, 0x00]),
    field(0x32, JSON.stringify(payload)),
  ]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(body.length);
  return Buffer.concat([len, body]);
}

export interface CastFrame { source: string; destination: string; namespace: string; data: Record<string, unknown> | null }

export function decodeMessage(body: Buffer): CastFrame {
  const frame: CastFrame = { source: "", destination: "", namespace: "", data: null };
  let pos = 0;
  const readVarint = () => {
    let shift = 0, result = 0;
    while (pos < body.length) {
      const byte = body[pos++];
      result += (byte & 0x7f) * 2 ** shift;
      if ((byte & 0x80) === 0) break;
      shift += 7;
    }
    return result;
  };
  while (pos < body.length) {
    const key = readVarint();
    const fieldNo = key >>> 3, wire = key & 7;
    if (wire === 0) { readVarint(); continue; }
    if (wire !== 2) break;
    const len = readVarint();
    const value = body.subarray(pos, pos + len);
    pos += len;
    if (fieldNo === 2) frame.source = value.toString("utf8");
    else if (fieldNo === 3) frame.destination = value.toString("utf8");
    else if (fieldNo === 4) frame.namespace = value.toString("utf8");
    else if (fieldNo === 6) {
      try { frame.data = JSON.parse(value.toString("utf8")); } catch { frame.data = null; }
    }
  }
  return frame;
}

export interface CastMediaStatus {
  playerState: string;
  currentTime: number;
  duration: number;
  idleReason?: string;
}

/** Une session vers un appareil Cast. Émet « status » (CastMediaStatus) et « close ». */
export class CastSession extends EventEmitter {
  private socket: tls.TLSSocket | null = null;
  private buffer = Buffer.alloc(0);
  private requestId = 1;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private transportId: string | null = null;
  private appSessionId: string | null = null;
  private mediaSessionId: number | null = null;
  private waiters = new Map<number, (data: Record<string, unknown>) => void>();
  private lastMediaDuration = 0;

  constructor(private host: string, private port: number) {
    super();
  }

  get connected(): boolean {
    return !!this.socket && !this.socket.destroyed;
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    await new Promise<void>((resolve, reject) => {
      // Les appareils Cast présentent un certificat autosigné : c'est la norme du protocole.
      const socket = tls.connect({ host: this.host, port: this.port, rejectUnauthorized: false, timeout: 8000 }, () => resolve());
      socket.once("error", reject);
      socket.on("timeout", () => socket.destroy(new Error("cast_timeout")));
      socket.on("data", (chunk: Buffer | string) => this.onData(typeof chunk === "string" ? Buffer.from(chunk) : chunk));
      socket.on("close", () => this.shutdown());
      this.socket = socket;
    });
    this.socket?.removeAllListeners("error");
    this.socket?.on("error", () => this.shutdown());
    this.socket?.setTimeout(0);
    this.send("receiver-0", NS_CONNECTION, { type: "CONNECT" });
    this.heartbeat = setInterval(() => this.send("receiver-0", NS_HEARTBEAT, { type: "PING" }), 5000);
  }

  private shutdown() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    if (this.socket && !this.socket.destroyed) this.socket.destroy();
    this.socket = null;
    this.transportId = null;
    this.mediaSessionId = null;
    for (const wake of this.waiters.values()) wake({ type: "CLOSED" });
    this.waiters.clear();
    this.emit("close");
  }

  close() {
    this.shutdown();
  }

  private send(destination: string, namespace: string, payload: Record<string, unknown>) {
    if (!this.socket || this.socket.destroyed) return;
    this.socket.write(encodeMessage(SENDER, destination, namespace, payload));
  }

  private request(destination: string, namespace: string, payload: Record<string, unknown>, timeoutMs = 10_000): Promise<Record<string, unknown>> {
    const id = this.requestId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiters.delete(id);
        reject(new Error("cast_no_reply"));
      }, timeoutMs);
      this.waiters.set(id, (data) => {
        clearTimeout(timer);
        this.waiters.delete(id);
        if (data.type === "CLOSED") reject(new Error("cast_closed"));
        else resolve(data);
      });
      this.send(destination, namespace, { ...payload, requestId: id });
    });
  }

  private onData(chunk: Buffer) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (this.buffer.length >= 4) {
      const len = this.buffer.readUInt32BE(0);
      if (len > 1_000_000) { this.shutdown(); return; }
      if (this.buffer.length < 4 + len) break;
      const frame = decodeMessage(this.buffer.subarray(4, 4 + len));
      this.buffer = this.buffer.subarray(4 + len);
      this.onFrame(frame);
    }
  }

  private onFrame(frame: CastFrame) {
    const data = frame.data;
    if (!data) return;
    if (frame.namespace === NS_HEARTBEAT && data.type === "PING") {
      this.send(frame.source, NS_HEARTBEAT, { type: "PONG" });
      return;
    }
    if (frame.namespace === NS_CONNECTION && data.type === "CLOSE" && frame.source === this.transportId) {
      this.transportId = null;
      this.mediaSessionId = null;
      this.emit("status", { playerState: "IDLE", currentTime: 0, duration: 0, idleReason: "CLOSED" } satisfies CastMediaStatus);
      return;
    }
    if (frame.namespace === NS_MEDIA && data.type === "MEDIA_STATUS") {
      const status = (data.status as Record<string, unknown>[] | undefined)?.[0];
      if (status) {
        if (typeof status.mediaSessionId === "number") this.mediaSessionId = status.mediaSessionId;
        const media = status.media as { duration?: number } | undefined;
        if (typeof media?.duration === "number" && media.duration > 0) this.lastMediaDuration = media.duration;
        this.emit("status", {
          playerState: String(status.playerState ?? "IDLE"),
          currentTime: Number(status.currentTime ?? 0),
          duration: this.lastMediaDuration,
          ...(typeof status.idleReason === "string" ? { idleReason: status.idleReason } : {}),
        } satisfies CastMediaStatus);
      }
    }
    const id = typeof data.requestId === "number" ? data.requestId : null;
    if (id !== null) this.waiters.get(id)?.(data);
  }

  /** Lance le lecteur par défaut s'il ne tourne pas déjà, et s'y connecte. */
  private async ensureApp(): Promise<string> {
    if (this.transportId) return this.transportId;
    const status = await this.request("receiver-0", NS_RECEIVER, { type: "GET_STATUS" });
    let app = ((status.status as { applications?: { appId: string; transportId: string; sessionId?: string }[] })?.applications ?? []).find((a) => a.appId === DEFAULT_MEDIA_RECEIVER);
    if (!app) {
      const launched = await this.request("receiver-0", NS_RECEIVER, { type: "LAUNCH", appId: DEFAULT_MEDIA_RECEIVER }, 20_000);
      app = ((launched.status as { applications?: { appId: string; transportId: string; sessionId?: string }[] })?.applications ?? []).find((a) => a.appId === DEFAULT_MEDIA_RECEIVER);
    }
    if (!app?.transportId) throw new Error("cast_launch_failed");
    this.transportId = app.transportId;
    this.appSessionId = app.sessionId ?? null;
    this.send(app.transportId, NS_CONNECTION, { type: "CONNECT" });
    return app.transportId;
  }

  async load(url: string, opts: { title: string; posterUrl: string | null; contentType: string; durationSec: number | null }): Promise<void> {
    await this.connect();
    const transport = await this.ensureApp();
    this.lastMediaDuration = opts.durationSec ?? 0;
    const reply = await this.request(transport, NS_MEDIA, {
      type: "LOAD",
      autoplay: true,
      currentTime: 0,
      media: {
        contentId: url,
        contentUrl: url,
        contentType: opts.contentType,
        streamType: "BUFFERED",
        ...(opts.durationSec ? { duration: opts.durationSec } : {}),
        metadata: { metadataType: 0, title: opts.title, ...(opts.posterUrl ? { images: [{ url: opts.posterUrl }] } : {}) },
      },
    }, 30_000);
    if (reply.type === "LOAD_FAILED" || reply.type === "LOAD_CANCELLED" || reply.type === "INVALID_REQUEST") throw new Error(`cast_${String(reply.type).toLowerCase()}`);
  }

  private async media(type: "PLAY" | "PAUSE" | "STOP" | "SEEK" | "GET_STATUS", extra: Record<string, unknown> = {}) {
    if (!this.transportId) return;
    await this.request(this.transportId, NS_MEDIA, { type, ...(this.mediaSessionId !== null ? { mediaSessionId: this.mediaSessionId } : {}), ...extra });
  }

  play() { return this.media("PLAY"); }
  pause() { return this.media("PAUSE"); }
  seek(seconds: number) { return this.media("SEEK", { currentTime: seconds }); }
  refresh() { return this.media("GET_STATUS"); }

  async stop() {
    await this.media("STOP").catch(() => {});
    // Ferme le lecteur Google sur l'écran : il revient à son écran d'accueil.
    if (this.appSessionId) await this.request("receiver-0", NS_RECEIVER, { type: "STOP", sessionId: this.appSessionId }).catch(() => {});
    this.close();
  }
}
