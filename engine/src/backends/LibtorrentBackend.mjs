import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import net from "node:net";
import { AbstractBackend } from "./AbstractBackend.mjs";
import { CONFIG_DIR } from "../config.mjs";

const BIN_NAME = process.platform === "win32" ? "rtorrent.exe" : "rtorrent";

/**
 * Libtorrent backend (Alpha) — spawns rtorrent (libtorrent-rasterbar) and
 * controls it via XMLRPC over SCGI (TCP). SCGI + XMLRPC implemented inline,
 * zero external dependencies.
 *
 * Falls back to no-op stub if rtorrent is not on PATH.
 */
export class LibtorrentBackend extends AbstractBackend {
  constructor(cfg, deps) {
    super(cfg, deps);
    this._scgiPort = 0;
    this._process = null;
    this._available = false;
    this._infoHashToId = new Map();   // lowercase infoHash → rtorrent hash (uppercase)
    this._idToInfoHash = new Map();   // rtorrent hash → lowercase infoHash
    this._cachedHandles = new Map();
    this._completedIds = new Set();
    this._handlePromises = new Map(); // infoHash → { resolve, reject, timer }
    this._scgiTimeout = 15_000;
  }

  get _clientPollIntervalMs() { return 2500; }

  // ─── Binary discovery ─────────────────────────────────────────────────

  _findBinary() {
    const paths = process.env.PATH?.split(path.delimiter) ?? [];
    for (const p of paths) {
      const c = path.join(p, BIN_NAME);
      if (fs.existsSync(c)) return c;
    }
    // Bundled paths
    for (const p of [path.join(process.cwd(), "bin", BIN_NAME), path.join(process.cwd(), "packaging", "rtorrent", BIN_NAME)]) {
      if (fs.existsSync(p)) return p;
    }
    return null;
  }

  // ─── Validation ───────────────────────────────────────────────────────

  _validateId() {
    if (!/^[a-z0-9_-]{1,32}$/i.test(this.cfg.id)) throw new Error(`Invalid instance id: ${this.cfg.id}`);
  }

  _escapeRc(v) { return String(v ?? "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"'); }

  // ─── Client lifecycle ─────────────────────────────────────────────────

  async _clientCreate() {
    this._validateId();
    const bin = this._findBinary();
    if (!bin) {
      console.log(`[engine:${this.cfg.id}][${this.cfg.logTag}] rtorrent not found — running in stub mode`);
      this._available = false;
      return;
    }

    if (!this.cfg.downloadPath || typeof this.cfg.downloadPath !== "string") {
      throw new Error("downloadPath must be a non-empty string");
    }

    this._scgiPort = await this._findFreePort();

    const sessionDir = path.join(CONFIG_DIR, "rtorrent", this.cfg.id);
    await fsp.mkdir(sessionDir, { recursive: true });

    // Sanitize values for RC file
    const escapedDownload = this._escapeRc(this.cfg.downloadPath);
    const escapedSession = this._escapeRc(sessionDir);
    const portLo = this.cfg.torrentPort >= 1024 && this.cfg.torrentPort <= 65535 ? this.cfg.torrentPort : 6881;
    const portHi = portLo;
    const maxPeers = Math.max(5, Math.min(this.cfg.maxPeers ?? 50, 500));
    const uploadSlots = Math.max(1, Math.min(this.cfg.uploadSlots ?? 50, 200));
    const ratio = Number(this.cfg.seedRatio) || 0;

    const rc = [
      `scgi_port = 127.0.0.1:${this._scgiPort}`,
      `directory.default.set = "${escapedDownload}"`,
      `session.path.set = "${escapedSession}"`,
      this.cfg.dht !== false ? "dht.mode.set = auto" : "dht.mode.set = disable",
      `protocol.pex.set = ${this.cfg.pex !== false ? 1 : 0}`,
      "protocol.encryption.set = allow_incoming,try_outgoing,enable_retry",
      `network.port_range.set = ${portLo}-${portHi}`,
      "network.max_open_files.set = 600",
      "network.max_open_sockets.set = 300",
      "pieces.hash.on_completion.set = 1",
      "session.use_lock.set = 0",
      `throttle.max_uploads.set = ${uploadSlots}`,
      `throttle.max_downloads_div.set = ${maxPeers}`,
      `throttle.max_uploads_div.set = ${maxPeers}`,
      `trackers.numwant.set = 80`,
      this.cfg.downloadLimitKbps ? `throttle.global_down.max_rate.set_kb = ${this.cfg.downloadLimitKbps}` : "",
      this.cfg.uploadLimitKbps ? `throttle.global_up.max_rate.set_kb = ${this.cfg.uploadLimitKbps}` : "",
      ratio > 0 ? `throttle.min_peers_seed.set = -1` : "",
      ratio > 0 ? `throttle.max_peers_seed.set = -1` : "",
      ratio > 0 ? `ratio.min.set = ${Math.round(ratio * 100)}` : "",
      ratio > 0 ? "ratio.enable =" : "",
    ].filter(Boolean).join("\n") + "\n";

    const rcPath = path.join(sessionDir, "rtorrent.rc");
    await fsp.writeFile(rcPath, rc);

    try {
      this._process = spawn(bin, ["-n", "-o", `import=${rcPath}`], {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, HOME: sessionDir },
      });
    } catch (e) {
      throw new Error(`Failed to spawn rtorrent (${bin}). ${process.platform === "win32" ? "Download from https://github.com/rakshasa/rtorrent and place rtorrent.exe in packaging/rtorrent/." : "Install with: apk add rtorrent (Alpine) or apt install rtorrent (Debian/Ubuntu)."}`);
    }

    this._process.stdout?.on("data", (d) => process.stdout.write(`[rtorrent:${this.cfg.id}] ${d}`));
    this._process.stderr?.on("data", (d) => process.stderr.write(`[rtorrent:${this.cfg.id}] ${d}`));

    this._process.on("exit", (code, signal) => {
      console.error(`[engine:${this.cfg.id}][${this.cfg.logTag}] rtorrent exited (code=${code}, signal=${signal})`);
      this._process = null;
      this._available = false;
    });

    await this._waitForScgi();
    this._available = true;
    console.log(`[engine:${this.cfg.id}][${this.cfg.logTag}] rtorrent ready on 127.0.0.1:${this._scgiPort}`);
  }

  async _clientDestroy() {
    for (const p of this._handlePromises.values()) { clearTimeout(p.timer); p.resolve(null); }
    this._handlePromises.clear();
    this._infoHashToId.clear();
    this._idToInfoHash.clear();
    this._cachedHandles.clear();
    this._completedIds.clear();
    if (this._process) {
      try {
        // Graceful shutdown via SCGI
        await this._scgiCall("system.shutdown.normal").catch(() => {});
        // Wait up to 3s then force kill
        await new Promise((r) => setTimeout(r, 3000));
        if (this._process) {
          try {
            if (process.platform === "win32") this._process.kill();
            else this._process.kill("SIGKILL");
          } catch {}
        }
      } catch {
        try {
          if (process.platform === "win32") this._process.kill();
          else this._process.kill("SIGKILL");
        } catch {}
      }
      this._process = null;
    }
    this._available = false;
  }

  // ─── SCGI + XMLRPC (zero deps) ────────────────────────────────────────

  _scgiCall(methodName, ...params) {
    return new Promise((resolve, reject) => {
      const body = this._buildXmlrpc(methodName, params);
      const header = 'CONTENT_LENGTH\x00' + Buffer.byteLength(body) + '\x00SCGI\x01\x00';
      const netstring = `${Buffer.byteLength(header)}:${header},${body}`;
      const buffer = Buffer.from(netstring, "utf8");
      const chunks = [];

      const client = net.createConnection({ host: "127.0.0.1", port: this._scgiPort, timeout: this._scgiTimeout }, () => {
        client.write(buffer);
        client.end();
      });

      const timer = setTimeout(() => { client.destroy(); reject(new Error("SCGI timeout")); }, this._scgiTimeout + 2000);

      client.on("data", (chunk) => chunks.push(chunk));
      client.on("end", () => {
        clearTimeout(timer);
        const response = Buffer.concat(chunks).toString("utf8");
        try {
          const result = this._parseXmlrpcResponse(response);
          resolve(result);
        } catch (e) { reject(e); }
      });
      client.on("error", (e) => { clearTimeout(timer); reject(e); });
      client.on("timeout", () => { clearTimeout(timer); client.destroy(); reject(new Error("SCGI timeout")); });
    });
  }

  _buildXmlrpc(methodName, params) {
    return '<?xml version="1.0"?>\n<methodCall>\n' +
      `  <methodName>${this._xmlEscape(methodName)}</methodName>\n` +
      (params.length ? '  <params>\n' + params.map((p) => `    <param>${this._xmlValue(p)}</param>`).join("\n") + '\n  </params>\n' : "") +
      '</methodCall>';
  }

  _xmlEscape(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  _xmlValue(v) {
    if (v === null || v === undefined) return "<value><nil/></value>";
    if (typeof v === "number") {
      if (!Number.isFinite(v)) return "<value><nil/></value>";
      if (v <= 2147483647 && v >= -2147483648) return `<value><i4>${v}</i4></value>`;
      return `<value><i8>${v}</i8></value>`;
    }
    if (typeof v === "boolean") return `<value><boolean>${v ? 1 : 0}</boolean></value>`;
    return `<value><string>${this._xmlEscape(String(v))}</string></value>`;
  }

  _parseXmlrpcResponse(xml) {
    // Fault check
    const fault = xml.match(/<fault>[\s\S]*?<value>([\s\S]*?)<\/value>[\s\S]*?<\/fault>/);
    if (fault) throw new Error(`rtorrent fault: ${this._parseXmlrpcScalar(fault[1])}`);

    // Empty response
    if (!/<params>/i.test(xml)) return null;

    const paramsMatch = xml.match(/<params>([\s\S]*?)<\/params>/);
    if (!paramsMatch) return null;

    const values = [];
    const paramRegex = /<param>([\s\S]*?)<\/param>/g;
    let m;
    while ((m = paramRegex.exec(paramsMatch[1])) !== null) {
      const valMatch = m[1].match(/<value>([\s\S]*?)<\/value>/);
      if (valMatch) values.push(this._parseXmlrpcNode(valMatch[1]));
    }
    return values.length === 1 ? values[0] : values;
  }

  _parseXmlrpcNode(inner) {
    inner = inner.trim();
    // nil
    if (/^<nil\/?>/i.test(inner)) return null;
    // string
    const strMatch = inner.match(/^<string>([\s\S]*?)<\/string>$/);
    if (strMatch) return strMatch[1];
    // i4 / int
    const intMatch = inner.match(/^<i4>([\s\S]*?)<\/i4>$/) || inner.match(/^<int>([\s\S]*?)<\/int>$/);
    if (intMatch) return parseInt(intMatch[1], 10) || 0;
    // i8
    const i8Match = inner.match(/^<i8>([\s\S]*?)<\/i8>$/);
    if (i8Match) return parseInt(i8Match[1], 10) || 0;
    // boolean
    const boolMatch = inner.match(/^<boolean>([01])<\/boolean>$/);
    if (boolMatch) return boolMatch[1] === "1";
    // array — depth-aware extraction
    if (inner.startsWith("<array>")) {
      const dataMatch = inner.match(/<array>[\s\S]*?<data>([\s\S]*?)<\/data>[\s\S]*?<\/array>/);
      if (dataMatch) {
        const items = [];
        const itemRegex = /<value>([\s\S]*?)<\/value>/g;
        let im;
        while ((im = itemRegex.exec(dataMatch[1])) !== null) items.push(this._parseXmlrpcNode(im[1]));
        return items;
      }
    }
    // Fallback: raw content
    return inner.replace(/<[^>]+>/g, "");
  }

  _parseXmlrpcScalar(inner) {
    const val = this._parseXmlrpcNode(inner);
    return typeof val === "string" ? val : (val != null ? String(val) : "nil");
  }

  async _waitForScgi() {
    for (let i = 0; i < 30; i++) {
      try { await this._scgiCall("system.client_version"); return; } catch {}
      await new Promise((r) => setTimeout(r, 250 * (1 + Math.floor(i / 5))));
    }
    throw new Error("rtorrent SCGI did not become ready within timeout");
  }

  _findFreePort() {
    return new Promise((resolve, reject) => {
      const srv = net.createServer();
      srv.listen(0, "127.0.0.1", () => { const port = srv.address().port; srv.close(() => resolve(port)); });
      srv.on("error", reject);
    });
  }

  // ─── Apply throttle ───────────────────────────────────────────────────

  _applyThrottle() {
    if (!this._available) return;
    const dl = this.cfg.downloadLimitKbps || 0;
    const ul = this.cfg.uploadLimitKbps || 0;
    if (dl) this._scgiCall("throttle.global_down.max_rate.set_kb", String(dl)).catch(() => {});
    if (ul) this._scgiCall("throttle.global_up.max_rate.set_kb", String(ul)).catch(() => {});
  }

  // ─── Multicall helpers ────────────────────────────────────────────────

  _doMulticall(view, fields) {
    return this._scgiCall(`d.multicall=${view},${fields.join(",")}`);
  }

  async _pollTorrents() {
    const fields = [
      "d.get_hash=", "d.get_name=", "d.get_size_bytes=", "d.get_completed_bytes=",
      "d.get_down_rate=", "d.get_up_rate=", "d.get_peers_accounted=", "d.get_ratio=",
      "d.get_state=", "d.is_active=", "d.get_complete=", "d.get_up_total=",
      "d.get_base_path=", "d.is_multi_file=",
      "d.get_chunks_hashed=", "d.get_chunks_size=",
    ];
    try { const rows = await this._doMulticall("main", fields); return Array.isArray(rows) ? rows : []; }
    catch { return []; }
  }

  _rowToHandle(row) {
    const hash = row[0], name = row[1];
    const sizeBytes = Number(row[2]) || 0, completedBytes = Number(row[3]) || 0;
    const downRate = Number(row[4]) || 0, upRate = Number(row[5]) || 0;
    const peers = Number(row[6]) || 0;
    const rRatio = Number(row[7]) || 0; // * 1000 in rtorrent
    const state = row[8];       // 0=stopped, 1=started
    const active = row[9];      // 0/1
    const complete = row[10];   // 0/1
    const basePath = row[12], isMulti = row[13];

    const total = sizeBytes;
    const completed = completedBytes;
    const done = complete === 1 || (total > 0 && completed >= total);

    // After an engine/server restart, rtorrent re-hashes the already-downloaded
    // pieces before resuming ("checking files") — chunks_hashed < chunks_size
    // while that phase runs. Exposed as "verifying" so the UI can show a
    // verification badge instead of a stalled/zero-speed download.
    const chunksHashed = Number(row[14]) || 0;
    const chunksSize = Number(row[15]) || 0;
    const verifying = !done && chunksSize > 0 && chunksHashed < chunksSize;

    const rHash = String(hash ?? "").toUpperCase();
    const infoHash = (hash ?? "").toString().toLowerCase();
    if (!infoHash || infoHash === "null") return { infoHash: "", name: "rtorrent", length: 0, downloaded: 0, downloadSpeed: 0, uploadSpeed: 0, numPeers: 0, ratio: 0, done: false, timeRemaining: null, magnetURI: null, files: [], status: "paused", isPaused: true, isWaiting: false, _raw: row };

    if (infoHash) {
      this._idToInfoHash.set(rHash, infoHash);
      this._infoHashToId.set(infoHash, rHash);
    }

    const displayName = String(name ?? infoHash).replace(/^.*[/\\]/, "").replace(/\.(mkv|mp4|avi|mov|wmv|flv|webm|ts|m2ts)$/i, "") || infoHash;

    // Build skeleton files — rtorrent d.multicall doesn't return file details.
    // For single-file torrents: one entry with the torrent name as file.
    // For multi-file torrents: marked so _clientSnapshot can enrich later.
    const files = [{ name: displayName, path: String(basePath ?? ""), length: total, downloaded: completed, selected: true }];

    return {
      infoHash, name: displayName, length: total, downloaded: completed,
      downloadSpeed: downRate, uploadSpeed: upRate,
      numPeers: peers,
      ratio: rRatio / 1000,
      done,
      timeRemaining: downRate > 0 ? ((total - completed) / downRate) * 1000 : null,
      magnetURI: null, files,
      status: verifying ? "verifying" : done ? "complete" : state === 0 ? "paused" : (active === 0 ? "stalled" : "active"),
      isPaused: state === 0,
      isWaiting: false,
      verifying,
      _raw: row,
    };
  }

  // ─── Polling ──────────────────────────────────────────────────────────

  async _clientPoll() {
    if (!this._available) return;
    try {
      const rows = await this._pollTorrents();
      for (const row of rows) {
        const h = this._rowToHandle(row);
        if (h.infoHash) this._cachedHandles.set(h.infoHash, h);
      }

      // Detect freshly completed
      for (const row of rows) {
        const hash = String(row[0] ?? "").toUpperCase();
        const infoHash = this._idToInfoHash.get(hash) ?? hash.toLowerCase();
        const done = row[10] === 1 || (Number(row[2]) > 0 && Number(row[3]) >= Number(row[2]));
        if (done && hash && !this._completedIds.has(hash)) {
          this._completedIds.add(hash);
          const m = this.meta.get(infoHash) ?? this.meta.get(hash);
          if (m && !m.completed) {
            this.onComplete(infoHash).catch((e) => console.error(`[engine:${this.cfg.id}][${this.cfg.logTag}] onComplete failed:`, e.message));
          } else if (m && m.completed) {
            this._finish(this._clientSnapshot(infoHash), true).catch((e) => console.error(`[engine:${this.cfg.id}][${this.cfg.logTag}] cleanup failed:`, e.message));
          }
        }
      }

      // Resolve pending add promises that were waiting for discovery
      for (const [key, p] of this._handlePromises) {
        const h = this._cachedHandles.get(key);
        if (h) { clearTimeout(p.timer); this._handlePromises.delete(key); p.resolve(h); }
      }

      // Prune stale completed ids
      const seenIds = new Set(rows.map((r) => String(r[0] ?? "").toUpperCase()).filter(Boolean));
      for (const id of this._completedIds) { if (!seenIds.has(id)) this._completedIds.delete(id); }
    } catch (e) {
      console.warn(`[engine:${this.cfg.id}][${this.cfg.logTag}] poll SCGI error:`, e?.message ?? e);
    }
  }

  // ─── Add / Remove / Pause / Resume ────────────────────────────────────

  async _clientAdd(torrentId, opts) {
    if (!this._available) {
      return { infoHash: opts.infoHash?.toLowerCase() ?? "alpha", name: opts.title ?? "libtorrent-offline", length: 0, downloaded: 0, downloadSpeed: 0, uploadSpeed: 0, numPeers: 0, ratio: 0, done: false, magnetURI: typeof torrentId === "string" && torrentId.startsWith("magnet:") ? torrentId : null, files: [], timeRemaining: null };
    }

    const uri = typeof torrentId === "string" && torrentId.length <= 40 && !torrentId.startsWith("magnet:")
      ? `magnet:?xt=urn:btih:${torrentId}`
      : String(torrentId);

    // Establish infoHash ↔ rtorrent hash mapping IMMEDIATELY if known
    const infoHash = opts.infoHash?.toLowerCase();
    if (infoHash) {
      const rHash = infoHash.toUpperCase();
      this._infoHashToId.set(infoHash, rHash);
      this._idToInfoHash.set(rHash, infoHash);
    }

    try {
      if (Buffer.isBuffer(torrentId)) {
        await this._scgiCall("load.raw_start", torrentId.toString("base64"));
      } else {
        await this._scgiCall("load.start", uri);
      }
    } catch (e) {
      console.error(`[engine:${this.cfg.id}][${this.cfg.logTag}] add failed:`, e.message);
      throw e;
    }

    const cached = infoHash ? this._cachedHandles.get(infoHash) : null;
    if (cached) return cached;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._handlePromises.delete(infoHash ?? "pending");
        resolve({ infoHash: infoHash ?? "rtorrent", name: opts.title ?? infoHash, length: 0, downloaded: 0, downloadSpeed: 0, uploadSpeed: 0, numPeers: 0, ratio: 0, done: false, magnetURI: typeof torrentId === "string" && torrentId.startsWith("magnet:") ? torrentId : null, files: [], timeRemaining: null });
      }, 8000);
      this._handlePromises.set(infoHash ?? "pending", { resolve, reject, timer });
    });
  }

  _idFor(infoHash) {
    return this._infoHashToId.get(infoHash) ?? (this._idToInfoHash.has(infoHash) ? infoHash : null);
  }

  _clientGet(infoHash) {
    return this._cachedHandles.get(infoHash) ?? null;
  }

  _clientList() {
    return [...this._cachedHandles.values()];
  }

  async _clientRemove(infoHash, deleteData) {
    if (!this._available) return false;
    const id = this._idFor(infoHash);
    if (!id) return false;
    try {
      if (deleteData) await this._scgiCall("d.erase", id);
      else await this._scgiCall("d.close", id);
      // Resolve any pending add promise
      const p = this._handlePromises.get(infoHash);
      if (p) { clearTimeout(p.timer); this._handlePromises.delete(infoHash); p.resolve(null); }
    } catch { return false; }
    this._infoHashToId.delete(infoHash);
    this._idToInfoHash.delete(id);
    this._cachedHandles.delete(infoHash);
    this._completedIds.delete(id);
    return true;
  }

  async _clientPause(infoHash) {
    if (!this._available) return false;
    const id = this._idFor(infoHash);
    if (!id) return false;
    try { await this._scgiCall("d.stop", id); return true; } catch { return false; }
  }

  async _clientResume(infoHash) {
    if (!this._available) return false;
    const id = this._idFor(infoHash);
    if (!id) return false;
    try { await this._scgiCall("d.start", id); return true; } catch { return false; }
  }

  async _clientSetSequential(infoHash, on) { return false; }

  async _clientSetFilePriorities(infoHash, priorities) { return false; }

  // ─── File selection ───────────────────────────────────────────────────

  _clientSelectFiles(handle, matchSet) {
    if (!this._available || !handle.infoHash) return;
    const id = this._idFor(handle.infoHash);
    if (!id) return;
    // rtorrent's f.multicall can get file paths, and d.set_priority can
    // set per-file priority (0 = skip). This is a non-trivial implementation.
  }

  // ─── Snapshot ─────────────────────────────────────────────────────────

  _clientSnapshot(infoHash) {
    const h = this._cachedHandles.get(infoHash);
    if (!h) {
      const rec = this.importedHistory.get(infoHash);
      if (rec) return { infoHash: rec.infoHash, name: rec.name, length: rec.size, files: [], magnetURI: rec.magnetURI, ratio: 0, numPeers: 0, done: true };
      return { infoHash, name: infoHash, length: 0, files: [], magnetURI: null, ratio: 0, numPeers: 0, done: true };
    }
    return {
      infoHash: h.infoHash, magnetURI: h.magnetURI, name: h.name,
      length: h.length,
      files: h.files.map((f) => ({ name: f.name, path: f.path, length: f.length, selected: f.selected })),
      ratio: h.ratio, numPeers: h.numPeers, done: h.done,
    };
  }

  _clientWireEvents() { /* poll-based — handled in _clientPoll */ }

  _isDone(t) { return t.done === true; }
}
