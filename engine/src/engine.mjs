import path from "node:path";
import fsp from "node:fs/promises";
import { WebTorrentBackend } from "./backends/WebTorrentBackend.mjs";
import { NativeTorrentBackend } from "./backends/NativeTorrentBackend.mjs";
import { LibtorrentBackend } from "./backends/LibtorrentBackend.mjs";
import {
  DEFAULT_INSTANCES,
  DATA_DIR,
  CONFIG_DIR,
  TORRENT_CACHE_DIR,
  WEB_CALLBACK_URL,
  ENGINE_TOKEN,
  resolveClientType,
} from "./config.mjs";
import { loadState, scheduleSave, writeState, ensureDir } from "./store.mjs";

function createBackend(cfg, deps, clientType) {
  if (clientType === "native") {
    return new NativeTorrentBackend(cfg, deps);
  }
  if (clientType === "libtorrent") {
    return new LibtorrentBackend(cfg, deps);
  }
  return new WebTorrentBackend(cfg, deps);
}

export class MovvizEngine {
  constructor() {
    this.instances = new Map();
    this.state = loadState() ?? {};
    this.started = false;
    this._clientType = resolveClientType(this.state);
  }

  configs() {
    const saved = this.state.instances ?? {};
    return DEFAULT_INSTANCES.map((d) => ({ ...d, ...(saved[d.id] ?? {}) }));
  }

  async start() {
    await ensureDir(CONFIG_DIR);
    await ensureDir(DATA_DIR);
    const deps = {
      onChange: () => this.persist(),
      emitActivity: (type, data) => this._emitActivity(type, data),
    };
    for (const cfg of this.configs()) {
      try {
        const inst = createBackend(cfg, deps, this._clientType);
        await inst.init();
        this.instances.set(cfg.id, inst);
      } catch (e) {
        console.error(`[engine] failed to start instance ${cfg.id}: ${e.message}`);
      }
    }
    if (this.instances.size === 0) {
      console.error("[engine] no instances started — API still available for configuration");
      this.started = true;
      return;
    }
    await this.resumeTorrents();
    this.ticker = setInterval(() => {
      for (const inst of this.instances.values()) inst.tick();
    }, 5000);
    this.started = true;
    console.log(
      `[engine] started with ${this.instances.size} instance(s) [client: ${this._clientType}]: ` +
        [...this.instances.keys()].join(", ")
    );
  }

  async resumeTorrents() {
    const saved = this.state.torrents ?? [];
    let resumed = 0;
    let restored = 0;
    const failuresByReason = new Map();
    for (const rec of saved) {
      const inst = this.instances.get(rec.instanceId);
      if (!inst) continue;
      if (rec.movedTo) {
        inst.restoreImported(rec);
        restored++;
        continue;
      }
      let torrentId = null;
      try {
        torrentId = await fsp.readFile(path.join(TORRENT_CACHE_DIR, `${rec.infoHash}.torrent`));
      } catch {
        torrentId = rec.magnetURI ?? null;
      }
      if (!torrentId) continue;
      try {
        await inst.add(torrentId, {
          infoHash: rec.infoHash,
          addedAt: rec.addedAt,
          paused: rec.userPaused,
          sequential: rec.sequential,
          priority: rec.priority,
          stalled: rec.stalled,
          stalledAt: rec.stalledAt,
          dequeuedAt: rec.dequeuedAt,
          libraryRef: rec.libraryRef,
          title: rec.title,
          year: rec.year,
          episodeTarget: rec.episodeTarget,
          episodeTargets: rec.episodeTargets,
        });
        resumed++;
      } catch (e) {
        const reason = e.message ?? String(e);
        failuresByReason.set(reason, (failuresByReason.get(reason) ?? 0) + 1);
      }
    }
    if (resumed || restored) {
      console.log(`[engine] resumed ${resumed} torrent(s), restored ${restored} imported entry(ies)`);
    }
    for (const [reason, count] of failuresByReason) {
      console.error(`[engine] resume failed for ${count} torrent(s): ${reason}`);
    }
  }

  // ---- Routing -----------------------------------------------------------

  instanceForCategory(category) {
    for (const inst of this.instances.values()) {
      if (inst.cfg.category === category) return inst;
    }
    return null;
  }

  findByInfoHash(infoHash) {
    for (const inst of this.instances.values()) {
      if (inst._get(infoHash) || inst.importedHistory.has(infoHash)) return inst;
    }
    return null;
  }

  // ---- Commands ----------------------------------------------------------

  async add({ torrentId, category, instanceId, sequential, paused, libraryRef, title, year, episodeTarget, episodeTargets }) {
    let inst = instanceId ? this.instances.get(instanceId) : null;
    if (instanceId && !inst) throw new Error(`unknown instance id: ${instanceId}`);
    if (!inst && category) {
      inst = this.instanceForCategory(category);
      if (!inst) throw new Error(`no instance registered for category: ${category}`);
    }
    if (!inst) inst = this.instances.values().next().value;
    if (!inst) throw new Error("no download instance available");
    if (!torrentId) throw new Error("missing torrentId (magnet, URL or infohash)");
    return inst.add(torrentId, { sequential, paused, libraryRef, title, year, episodeTarget, episodeTargets });
  }

  pause(infoHash) { return this.findByInfoHash(infoHash)?.pause(infoHash) ?? false; }
  resume(infoHash) { return this.findByInfoHash(infoHash)?.resume(infoHash) ?? false; }
  async restart(infoHash) {
    const inst = this.findByInfoHash(infoHash);
    if (!inst) return false;
    const t = inst._get(infoHash);
    if (!t) return false;
    await inst.remove(infoHash, true);
    const rec = inst.importedHistory.get(infoHash);
    if (!rec) return false;
    await inst.add(rec.magnetURI ?? rec.infoHash, {
      infoHash, libraryRef: rec.libraryRef, title: rec.title, year: rec.year,
    });
    return true;
  }
  async startSeeding(infoHash) { return (await this.findByInfoHash(infoHash)?.startSeeding(infoHash)) ?? false; }
  async stopSeeding(infoHash) { return (await this.findByInfoHash(infoHash)?.stopSeeding(infoHash)) ?? false; }
  setSequential(infoHash, on) { return this.findByInfoHash(infoHash)?.setSequential(infoHash, on) ?? false; }
  setFilePriorities(infoHash, p) { return this.findByInfoHash(infoHash)?.setFilePriorities(infoHash, p) ?? false; }
  setPriority(infoHash, priority) { return this.findByInfoHash(infoHash)?.setPriority(infoHash, priority) ?? false; }
  async remove(infoHash, deleteData) {
    const inst = this.findByInfoHash(infoHash);
    return inst ? inst.remove(infoHash, deleteData) : false;
  }

  detail(infoHash) {
    for (const inst of this.instances.values()) {
      const d = inst.detail(infoHash);
      if (d) return d;
    }
    return null;
  }

  async clearFinished() {
    let cleared = 0;
    for (const inst of this.instances.values()) {
      const done = inst.list().filter((s) => s.state === "completed" || s.state === "seeding");
      for (const s of done) {
        if (await inst.remove(s.infoHash, false)) cleared++;
      }
    }
    this.persist();
    return cleared;
  }

  patchInstance(id, patch) {
    const inst = this.instances.get(id);
    if (!inst) return null;
    const allowed = [
      "name", "downloadPath", "completedPath", "maxActive",
      "downloadLimitKbps", "uploadLimitKbps", "seedRatio", "autoStart",
      "sequential", "autoMoveOnComplete", "dht", "pex", "priority",
      "maxPeers", "uploadSlots",
    ];
    const clean = {};
    for (const k of allowed) if (k in patch) clean[k] = patch[k];
    inst.applyConfig(clean);
    this.persist();
    return inst.cfg;
  }

  /** Switch client type and restart instances. */
  async setClientType(clientType) {
    if (clientType !== "webtorrent" && clientType !== "native" && clientType !== "libtorrent") {
      throw new Error(`invalid client type: ${clientType}`);
    }
    this._clientType = clientType;
    this.state.clientType = clientType;
    this.persist();
    await this._recreateInstances();
  }

  async _recreateInstances() {
    for (const inst of this.instances.values()) {
      await inst.destroy();
    }
    this.instances.clear();
    const deps = {
      onChange: () => this.persist(),
      emitActivity: (type, data) => this._emitActivity(type, data),
    };
    for (const cfg of this.configs()) {
      try {
        const inst = createBackend(cfg, deps, this._clientType);
        await inst.init();
        this.instances.set(cfg.id, inst);
      } catch (e) {
        console.error(`[engine] failed to recreate instance ${cfg.id}: ${e.message}`);
      }
    }
    await this.resumeTorrents();
  }

  // ---- Activity logging --------------------------------------------------

  _emitActivity(type, data) {
    const body = JSON.stringify({ type, data, source: "engine", clientType: this._clientType });
    fetch(`${WEB_CALLBACK_URL}/api/activity/log`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-movviz-token": ENGINE_TOKEN },
      body,
    }).catch(() => {});
  }

  // ---- Reporting ---------------------------------------------------------

  listTorrents() {
    const CACHE_MS = 400;
    const now = Date.now();
    if (this._torrentsCache && now - this._torrentsCacheAt < CACHE_MS) {
      return this._torrentsCache;
    }
    const out = [];
    for (const inst of this.instances.values()) out.push(...inst.list());
    this._torrentsCache = out;
    this._torrentsCacheAt = now;
    return out;
  }

  instancesInfo() {
    return [...this.instances.values()].map((inst) => {
      const torrents = inst.list();
      return {
        ...inst.cfg,
        folderError: inst.folderError ?? null,
        active: torrents.filter((t) => t.state === "downloading").length,
        seeding: torrents.filter((t) => t.state === "seeding").length,
        total: torrents.length,
        downloadSpeed: torrents.reduce((a, t) => a + t.downloadSpeed, 0),
        uploadSpeed: torrents.reduce((a, t) => a + t.uploadSpeed, 0),
        clientType: this._clientType,
      };
    });
  }

  stats() {
    const torrents = this.listTorrents();
    return {
      torrents: torrents.length,
      downloading: torrents.filter((t) => t.state === "downloading").length,
      seeding: torrents.filter((t) => t.state === "seeding").length,
      completed: torrents.filter((t) => t.state === "completed").length,
      downloadSpeed: torrents.reduce((a, t) => a + t.downloadSpeed, 0),
      uploadSpeed: torrents.reduce((a, t) => a + t.uploadSpeed, 0),
      clientType: this._clientType,
    };
  }

  // ---- Persistence -------------------------------------------------------

  persist() {
    const instances = {};
    const torrents = [];
    for (const inst of this.instances.values()) {
      instances[inst.cfg.id] = inst.cfg;
      for (const rec of inst.persistable()) {
        torrents.push({ ...rec, instanceId: inst.cfg.id });
      }
    }
    this.state = { ...this.state, instances, torrents, savedAt: Date.now() };
    scheduleSave(this.state);
  }

  async shutdown() {
    clearInterval(this.ticker);
    this.persist();
    await writeState(this.state).catch((e) =>
      console.error("[engine] final state save failed:", e.message)
    );
    for (const inst of this.instances.values()) await inst.destroy();
    import("./upnp.mjs").then(({ close }) => close()).catch(() => {});
  }
}
