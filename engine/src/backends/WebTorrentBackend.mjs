import path from "node:path";
import fsp from "node:fs/promises";
import { AbstractBackend } from "./AbstractBackend.mjs";
import { ensureDir, movePath } from "../store.mjs";

/** Lazy-loaded — webtorrent is optional, only imported when this backend is chosen. */
let WebTorrent; // eslint-disable-line
import { parseRelease } from "../naming.mjs";
import { TORRENT_CACHE_DIR } from "../config.mjs";

/**
 * WebTorrent backend — wraps the WebTorrent client for all P2P transport.
 * Handles port fallback, selective episode file selection, .torrent caching,
 * and WebTorrent-specific stall recovery (peer reconnect nudges, selective
 * → whole-torrent fallback). This is the default backend.
 */
export class WebTorrentBackend extends AbstractBackend {
  async _clientCreate() {
    if (!WebTorrent) {
      WebTorrent = (await import("webtorrent")).default;
    }
    this.client = await this._createWithPortFallback();
  }

  async _clientDestroy() {
    if (this.client && !this.client.destroyed) {
      await new Promise((res) => this.client.destroy(res));
    }
  }

  async _createWithPortFallback() {
    const preferred = this.cfg.torrentPort || 0;
    const candidates = preferred ? [preferred, 0] : [0];
    let lastErr = null;
    for (const port of candidates) {
      try {
        const client = await this._tryBind(port);
        if (port !== preferred) {
          console.error(
            `[engine:${this.cfg.id}][${this.cfg.logTag}] port ${preferred} was already in use — fell back to auto-assigned port. Inbound peers won't be forwardable until freed.`
          );
        } else if (port) {
          console.log(`[engine:${this.cfg.id}][${this.cfg.logTag}] peer port (TCP): ${port} — forward this on your router/NAS firewall`);
        }
        client.on("error", (e) => console.error(`[engine:${this.cfg.id}][${this.cfg.logTag}] client error:`, e.message ?? e));
        return client;
      } catch (e) {
        lastErr = e;
      }
    }
    console.error(`[engine:${this.cfg.id}][${this.cfg.logTag}] could not start WebTorrent on any port:`, lastErr?.message ?? lastErr);
    throw lastErr ?? new Error("WebTorrent client failed to start");
  }

  _tryBind(port) {
    return new Promise((resolve, reject) => {
      const client = new WebTorrent({
        maxConns: Math.max(1, this.cfg.maxPeers ?? 55),
        dht: this.cfg.dht !== false,
        torrentPort: port,
        utp: false,
        tracker: { wrtc: false },
      });
      let settled = false;
      const onError = (e) => {
        if (settled) return;
        settled = true;
        client.removeListener("listening", onListening);
        if (!client.destroyed) client.destroy(() => {});
        reject(e);
      };
      const onListening = () => {
        if (settled) return;
        settled = true;
        client.removeListener("error", onError);
        resolve(client);
      };
      client.once("error", onError);
      client.once("listening", onListening);
      setTimeout(() => {
        if (settled) return;
        settled = true;
        client.removeListener("listening", onListening);
        client.removeListener("error", onError);
        if (!client.destroyed) client.destroy(() => {});
        reject(new Error(`WebTorrent bind timeout on port ${port}`));
      }, 10000);
    });
  }

  _applyThrottle() {
    if (!this.client) return;
    const dl = (this.cfg.downloadLimitKbps || 0) * 1024;
    const ul = (this.cfg.uploadLimitKbps || 0) * 1024;
    if (typeof this.client.throttleDownload === "function") this.client.throttleDownload(dl > 0 ? dl : -1);
    if (typeof this.client.throttleUpload === "function") this.client.throttleUpload(ul > 0 ? ul : -1);
  }

  // ─── Client operations ─────────────────────────────────────────────────

  async _clientAdd(torrentId, opts) {
    return new Promise((resolve, reject) => {
      const t = this.client.add(torrentId, {
        path: this.cfg.downloadPath,
        deselect: !!(opts.episodeTarget || opts.episodeTargets),
      });
      t.on("error", reject);
      let waited = 0;
      const settle = () => {
        if (t.infoHash) {
          if (opts.paused) t.pause();
          return resolve(this._wtHandle(t));
        }
        if ((waited += 25) > 8000) {
          reject(new Error("could not resolve infoHash"));
        } else {
          setTimeout(settle, 25);
        }
      };
      settle();
    });
  }

  /** Wrap a WT torrent into a plain handle object. */
  _wtHandle(t) {
    const h = {
      infoHash: t.infoHash,
      name: t.name,
      length: t.length ?? 0,
      downloaded: t.downloaded,
      downloadSpeed: t.downloadSpeed,
      uploadSpeed: t.uploadSpeed,
      numPeers: t.numPeers,
      ratio: t.ratio ?? 0,
      done: t.done,
      magnetURI: t.magnetURI,
      files: (t.files ?? []).map((f, i) => ({
        name: f.name, path: f.path ?? f.name, length: f.length ?? 0,
        downloaded: f.downloaded ?? 0, done: f.done ?? false,
        select: () => f.select(), deselect: () => f.deselect(),
        _wtFile: f, _index: i,
      })),
      _wtTorrent: t,
    };
    h.torrentFile = t.torrentFile;
    return h;
  }

  _clientGet(infoHash) {
    const t = this.client?.torrents?.find((t2) => t2.infoHash === infoHash);
    return t ? this._wtHandle(t) : null;
  }

  _clientList() {
    return (this.client?.torrents ?? []).map((t) => this._wtHandle(t));
  }

  _clientRemove(infoHash, deleteData) {
    return new Promise((resolve) => {
      const t = this.client?.torrents?.find((t2) => t2.infoHash === infoHash);
      if (!t) return resolve(false);
      this.client.remove(infoHash, { destroyStore: deleteData }, () => resolve(true));
    });
  }

  _clientPause(infoHash) {
    const t = this.client?.torrents?.find((t2) => t2.infoHash === infoHash);
    if (t) { t.pause(); return true; }
    return false;
  }

  _clientResume(infoHash) {
    const t = this.client?.torrents?.find((t2) => t2.infoHash === infoHash);
    if (t) { t.resume(); return true; }
    return false;
  }

  _clientSetSequential(infoHash, on) {
    const t = this.client?.torrents?.find((t2) => t2.infoHash === infoHash);
    if (t) { t.sequential = on; return true; }
    return false;
  }

  // ─── Snapshot ──────────────────────────────────────────────────────────

  _clientSnapshot(infoHash) {
    const t = this.client?.torrents?.find((t2) => t2.infoHash === infoHash);
    if (!t) {
      const rec = this.importedHistory.get(infoHash);
      if (rec) return {
        infoHash: rec.infoHash, name: rec.name, length: rec.size,
        files: [], magnetURI: rec.magnetURI, ratio: 0, numPeers: 0, done: true,
      };
      return { infoHash, name: infoHash, length: 0, files: [], magnetURI: null, ratio: 0, numPeers: 0, done: true };
    }
    const m = this.meta.get(infoHash);
    const selected = m?.selectedFileIndices ?? null;
    return {
      infoHash: t.infoHash,
      magnetURI: t.magnetURI,
      name: t.name,
      length: t.length ?? 0,
      files: (t.files ?? []).map((f, i) => ({
        name: f.name, path: f.path ?? f.name, length: f.length ?? 0,
        selected: !selected || selected.has(i),
      })),
      ratio: t.ratio ?? 0,
      numPeers: t.numPeers ?? 0,
      done: t.done ?? false,
    };
  }

  // ─── Events ────────────────────────────────────────────────────────────

  _clientWireEvents(handle, infoHash) {
    const t = handle._wtTorrent;
    if (!t) return;

    t.on("done", () => {
      this.onComplete(infoHash).catch((e) =>
        console.error(`[engine:${this.cfg.id}][${this.cfg.logTag}] onComplete failed:`, e.message)
      );
    });

    t.on("ready", () => {
      this._cacheTorrentFile(t).catch(() => {});
      // add()'s initial _selectEpisodeFiles call (AbstractBackend.mjs) can
      // land before WebTorrent has finished the peer metadata exchange —
      // client.add() only waits for infoHash, not for t.files — so for a
      // magnet-added episode/season-pack grab (deselect:true in _clientAdd,
      // meaning every file starts unselected) that first attempt silently
      // does nothing (`!handle.files?.length` guard), permanently leaving
      // every file deselected: the torrent still connects peers (selection
      // doesn't affect that) so it reads as active and never trips stall
      // detection, but downloads 0 bytes of anything forever. "ready" fires
      // once t.files is actually populated, so retry here — same fix
      // already shipped for this exact race in NativeTorrentBackend.mjs's
      // poll loop, just triggered by the event instead of polling.
      const m = this.meta.get(infoHash);
      if (m && (m.episodeTargets?.length || m.episodeTarget) && !m.selectedFileIndices && t.files?.length) {
        this._selectEpisodeFiles(this._wtHandle(t), m);
      }
      this.onChange();
    });

    t.on("error", (err) => {
      const m = this.meta.get(infoHash);
      console.error(`[engine:${this.cfg.id}][${this.cfg.logTag}] torrent error:`, err?.message ?? err);
      this.emitActivity("failed", {
        media: {
          id: m?.libraryRef?.split(":")[1] ?? infoHash,
          title: m?.title ?? t.name ?? "Inconnu",
          type: this.cfg.category, href: "#",
        },
        failure: { code: "download_failed", message: err?.message ?? "Torrent error" },
      });
    });

    t.on("download", () => {
      const m = this.meta.get(infoHash);
      if (m?.stalled) {
        // Reprise du téléchargement → levée du blocage, remise en dernier dans la file.
        this._recoverFromStall(infoHash);
      }
    });

    this._cacheTorrentFile(t).catch(() => {});
    this._startWTStallRecovery(t, infoHash);
  }

  // ─── File selection (WT-specific) ──────────────────────────────────────

  _clientSelectFiles(handle, matchSet) {
    const t = handle._wtTorrent;
    if (!t?.files) return;
    t.files.forEach((f, i) => (matchSet.has(i) ? f.select() : f.deselect()));
    for (const i of matchSet) {
      const f = t.files[i];
      if (f._startPiece != null && f._endPiece != null) t.critical(f._startPiece, f._endPiece);
    }
    this._watchSelectiveCompletion(t, matchSet, handle.infoHash);
  }

  _watchSelectiveCompletion(t, matchSet, infoHash) {
    const targets = [...matchSet].map((i) => t.files[i]);
    const checkDone = () => {
      if (t.done) return;
      if (!targets.every((f) => f.done)) return;
      for (const f of targets) f.removeListener("done", checkDone);
      clearInterval(stallTimer);
      this.onComplete(infoHash).catch((e) =>
        console.error(`[engine:${this.cfg.id}][${this.cfg.logTag}] onComplete failed:`, e.message)
      );
    };
    for (const f of targets) f.on("done", checkDone);
    checkDone();

    let lastDownloaded = -1;
    let stage = 0;
    const stallTimer = setInterval(() => {
      if (t.destroyed || t.done || targets.every((f) => f.done)) {
        clearInterval(stallTimer);
        return;
      }
      const downloaded = stage >= 2 ? t.downloaded : targets.reduce((s, f) => s + f.downloaded, 0);
      if (downloaded !== lastDownloaded) { lastDownloaded = downloaded; return; }
      const targetSize = targets.reduce((s, f) => s + f.length, 0);
      const targetDownloaded = targets.reduce((s, f) => s + f.downloaded, 0);
      const missing = targetSize - targetDownloaded;
      if (missing > 0 && missing <= Math.max(2 * 1024 * 1024, targetSize * 0.005)) {
        clearInterval(stallTimer);
        for (const f of targets) f.removeListener("done", checkDone);
        this.onComplete(infoHash).catch(() => {});
        return;
      }
      if (stage === 0 || stage === 2) {
        t.wires.slice().forEach((w) => w.destroy());
        stage += 1;
        lastDownloaded = -1;
        return;
      }
      if (stage === 1) {
        t.files.forEach((f) => f.select());
        const meta = this.meta.get(infoHash);
        if (meta) meta.selectedFileIndices = null;
        stage = 2;
        lastDownloaded = -1;
        return;
      }
      clearInterval(stallTimer);
      const meta = this.meta.get(infoHash);
      if (meta?.stalled) return; // blocked → la règle 2 min prend le relais ; le torrent reste en file et peut récupérer
      this.emitActivity("failed", {
        media: { id: meta?.libraryRef?.split(":")[1] ?? infoHash, title: meta?.title ?? t.name ?? "Inconnu", type: this.cfg.category, href: "#" },
        failure: { code: "no_peers_for_piece", message: "Aucun pair ne détient les dernières pièces" },
        metadata: { libraryRef: meta?.libraryRef ?? undefined }, infoHash,
      });
      this.remove(infoHash, true).catch(() => {});
    }, 90_000);
  }

  // ─── Whole-torrent stall recovery ──────────────────────────────────────

  _startWTStallRecovery(t, infoHash) {
    const meta = this.meta.get(infoHash);
    if (meta?.selectedFileIndices) return; // already watched by _watchSelectiveCompletion

    let lastDownloaded = -1;
    let stage = 0;
    let everProgressed = false;
    let neverProgressedNudges = 0;
    const MAX_NEVER_PROGRESSED_NUDGES = 3;

    const stallTimer = setInterval(() => {
      if (t.destroyed || t.done) { clearInterval(stallTimer); return; }
      const downloaded = t.downloaded;
      if (downloaded > 0) everProgressed = true;
      if (downloaded !== lastDownloaded) { lastDownloaded = downloaded; return; }
      const missing = (t.length ?? 0) - downloaded;
      if (missing > 0 && missing <= Math.max(2 * 1024 * 1024, (t.length ?? 0) * 0.005)) {
        clearInterval(stallTimer);
        this.onComplete(infoHash).catch(() => {});
        return;
      }
      if (stage === 0) {
        t.wires.slice().forEach((w) => w.destroy());
        stage = 1;
        lastDownloaded = -1;
        return;
      }
      if (!everProgressed && neverProgressedNudges < MAX_NEVER_PROGRESSED_NUDGES) {
        neverProgressedNudges += 1;
        stage = 0;
        lastDownloaded = -1;
        return;
      }
      clearInterval(stallTimer);
      const meta2 = this.meta.get(infoHash);
      if (meta2?.stalled) return; // blocked → la règle 2 min prend le relais ; le torrent reste en file et peut récupérer
      this.emitActivity("failed", {
        media: { id: meta2?.libraryRef?.split(":")[1] ?? infoHash, title: meta2?.title ?? t.name ?? "Inconnu", type: this.cfg.category, href: "#" },
        failure: { code: "no_peers_for_piece", message: "Aucun pair ne détient les dernières pièces" },
        metadata: { libraryRef: meta2?.libraryRef ?? undefined }, infoHash,
      });
      this.remove(infoHash, true).catch(() => {});
    }, 90_000);
  }

  // ─── .torrent cache ────────────────────────────────────────────────────

  async _cacheTorrentFile(torrent) {
    try {
      if (!torrent.torrentFile) return;
      await ensureDir(TORRENT_CACHE_DIR);
      await fsp.writeFile(path.join(TORRENT_CACHE_DIR, `${torrent.infoHash}.torrent`), torrent.torrentFile);
    } catch (e) {
      console.error(`[engine:${this.cfg.id}][${this.cfg.logTag}] metainfo cache failed:`, e.message);
    }
  }

  async _dropCachedTorrentFile(infoHash) {
    await fsp.rm(path.join(TORRENT_CACHE_DIR, `${infoHash}.torrent`), { force: true }).catch(() => {});
  }

  // ─── Done check ────────────────────────────────────────────────────────

  _isDone(t) {
    if (t.done) return true;
    const m = this.meta.get(t.infoHash);
    if (!m?.selectedFileIndices || !t.files) return false;
    return [...m.selectedFileIndices].every((i) => t.files[i]?.done);
  }
}
