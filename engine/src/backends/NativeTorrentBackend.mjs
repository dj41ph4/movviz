import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import net from "node:net";
import crypto from "node:crypto";
import { AbstractBackend } from "./AbstractBackend.mjs";
import { CONFIG_DIR } from "../config.mjs";

const BIN_NAME = process.platform === "win32" ? "aria2c.exe" : "aria2c";

/**
 * Native torrent backend — spawns an external aria2c process and controls it
 * via JSON-RPC over HTTP. Much lighter than WebTorrent (~5MB RSS vs 50-100MB+)
 * and handles hundreds of concurrent torrents without breaking a sweat.
 *
 * Requires aria2c to be installed (or bundled by the Windows installer).
 * JSON-RPC secret is auto-generated per-session for security.
 */
export class NativeTorrentBackend extends AbstractBackend {
  constructor(cfg, deps) {
    super(cfg, deps);
    this._rpcPort = 0;
    this._rpcSecret = crypto.randomUUID().slice(0, 16);
    this._process = null;
    this._gidToInfoHash = new Map();   // gid → infoHash
    this._infoHashToGid = new Map();   // infoHash → gid
    this._requestId = 0;
    this._completedGids = new Set();   // gids detected as freshly completed
    this._cachedHandles = new Map();   // infoHash → cached handle (updated on poll)
    this._handlePromises = new Map();  // gid ? { resolve, reject, timer }
  }

  get _clientPollIntervalMs() { return 2500; }

  // ─── Find the native binary ────────────────────────────────────────────

  _findBinary() {
    // 1. Check PATH first
    const paths = process.env.PATH?.split(path.delimiter) ?? [];
    for (const p of paths) {
      const candidate = path.join(p, BIN_NAME);
      if (fs.existsSync(candidate)) return candidate;
    }
    // 2. Check bundled with Movviz (packaging/aria2/)
    const bundled = path.join(process.cwd(), "packaging", "aria2", BIN_NAME);
    if (fs.existsSync(bundled)) return bundled;
    // 3. Check engine dir
    const engineDir = path.join(process.cwd(), "engine", "aria2", BIN_NAME);
    if (fs.existsSync(engineDir)) return engineDir;
    // 4. Check in CONFIG_DIR
    const configDir = path.join(CONFIG_DIR, "aria2", BIN_NAME);
    if (fs.existsSync(configDir)) return configDir;
    return BIN_NAME; // hope it's in PATH
  }

  // ─── Client lifecycle ──────────────────────────────────────────────────

  async _clientCreate() {
    const bin = this._findBinary();
    this._rpcPort = await this._findFreePort();

    const args = [
      "--enable-rpc",
      "--rpc-listen-all=false",
      `--rpc-listen-port=${this._rpcPort}`,
      `--rpc-secret=${this._rpcSecret}`,
      "--rpc-max-request-size=4M",
      `--dir=${this.cfg.downloadPath}`,
      "--continue=true",
      "--allow-overwrite=true",
      "--auto-file-renaming=false",
      "--max-connection-per-server=16",
      "--min-split-size=1M",
      "--split=5",
      "--disable-ipv6=false",
      "--enable-dht=true",
      `--dht-listen-port=${(this.cfg.torrentPort >= 1024 && this.cfg.torrentPort <= 65535) ? this.cfg.torrentPort : 0}`,
      "--enable-peer-exchange=true",
      "--bt-enable-lpd=false",
      "--follow-torrent=mem",
      "--bt-save-metadata=true",
      "--bt-metadata-only=false",
      "--bt-stop-timeout=0",
      "--summary-interval=0",
      "--console-log-level=error",
    ];

    if (!this.cfg.dht) args.push("--disable-dht");
    if (this.cfg.downloadLimitKbps) args.push(`--max-download-limit=${this.cfg.downloadLimitKbps * 1024}`);
    if (this.cfg.uploadLimitKbps) args.push(`--max-upload-limit=${this.cfg.uploadLimitKbps * 1024}`);

    // Seed ratio — aria2 uses --seed-ratio (0 = no limit, >0 = stop at ratio)
    const ratio = Number(this.cfg.seedRatio) || 0;
    if (ratio > 0) args.push(`--seed-ratio=${ratio}`);

    const maxPeers = Math.max(1, this.cfg.maxPeers ?? 55);
    args.push(`--bt-max-peers=${maxPeers}`);

    console.log(`[engine:${this.cfg.id}][${this.cfg.logTag}] spawning ${bin} on RPC port ${this._rpcPort}...`);

    try {
      this._process = spawn(bin, args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env },
      });
    } catch (e) {
      throw new Error(
        `Impossible de lancer aria2c (${bin}). ${process.platform === "win32" ? "Téléchargez-le depuis https://github.com/aria2/aria2/releases et placez aria2c.exe dans le dossier packaging/aria2/, ou ajoutez-le au PATH." : "Installez-le avec votre gestionnaire de paquets (apt install aria2, apk add aria2...)."}`
      );
    }

    this._process.stdout?.on("data", (d) => process.stdout.write(`[aria2:${this.cfg.id}] ${d}`));
    this._process.stderr?.on("data", (d) => {
      if (d.toString().includes("exceptional CUE")) return; // noise from some releases
      process.stderr.write(`[aria2:${this.cfg.id}] ${d}`);
    });

    this._process.on("exit", (code, signal) => {
      console.error(`[engine:${this.cfg.id}][${this.cfg.logTag}] aria2c exited (code=${code}, signal=${signal})`);
      this._process = null;
    });

    // Wait for the RPC port to be ready (up to 5s)
    await this._waitForRpc();
    console.log(`[engine:${this.cfg.id}][${this.cfg.logTag}] aria2c ready on 127.0.0.1:${this._rpcPort}`);
  }

  async _clientDestroy() {
    for (const p of this._handlePromises.values()) {
      clearTimeout(p.timer);
    }
    this._handlePromises.clear();
    this._gidToInfoHash.clear();
    this._infoHashToGid.clear();
    this._cachedHandles.clear();
    this._completedGids.clear();
    if (this._process) {
      // Graceful shutdown via RPC first
      try { await this._rpcCall("aria2.shutdown"); } catch {}
      // Force kill after 2s
      setTimeout(() => {
        if (this._process) {
          try {
            if (process.platform === "win32") {
              this._process.kill(); // SIGTERM is the default on Windows
            } else {
              this._process.kill("SIGKILL");
            }
          } catch {}
        }
      }, 2000);
    }
  }

  // ─── RPC helpers ───────────────────────────────────────────────────────

  get _rpcUrl() {
    return `http://127.0.0.1:${this._rpcPort}/jsonrpc`;
  }

  _rpcCall(method, params = []) {
    return new Promise((resolve, reject) => {
      const id = ++this._requestId;
      const body = JSON.stringify({
        jsonrpc: "2.0",
        id,
        method,
        params: [`token:${this._rpcSecret}`, ...params],
      });
      const req = http.request(this._rpcUrl, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
        timeout: 10_000,
      }, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) reject(new Error(parsed.error.message ?? JSON.stringify(parsed.error)));
            else resolve(parsed.result);
          } catch { reject(new Error(`RPC parse error: ${data.slice(0, 200)}`)); }
        });
      });
      req.on("error", reject);
      req.on("timeout", () => { req.destroy(); reject(new Error("RPC timeout")); });
      req.write(body);
      req.end();
    });
  }

  async _waitForRpc() {
    for (let i = 0; i < 20; i++) {
      try {
        await this._rpcCall("aria2.getVersion");
        return;
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    throw new Error("aria2c RPC did not become ready within 5s");
  }

  _findFreePort() {
    return new Promise((resolve, reject) => {
      const srv = net.createServer();
      srv.listen(0, "127.0.0.1", () => {
        const port = srv.address().port;
        srv.close(() => resolve(port));
      });
      srv.on("error", reject);
    });
  }

  _applyThrottle() {
    // aria2 uses --max-download-limit / --max-upload-limit at spawn time.
    // For live updates we'd need to call aria2.changeGlobalOption via RPC.
    const dl = this.cfg.downloadLimitKbps || 0;
    const ul = this.cfg.uploadLimitKbps || 0;
    this._rpcCall("aria2.changeGlobalOption", [{ "max-download-limit": String(dl * 1024), "max-upload-limit": String(ul * 1024) }])
      .catch(() => {});
  }

  // ─── Map aria2 status → handle ───────────────────────────────────────

  _nativeFileToPlain(f, index) {
    return {
      name: path.basename(f.path),
      path: f.path,
      length: Number(f.length) || 0,
      downloaded: Number(f.completedLength) || 0,
      selected: f.selected === "true",
      _index: index,
    };
  }

  _nativeStatusToHandle(status) {
    const gid = status.gid;
    const rawInfoHash = (status.infoHash ?? "").toLowerCase();
    // aria2 ne résout l'infoHash qu'après avoir récupéré les metadata
    // (aimant). En attendant, on utilise celui qu'on connaît déjà depuis
    // l'appel add() — sinon le handle est indexé par GID, mais
    // AbstractBackend.meta l'est par le vrai infoHash, et le torrent
    // devient invisible.
    const infoHash = rawInfoHash || this._gidToInfoHash.get(gid) || gid;
    if (rawInfoHash) {
      this._gidToInfoHash.set(gid, rawInfoHash);
      this._infoHashToGid.set(rawInfoHash, gid);
    }

    const total = Number(status.totalLength) || 0;
    const completed = Number(status.completedLength) || 0;
    const downloadSpeed = Number(status.downloadSpeed) || 0;
    const uploadSpeed = Number(status.uploadSpeed) || 0;
    const connections = Number(status.connections) || 0;
    const ratio = total > 0 ? completed / total : 0;
    const timeRemaining = downloadSpeed > 0 ? ((total - completed) / downloadSpeed) * 1000 : null;

    // aria2 status: "active", "waiting", "paused", "error", "complete", "removed"
    // With --bt-stop-timeout=0, aria2 keeps COMPLETED torrents in tellActive
    // with status "active" — never moves them to tellStopped. Without detecting
    // completed bytes here, onComplete is never called, files stay at 100%.
    const ariaStatus = status.status;
    const isDone = ariaStatus === "complete" || ariaStatus === "seeding" || (total > 0 && completed >= total);
    const isPaused = ariaStatus === "paused";
    const isWaiting = ariaStatus === "waiting";

    const files = (status.files ?? []).map((f, i) => this._nativeFileToPlain(f, i));

    return {
      infoHash: infoHash || gid,
      gid,
      name: status.bittorrent?.info?.name ?? (files.length > 0 ? path.basename(files[0].path) : gid),
      length: total,
      downloaded: completed,
      downloadSpeed,
      uploadSpeed,
      numPeers: connections,
      ratio,
      done: isDone,
      timeRemaining,
      magnetURI: null,
      files,
      status: ariaStatus,
      isPaused,
      isWaiting,
      totalLength: total,
      completedLength: completed,
      _raw: status,
    };
  }

  // ─── Polling (called every _clientPollIntervalMs) ──────────────────────

  async _clientPoll() {
    try {
      // Fetch all states in parallel
      const [active, waiting, stopped] = await Promise.all([
        this._rpcCall("aria2.tellActive").catch(() => []),
        this._rpcCall("aria2.tellWaiting", [0, 200]).catch(() => []),
        this._rpcCall("aria2.tellStopped", [0, 200]).catch(() => []),
      ]);

      const allStatuses = [...(active ?? []), ...(waiting ?? []), ...(stopped ?? [])];
      const seenGids = new Set();
      const seenInfoHashes = new Set();

      for (const s of allStatuses) {
        const h = this._nativeStatusToHandle(s);
        if (h.infoHash) {
          this._cachedHandles.set(h.infoHash, h);
          seenInfoHashes.add(h.infoHash);
          seenGids.add(s.gid);
        }
      }

      // Handle freshly completed torrents — check stopped AND active/waiting
      // (--bt-stop-timeout=0 keeps completed torrents in tellActive forever)
      for (const s of allStatuses) {
        const isComplete = s.status === "complete" || (Number(s.totalLength) > 0 && Number(s.completedLength) >= Number(s.totalLength));
        if (isComplete && !this._completedGids.has(s.gid)) {
          this._completedGids.add(s.gid);
          const h = this._nativeStatusToHandle(s);
          if (h.infoHash) {
            const m = this.meta.get(h.infoHash) ?? this.meta.get(h.gid);
            if (m && !m.completed) {
              this.onComplete(h.infoHash).catch((e) =>
                console.error(`[engine:${this.cfg.id}][${this.cfg.logTag}] onComplete failed:`, e.message)
              );
            } else if (m && m.completed && (m.notifiedLibrary || !m.libraryRef)) {
              // Cleanup symlinks only if library was already notified
              this._finish(this._clientSnapshot(h.infoHash), true).catch((e) =>
                console.error(`[engine:${this.cfg.id}][${this.cfg.logTag}] cleanup failed:`, e.message)
              );
            }
          }
        }
      }

      // Prune stalled GIDs from _completedGids — prevents unbounded growth
      for (const gid of this._completedGids) {
        if (!seenGids.has(gid)) this._completedGids.delete(gid);
      }

      // Resolve pending add promises for infoHashes we just discovered
      for (const [gidKey, p] of this._handlePromises) {
        if (seenGids.has(gidKey)) {
          clearTimeout(p.timer);
          this._handlePromises.delete(gidKey);
          const realInfoHash = this._gidToInfoHash.get(gidKey);
          const h = this._cachedHandles.get(realInfoHash ?? gidKey) ?? null;
          if (h) p.resolve(h);
          else p.resolve(null);
        }
      }
    } catch (e) {
      console.warn(`[engine:${this.cfg.id}][${this.cfg.logTag}] poll RPC error:`, e?.message ?? e);
    }

  }

  async _clientAdd(torrentId, opts) {
    let gid;

    if (Buffer.isBuffer(torrentId) || (typeof torrentId === "string" && torrentId.startsWith("http"))) {
      // .torrent buffer or URL
      const isBuffer = Buffer.isBuffer(torrentId);
      if (isBuffer) {
        // Upload .torrent file content as base64
        const base64 = torrentId.toString("base64");
        gid = await this._rpcCall("aria2.addTorrent", [base64, [], { dir: this.cfg.downloadPath }]);
      } else {
        // HTTP(S) URL to .torrent
        gid = await this._rpcCall("aria2.addUri", [[torrentId], { dir: this.cfg.downloadPath }]);
      }
    } else {
      // Magnet link or infoHash — aria2 accepts both
      const uri = typeof torrentId === "string" && torrentId.length <= 40 && !torrentId.startsWith("magnet:")
        ? `magnet:?xt=urn:btih:${torrentId}`
        : String(torrentId);
      gid = await this._rpcCall("aria2.addUri", [[uri], { dir: this.cfg.downloadPath }]);
    }

    // When we already know the infoHash (always true via search), return
    // immediately — no need to wait for the poll cycle to discover it.
    const infoHash = opts.infoHash?.toLowerCase();
    if (infoHash) {
      this._gidToInfoHash.set(gid, infoHash);
      this._infoHashToGid.set(infoHash, gid);
      const cached = this._cachedHandles.get(infoHash);
      if (cached) return cached;
      return {
        infoHash,
        name: opts.title ?? gid,
        length: 0, downloaded: 0, downloadSpeed: 0, uploadSpeed: 0,
        numPeers: 0, ratio: 0, done: false,
        magnetURI: typeof torrentId === "string" && torrentId.startsWith("magnet:") ? torrentId : null,
        files: [], gid,
      };
    }

    // Without a known infoHash, wait for the poll cycle or a 5s timeout
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._handlePromises.delete(gid);
        resolve({
          infoHash: gid,
          name: opts.title ?? gid,
          length: 0, downloaded: 0, downloadSpeed: 0, uploadSpeed: 0,
          numPeers: 0, ratio: 0, done: false,
          magnetURI: typeof torrentId === "string" && torrentId.startsWith("magnet:") ? torrentId : null,
          files: [], gid,
        });
      }, 5000);
      this._handlePromises.set(gid, { resolve, reject, timer });
    });
  }

  _clientGet(infoHash) {
    let h = this._cachedHandles.get(infoHash);
    if (h) return h;
    const gid = this._infoHashToGid.get(infoHash);
    if (gid) return this._cachedHandles.get(gid) ?? null;
    // infoHash might be a GID itself (if frontend cached old queue item key)
    if (this._gidToInfoHash.has(infoHash)) return this._cachedHandles.get(infoHash) ?? null;
    return null;
  }

  _clientList() {
    return [...this._cachedHandles.values()];
  }

  /** Resolve aria2 GID from an infoHash or GID string. */
  _gidFor(infoHash) {
    return this._infoHashToGid.get(infoHash) ?? (this._gidToInfoHash.has(infoHash) ? infoHash : null);
  }

  async _clientRemove(infoHash, deleteData) {
    const gid = this._gidFor(infoHash);
    if (!gid) return false;
    try {
      await this._rpcCall("aria2.remove", [gid]);
    } catch { /* may already be complete */ }
    try {
      await this._rpcCall("aria2.removeDownloadResult", [gid]);
    } catch {}
    this._gidToInfoHash.delete(gid);
    this._infoHashToGid.delete(infoHash);
    this._cachedHandles.delete(infoHash);
    this._cachedHandles.delete(gid);
    this._completedGids.delete(gid);
    return true;
  }

  async _clientPause(infoHash) {
    const gid = this._gidFor(infoHash);
    if (!gid) return false;
    try {
      await this._rpcCall("aria2.pause", [gid]);
      return true;
    } catch { return false; }
  }

  async _clientResume(infoHash) {
    const gid = this._gidFor(infoHash);
    if (!gid) return false;
    try {
      await this._rpcCall("aria2.unpause", [gid]);
      return true;
    } catch { return false; }
  }

  async _clientSetSequential(infoHash, on) {
    return false; // aria2 doesn't support sequential download
  }

  async _clientSetFilePriorities(infoHash, priorities) {
    const gid = this._gidFor(infoHash);
    if (!gid) return false;
    try {
      const idxMap = {};
      const handle = this._cachedHandles.get(infoHash);
      if (handle?.files) {
        // priorities is array of file indices to prioritize
        for (let i = 0; i < handle.files.length; i++) {
          idxMap[i + 1] = priorities.includes(i) ? 1 : 0;
        }
      }
      await this._rpcCall("aria2.changeOption", [gid, { "select-file": Object.keys(idxMap).join(",") }]);
      return true;
    } catch { return false; }
  }

  // ─── Snapshot ──────────────────────────────────────────────────────────

  _clientSnapshot(infoHash) {
    const h = this._cachedHandles.get(infoHash);
    if (!h) {
      const rec = this.importedHistory.get(infoHash);
      if (rec) return {
        infoHash: rec.infoHash, name: rec.name, length: rec.size,
        files: [], magnetURI: rec.magnetURI, ratio: 0, numPeers: 0, done: true,
      };
      return { infoHash, name: infoHash, length: 0, files: [], magnetURI: null, ratio: 0, numPeers: 0, done: true };
    }
    return {
      infoHash: h.infoHash,
      magnetURI: h.magnetURI,
      name: h.name,
      length: h.length,
      files: h.files.map((f) => ({ name: f.name, path: f.path, length: f.length, selected: f.selected })),
      ratio: h.ratio,
      numPeers: h.numPeers,
      done: h.done,
    };
  }

  // ─── Events (aria2 is polling-based, events wired via _clientPoll) ─────

  _clientWireEvents() {
    // All event handling is done via _clientPoll which detects completion.
    // No per-torrent event wiring needed.
  }

  // ─── File selection ────────────────────────────────────────────────────

  _clientSelectFiles(handle, matchSet) {
    // Aria2 doesn't support per-file select/deselect on already-added torrents.
    // We store the selection for import filtering but can't optimize bandwidth.
    if (handle._raw?.files) {
      const indices = [...matchSet].map((i) => i + 1).join(",");
      if (indices) {
        this._rpcCall("aria2.changeOption", [handle.gid, { "select-file": indices }])
          .catch(() => {});
      }
    }
  }

  // ─── Done check ────────────────────────────────────────────────────────

  _isDone(t) {
    return t.done === true;
  }

  // ─── Enforce ratio (aria2 does this natively with --seed-ratio) ────────

  // Ratio enforcement is done natively by aria2's --seed-ratio flag.
  // No need for enforceRatio() override.
}
