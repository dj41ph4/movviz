/**
 * Tampon profond pour le flux fMP4 produit par ffmpeg (remux/transcodage).
 *
 * Un `<video src>` sur ce flux (réponse 200 en morceaux, sans longueur) n'est
 * pas lu plus de ~2,5 s à l'avance par Chrome : la moindre pause du serveur ou
 * du réseau vide le tampon (mesuré en prod le 2026-11-05, reproduit avec un
 * serveur de test local). Ici le flux est lu par fetch et injecté dans un
 * SourceBuffer MSE, ce qui permet de garder plusieurs dizaines de secondes
 * d'avance. Tout cas non pris en charge (codec inconnu, MSE absent, erreur
 * d'ajout) rend la main au chemin natif `video.src` — voir FfmpegRemuxEngine.
 */

const FORWARD_MAX_SEC = 90;
const FORWARD_MIN_SEC = 20;
/** Budget mémoire visé pour le tampon avant, selon le débit réel du flux. */
const FORWARD_BYTES = 48 * 1024 * 1024;
const BACK_KEEP_SEC = 20;
const BACK_TRIM_AFTER_SEC = 30;
const OPEN_TIMEOUT_MS = 6000;

export type DeepBufferFailure = "network" | "append" | "codec";

const FOURCC = (b: Uint8Array, o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
const u32 = (b: Uint8Array, o: number) => ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0;
const hex2 = (n: number) => n.toString(16).padStart(2, "0");

interface Box {
  type: string;
  start: number;
  /** Début du contenu (après l'en-tête). */
  body: number;
  end: number;
}

/** Boîtes ISO-BMFF contenues dans [from, to). S'arrête à la première boîte invalide. */
function boxes(b: Uint8Array, from: number, to: number): Box[] {
  const out: Box[] = [];
  let o = from;
  while (o + 8 <= to) {
    let size = u32(b, o);
    const type = FOURCC(b, o + 4);
    let header = 8;
    if (size === 1) {
      if (o + 16 > to) break;
      size = u32(b, o + 8) * 4294967296 + u32(b, o + 12);
      header = 16;
    } else if (size === 0) size = to - o;
    if (size < header || o + size > to) break;
    out.push({ type, start: o, body: o + header, end: o + size });
    o += size;
  }
  return out;
}

function child(b: Uint8Array, parent: Box, type: string, skip = 0): Box | undefined {
  return boxes(b, parent.body + skip, parent.end).find((x) => x.type === type);
}

function hevcCodec(entry: string, b: Uint8Array, o: number): string | null {
  // hvcC : version(1) | space(2)+tier(1)+profile(5) | compat(4) | constraints(6) | level(1)
  if (o + 13 > b.length) return null;
  const space = ["", "A", "B", "C"][b[o + 1] >> 6];
  const tier = (b[o + 1] >> 5) & 1 ? "H" : "L";
  const profile = b[o + 1] & 0x1f;
  let compat = u32(b, o + 2);
  let rev = 0;
  for (let i = 0; i < 32; i++) { rev = (rev << 1) | (compat & 1); compat >>>= 1; }
  const constraints = [...b.slice(o + 6, o + 12)];
  while (constraints.length > 1 && constraints[constraints.length - 1] === 0) constraints.pop();
  return `${entry}.${space}${profile}.${(rev >>> 0).toString(16)}.${tier}${b[o + 12]}.${constraints.map((c) => c.toString(16).toUpperCase()).join(".")}`;
}

function audioObjectType(b: Uint8Array, esds: Box): string | null {
  // esds : version/flags(4) puis descripteurs (tag, taille variable)
  let o = esds.body + 4;
  const readLen = () => {
    let len = 0;
    for (let i = 0; i < 4 && o < esds.end; i++) {
      const c = b[o++];
      len = (len << 7) | (c & 0x7f);
      if (!(c & 0x80)) break;
    }
    return len;
  };
  if (b[o++] !== 0x03) return null;
  readLen();
  o += 2; // ES_ID
  const flags = b[o++];
  if (flags & 0x80) o += 2;
  if (flags & 0x40) o += 1 + b[o];
  if (flags & 0x20) o += 2;
  if (b[o++] !== 0x04) return null;
  readLen();
  const oti = b[o];
  o += 13; // objectType(1) streamType(1) bufferSize(3) maxBitrate(4) avgBitrate(4)
  if (oti === 0x6b) return "mp3";
  if (b[o++] !== 0x05) return oti === 0x40 ? "mp4a.40.2" : null;
  readLen();
  let aot = b[o] >> 3;
  if (aot === 31) aot = 32 + (((b[o] & 7) << 3) | (b[o + 1] >> 5));
  return `mp4a.${hex2(oti).replace(/^0/, "")}.${aot}`;
}

/** Type MIME MSE (avec codecs) déduit du segment d'initialisation, ou null si un codec n'est pas pris en charge. */
export function mimeFromInit(init: Uint8Array): string | null {
  const moov = boxes(init, 0, init.length).find((x) => x.type === "moov");
  if (!moov) return null;
  const codecs: string[] = [];
  for (const trak of boxes(init, moov.body, moov.end).filter((x) => x.type === "trak")) {
    const mdia = child(init, trak, "mdia");
    const minf = mdia && child(init, mdia, "minf");
    const stbl = minf && child(init, minf, "stbl");
    const stsd = stbl && child(init, stbl, "stsd");
    if (!stsd) return null;
    const entry = boxes(init, stsd.body + 8, stsd.end)[0];
    if (!entry) return null;
    if (entry.type === "avc1" || entry.type === "avc3") {
      const avcC = child(init, entry, "avcC", 78);
      if (!avcC) return null;
      codecs.push(`${entry.type}.${hex2(init[avcC.body + 1])}${hex2(init[avcC.body + 2])}${hex2(init[avcC.body + 3])}`);
    } else if (entry.type === "hvc1" || entry.type === "hev1") {
      const hvcC = child(init, entry, "hvcC", 78);
      const c = hvcC && hevcCodec(entry.type, init, hvcC.body);
      if (!c) return null;
      codecs.push(c);
    } else if (entry.type === "mp4a") {
      const esds = child(init, entry, "esds", 28);
      const c = esds && audioObjectType(init, esds);
      if (!c) return null;
      codecs.push(c);
    } else if (entry.type === "ac-3") codecs.push("ac-3");
    else if (entry.type === "ec-3") codecs.push("ec-3");
    else if (entry.type === "Opus") codecs.push("opus");
    else if (entry.type === "fLaC") codecs.push("flac");
    else return null;
  }
  return codecs.length ? `video/mp4; codecs="${codecs.join(",")}"` : null;
}

class ChunkQueue {
  private chunks: Uint8Array[] = [];
  length = 0;
  push(c: Uint8Array) { if (c.byteLength) { this.chunks.push(c); this.length += c.byteLength; } }
  /** Copie les n premiers octets sans les retirer (à la position `at`). */
  peek(n: number, at = 0): Uint8Array {
    const out = new Uint8Array(n);
    let skip = at, w = 0;
    for (const c of this.chunks) {
      if (skip >= c.byteLength) { skip -= c.byteLength; continue; }
      const take = Math.min(c.byteLength - skip, n - w);
      out.set(c.subarray(skip, skip + take), w);
      w += take; skip = 0;
      if (w === n) break;
    }
    return out;
  }
  take(n: number): Uint8Array {
    const out = this.peek(n);
    let left = n;
    while (left > 0) {
      const c = this.chunks[0];
      if (c.byteLength <= left) { left -= c.byteLength; this.chunks.shift(); }
      else { this.chunks[0] = c.subarray(left); left = 0; }
    }
    this.length -= n;
    return out;
  }
}

function boxSizeAt(q: ChunkQueue, at: number): { size: number; type: string } | null {
  if (q.length < at + 8) return null;
  const h = q.peek(8, at);
  let size = u32(h, 0);
  if (size === 1) {
    if (q.length < at + 16) return null;
    const l = q.peek(16, at);
    size = u32(l, 8) * 4294967296 + u32(l, 12);
  }
  if (size < 8) throw new Error("boîte MP4 invalide");
  return { size, type: FOURCC(h, 4) };
}

export function deepBufferSupported(): boolean {
  try {
    if (localStorage.getItem("movviz.deepBuffer") === "0") return false;
  } catch { /* stockage indisponible */ }
  return typeof window !== "undefined" && typeof window.MediaSource === "function" && typeof fetch === "function";
}

export class DeepBufferFeed {
  private ms: MediaSource | null = null;
  private sb: SourceBuffer | null = null;
  private objectUrl: string | null = null;
  private ctrl = new AbortController();
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private queue = new ChunkQueue();
  private stopped = false;
  private appendedBytes = 0;
  private firstStart: number | null = null;
  private onFailure: (reason: string, kind: DeepBufferFailure) => void = () => void 0;

  constructor(private video: HTMLVideoElement, private url: string) {}

  /**
   * true : le flux alimente le `<video>` (la lecture peut démarrer). false :
   * rien n'est attaché, l'appelant doit lire l'URL en natif.
   */
  async start(onFailure: (reason: string, kind: DeepBufferFailure) => void): Promise<boolean> {
    this.onFailure = onFailure;
    try {
      const res = await fetch(this.url, { cache: "no-store", signal: this.ctrl.signal });
      if (!res.ok || !res.body) return this.giveUp();
      this.reader = res.body.getReader();
      const init = await this.readInit();
      if (!init) return this.giveUp();
      const mime = mimeFromInit(init);
      if (!mime || !MediaSource.isTypeSupported(mime)) return this.giveUp();

      const ms = new MediaSource();
      this.ms = ms;
      this.objectUrl = URL.createObjectURL(ms);
      this.video.src = this.objectUrl;
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("sourceopen trop long")), OPEN_TIMEOUT_MS);
        ms.addEventListener("sourceopen", () => { clearTimeout(t); resolve(); }, { once: true });
      });
      const sb = ms.addSourceBuffer(mime);
      sb.mode = "segments";
      this.sb = sb;
      await this.append(init);
      void this.pump();
      return true;
    } catch {
      if (this.stopped) return false;
      return this.giveUp();
    }
  }

  private giveUp(): false {
    this.stop();
    return false;
  }

  /** Plage lue [début, fin] en secondes de l'élément, ou null. */
  bufferedRange(): [number, number] | null {
    const t = this.video.currentTime;
    const b = this.video.buffered;
    for (let i = 0; i < b.length; i++) if (t >= b.start(i) - 0.3 && t <= b.end(i)) return [b.start(i), b.end(i)];
    return null;
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    try { this.ctrl.abort(); } catch { /* déjà coupé */ }
    try { void this.reader?.cancel(); } catch { /* ignore */ }
    if (this.objectUrl) { try { URL.revokeObjectURL(this.objectUrl); } catch { /* ignore */ } this.objectUrl = null; }
  }

  private fail(e: unknown, kind: DeepBufferFailure): void {
    if (this.stopped) return;
    const reason = e instanceof Error ? e.message : String(e);
    this.stop();
    this.onFailure(reason, kind);
  }

  private async fill(): Promise<boolean> {
    const r = await this.reader!.read();
    if (r.done) return false;
    this.queue.push(r.value);
    return true;
  }

  private async readInit(): Promise<Uint8Array | null> {
    let need = -1;
    for (;;) {
      let at = 0, ok = true;
      let sawMoov = false;
      while (ok) {
        const h = boxSizeAt(this.queue, at);
        if (!h) { ok = false; break; }
        if (h.type === "moof") return null; // pas de moov avant les fragments
        at += h.size;
        if (h.type === "moov") { sawMoov = true; need = at; break; }
      }
      if (sawMoov && this.queue.length >= need) return this.queue.take(need);
      if (!(await this.fill())) return null;
    }
  }

  private async nextFragment(): Promise<Uint8Array | null> {
    for (;;) {
      const h = boxSizeAt(this.queue, 0);
      if (h && h.type !== "moof") {
        if (this.queue.length >= h.size) { this.queue.take(h.size); continue; }
      } else if (h) {
        const d = boxSizeAt(this.queue, h.size);
        if (d && this.queue.length >= h.size + d.size) return this.queue.take(h.size + d.size);
      }
      if (!(await this.fill())) return null;
    }
  }

  private ahead(): number {
    const v = this.video;
    const b = v.buffered;
    if (!b.length) return 0;
    const t = v.currentTime;
    for (let i = 0; i < b.length; i++) if (t >= b.start(i) - 0.3 && t <= b.end(i)) return b.end(i) - t;
    return b.end(b.length - 1) - b.start(b.length - 1);
  }

  private forwardLimit(): number {
    const b = this.video.buffered;
    if (this.firstStart === null || !b.length) return FORWARD_MAX_SEC;
    const span = b.end(b.length - 1) - this.firstStart;
    if (span < 5) return FORWARD_MAX_SEC;
    const bytesPerSec = this.appendedBytes / span;
    return Math.min(FORWARD_MAX_SEC, Math.max(FORWARD_MIN_SEC, FORWARD_BYTES / bytesPerSec));
  }

  private idle(): Promise<void> {
    const sb = this.sb!;
    if (!sb.updating) return Promise.resolve();
    return new Promise((resolve) => sb.addEventListener("updateend", () => resolve(), { once: true }));
  }

  private async op(run: () => void): Promise<void> {
    const sb = this.sb!;
    await this.idle();
    await new Promise<void>((resolve, reject) => {
      const done = () => { sb.removeEventListener("error", err); resolve(); };
      const err = () => { sb.removeEventListener("updateend", done); reject(new Error("erreur SourceBuffer")); };
      sb.addEventListener("updateend", done, { once: true });
      sb.addEventListener("error", err, { once: true });
      try { run(); } catch (e) { sb.removeEventListener("updateend", done); sb.removeEventListener("error", err); reject(e); }
    });
  }

  private async append(data: Uint8Array): Promise<void> {
    const sb = this.sb!;
    try {
      await this.op(() => sb.appendBuffer(data as BufferSource));
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "QuotaExceededError")) throw e;
      // Plus de place : libérer ce qui est déjà lu, puis réessayer une fois.
      const t = this.video.currentTime;
      const b = sb.buffered;
      if (!b.length || t - b.start(0) < 2) throw e;
      await this.op(() => sb.remove(b.start(0), Math.max(b.start(0) + 1, t - 3)));
      await this.op(() => sb.appendBuffer(data as BufferSource));
    }
    this.appendedBytes += data.byteLength;
    const b = sb.buffered;
    if (b.length && this.firstStart === null) {
      this.firstStart = b.start(0);
      if (this.video.currentTime < this.firstStart) this.video.currentTime = this.firstStart;
    }
  }

  private async trimBack(): Promise<void> {
    const sb = this.sb!;
    const b = sb.buffered;
    const t = this.video.currentTime;
    if (!b.length || t - b.start(0) < BACK_TRIM_AFTER_SEC) return;
    await this.op(() => sb.remove(b.start(0), t - BACK_KEEP_SEC));
  }

  private async pump(): Promise<void> {
    try {
      while (!this.stopped) {
        const limit = this.forwardLimit();
        if (this.ahead() > limit) {
          // Ne plus lire : ffmpeg se bloque sur son tube jusqu'à ce que la lecture avance.
          while (!this.stopped && this.ahead() > limit * 0.75) await new Promise((r) => setTimeout(r, 400));
          continue;
        }
        let frag: Uint8Array | null;
        try {
          frag = await this.nextFragment();
        } catch (e) {
          if (this.stopped) return;
          return this.fail(e, "network");
        }
        if (this.stopped) return;
        if (!frag) break;
        await this.append(frag);
        await this.trimBack();
      }
      if (this.stopped) return;
      await this.idle();
      if (this.ms && this.ms.readyState === "open") this.ms.endOfStream();
    } catch (e) {
      this.fail(e, "append");
    }
  }
}
