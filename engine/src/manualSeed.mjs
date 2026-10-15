import path from "node:path";
import fsp from "node:fs/promises";
import { TORRENT_CACHE_DIR, CONFIG_DIR } from "./config.mjs";

const validHash = (hash) => /^[a-f0-9]{40}$/i.test(hash);
const within = (root, file) => {
  const relative = path.relative(root, file);
  return !!relative && relative !== ".." && !relative.startsWith(".." + path.sep) && !path.isAbsolute(relative);
};

export function torrentPath(value) {
  if (typeof value !== "string") return null;
  const parts = value.replaceAll("\\", "/").split("/");
  if (parts.some((p) => !p || p === "." || p === ".." || /[:\0]/.test(p))) return null;
  return parts.join("/");
}

export async function cacheMetainfo(hash, bytes) {
  if (!validHash(hash) || !bytes?.length) return;
  await fsp.mkdir(TORRENT_CACHE_DIR, { recursive: true });
  await fsp.writeFile(path.join(TORRENT_CACHE_DIR, `${hash.toLowerCase()}.torrent`), bytes);
}

/** Preserve native clients' metainfo before their download directory is swept. */
export async function retainMetainfo(cfg, hash, bytes) {
  if (!validHash(hash)) return;
  if (bytes?.length) return cacheMetainfo(hash, bytes);
  const name = `${hash.toLowerCase()}.torrent`;
  const target = path.join(TORRENT_CACHE_DIR, name);
  if (await fsp.access(target).then(() => true, () => false)) return;
  for (const candidate of [path.join(cfg.downloadPath, name), path.join(CONFIG_DIR, "rtorrent", cfg.id, `${hash.toUpperCase()}.torrent`)]) {
    try { await cacheMetainfo(hash, await fsp.readFile(candidate)); return; } catch { /* another client may own the metadata */ }
  }
}

/** Chunk-store contract used by WebTorrent: no mkdir, write, truncate or delete. */
export class ReadOnlySeedStore {
  constructor(chunkLength, opts) {
    this.chunkLength = chunkLength;
    this.length = opts.length;
    this.closed = false;
    this.roots = opts.roots.filter(Boolean);
    this.fingerprints = new Map();
    this.onInvalid = opts.onInvalid;
    this.files = opts.files.map((file) => {
      const key = torrentPath(file.path);
      const mapped = key && opts.mapping.get(key);
      const fallback = !opts.imported && key ? path.resolve(opts.downloadPath, key) : null;
      return { offset: file.offset, length: file.length, path: mapped ?? fallback };
    });
  }

  get(index, opts, cb) {
    if (typeof opts === "function") { cb = opts; opts = {}; }
    this._read(index, opts ?? {}).then((bytes) => cb(null, bytes), (error) => { this.onInvalid?.(); cb(error); });
  }

  async _read(index, opts) {
    if (this.closed) throw new Error("seed_store_closed");
    const start = index * this.chunkLength + (opts.offset ?? 0);
    const length = opts.length ?? Math.min(this.chunkLength - (opts.offset ?? 0), this.length - start);
    if (!Number.isInteger(index) || index < 0 || length <= 0 || start + length > this.length) throw new Error("seed_invalid_range");
    const result = Buffer.alloc(length);
    let copied = 0;
    for (const file of this.files) {
      const from = Math.max(start, file.offset), to = Math.min(start + length, file.offset + file.length);
      if (to <= from) continue;
      if (!file.path) throw new Error("seed_file_missing");
      const real = await fsp.realpath(file.path);
      const roots = await Promise.all(this.roots.map((root) => fsp.realpath(root).catch(() => null)));
      if (!roots.some((root) => root && within(root, real))) throw new Error("seed_path_outside_library");
      const handle = await fsp.open(real, "r");
      try {
        const stat = await handle.stat();
        if (!stat.isFile() || stat.size !== file.length) throw new Error("seed_file_changed");
        const fingerprint = `${real}:${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}:${stat.ctimeMs}`;
        const previous = this.fingerprints.get(file.path);
        if (previous && previous !== fingerprint) throw new Error("seed_file_changed");
        this.fingerprints.set(file.path, fingerprint);
        let done = 0;
        while (done < to - from) {
          const { bytesRead } = await handle.read(result, from - start + done, to - from - done, from - file.offset + done);
          if (!bytesRead) throw new Error("seed_file_incomplete");
          done += bytesRead;
        }
        const after = await handle.stat();
        if (after.mtimeMs !== stat.mtimeMs || after.ctimeMs !== stat.ctimeMs || after.size !== stat.size) throw new Error("seed_file_changed");
        copied += done;
      } finally { await handle.close(); }
    }
    if (copied !== length || this.closed) throw new Error("seed_file_missing");
    return result;
  }

  put(index, bytes, cb) { queueMicrotask(() => cb?.(new Error("seed_read_only"))); }
  close(cb) { this.closed = true; queueMicrotask(() => cb?.(null)); }
  destroy(cb) { this.close(cb); }
}

/** Independent of download/import callbacks: manual seeds can never reimport or repair files. */
export class ManualSeed {
  constructor(cfg, getClient, onChange) {
    this.cfg = cfg;
    this.getClient = getClient;
    this.onChange = onChange;
    this.sessions = new Map();
  }

  report(hash) {
    const session = this.sessions.get(hash);
    if (!session) return null;
    return { ...session.status, uploadSpeed: session.torrent?.uploadSpeed ?? 0, numPeers: session.torrent?.numPeers ?? 0, uploaded: session.torrent?.uploaded ?? 0, ratio: session.torrent?.ratio ?? 0 };
  }

  start(rec) {
    if (this.destroyed) return false;
    const hash = rec.infoHash.toLowerCase();
    if (!validHash(hash)) return false;
    if (["verifying", "full", "partial"].includes(this.sessions.get(hash)?.status.state)) return true;
    const session = { status: { state: "verifying", verifiedBytes: 0, totalBytes: rec.size ?? 0 } };
    this.sessions.set(hash, session);
    this.onChange();
    session.pending = this._start(rec, hash, session).catch(async () => {
      if (this.sessions.get(hash) !== session) return;
      session.status = { ...session.status, state: "unavailable", reason: "unavailable" };
      await this._detach(session).catch(() => {});
      this.onChange();
    });
    return true;
  }

  async _start(rec, hash, session) {
    const fail = async (reason) => {
      if (this.sessions.get(hash) !== session) return;
      session.status = { ...session.status, state: "unavailable", reason };
      await this._detach(session).catch(() => {});
      this.onChange();
    };
    const mapping = new Map();
    for (const file of rec.movedFiles ?? []) {
      const key = torrentPath(file.originalPath);
      if (key && typeof file.path === "string" && path.isAbsolute(file.path)) mapping.set(key, file.path);
    }
    if (rec.movedTo && !mapping.size) return fail("paths");
    let source;
    try { source = await fsp.readFile(path.join(TORRENT_CACHE_DIR, `${hash}.torrent`)); }
    catch { source = rec.magnetURI; }
    if (!source) return fail("metadata");
    const client = await this.getClient();
    if (this.sessions.get(hash) !== session) return;
    session.client = client;
    const t = client.add(source, {
      store: ReadOnlySeedStore,
      storeOpts: { mapping, imported: !!rec.movedTo, roots: [this.cfg.completedPath, this.cfg.downloadPath], downloadPath: this.cfg.downloadPath,
        onInvalid: () => { if (["full", "partial"].includes(session.status.state)) void fail("files"); },
      },
      deselect: true, skipVerify: false, storeCacheSlots: 0,
    });
    session.torrent = t;
    session.timer = setTimeout(() => { void fail("metadata"); }, 180_000);
    t.on("metadata", () => {
      clearTimeout(session.timer);
      if (t.infoHash !== hash) { void fail("metadata"); return; }
      session.status.totalBytes = t.length;
      cacheMetainfo(hash, t.torrentFile).catch(() => {});
    });
    t.on("verified", (index) => {
      session.status.verifiedBytes += Math.min(t.pieceLength, t.length - index * t.pieceLength);
      if (Date.now() - (session.lastUpdate ?? 0) > 1000) { session.lastUpdate = Date.now(); this.onChange(); }
    });
    t.on("ready", () => {
      clearTimeout(session.timer);
      if (this.sessions.get(hash) !== session || session.status.state !== "verifying") return;
      if (t.infoHash !== hash) { void fail("metadata"); return; }
      // Count only hash-verified pieces, including pieces crossing file boundaries.
      let verifiedBytes = 0;
      for (let i = 0; i < t.pieces.length; i++) if (t.bitfield.get(i)) verifiedBytes += Math.min(t.pieceLength, t.length - i * t.pieceLength);
      if (!verifiedBytes) { void fail("files"); return; }
      session.status = { state: verifiedBytes === t.length ? "full" : "partial", verifiedBytes, totalBytes: t.length };
      this.onChange();
    });
    t.on("error", () => { void fail("unavailable"); });
    // Never wire download selection, stall recovery, completion or import handlers here.
  }

  async _detach(session) {
    clearTimeout(session.timer);
    const t = session.torrent;
    if (t && !t.destroyed) await new Promise((resolve, reject) => session.client.remove(t, { destroyStore: false }, (err) => err ? reject(err) : resolve()));
    session.torrent = null;
  }

  async stop(hash) {
    const session = this.sessions.get(hash);
    if (!session) return true;
    // Invalidate pending startup before awaiting I/O; it must never resurrect a stopped seed.
    this.sessions.delete(hash);
    try { await this._detach(session); }
    catch { this.sessions.set(hash, session); return false; }
    this.onChange();
    return true;
  }

  async destroy() { this.destroyed = true; await Promise.all([...this.sessions.keys()].map((hash) => this.stop(hash))); }
}
