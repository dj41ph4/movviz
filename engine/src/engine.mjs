import path from "node:path";
import fs from "node:fs";
import fsp from "node:fs/promises";
import { WebTorrentBackend } from "./backends/WebTorrentBackend.mjs";
import { retainMetainfo } from "./manualSeed.mjs";
import {
  DEFAULT_INSTANCES,
  DATA_DIR,
  CONFIG_DIR,
  TORRENT_CACHE_DIR,
  WEB_CALLBACK_URL,
  ENGINE_TOKEN,
  TORRENT_PORT_OVERRIDES,
  resolveClientType,
} from "./config.mjs";
import { loadState, scheduleSave, writeState, quiesceStateWrites, ensureDir } from "./store.mjs";

function createBackend(cfg, deps) {
  return new WebTorrentBackend(cfg, deps);
}

export class MovvizEngine {
  constructor() {
    this.instances = new Map();
    const savedState = loadState();
    this.state = savedState ?? {};
    // Only a genuinely new data directory receives the new limits. A missing
    // or unreadable engine state on an existing installation is not a reset.
    const fresh = !savedState && !fs.existsSync(path.join(CONFIG_DIR, "engine-state.json")) && !fs.existsSync(path.join(CONFIG_DIR, "users.json"));
    this._freshInstall = fresh;
    if (fresh) this.state.instances = { movies: { maxActive: 2, maxPeers: 1000, seedRatio: 2 }, series: { maxActive: 4, maxPeers: 1000, seedRatio: 2 } };
    // A bounded, real speed trace for the desktop download monitor.  It is
    // sampled by the engine itself (not by browser polling), so every client
    // sees the same graph and a busy browser cannot manufacture samples.
    const cutoff = Date.now() - 30 * 60 * 1000;
    this._statsHistory = Array.isArray(this.state.statsHistory)
      ? this.state.statsHistory.filter((sample) => sample && sample.at >= cutoff).slice(-360)
      : [];
    this.started = false;
    const hasSavedQueue = Array.isArray(this.state.torrents) && this.state.torrents.length > 0;
    this._legacyClientMigration = this.state.webTorrentMigrationPending === true
      || (!!this.state.clientType && this.state.clientType !== "webtorrent")
      || (!this.state.clientType && hasSavedQueue);
    this._clientType = resolveClientType();
    this.state.clientType = this._clientType;
    this.clientRestart = { restarting: false, error: null };
  }

  configs() {
    const saved = this.state.instances ?? {};
    return DEFAULT_INSTANCES.map((d) => {
      const configuredPort = TORRENT_PORT_OVERRIDES[d.id];
      return {
        ...d,
        ...(saved[d.id] ?? {}),
        // Explicit Settings changes win; legacy saved ports do not silently
        // override the deployment's environment configuration.
        ...(configuredPort === null || saved[d.id]?.torrentPortUserOverride
          ? {} : { torrentPort: configuredPort }),
      };
    });
  }

  async start() {
    // A retired backend's durable queue must survive any init/restore failure.
    if (this._legacyClientMigration) {
      this._preserveRestartState = true;
      this.state.webTorrentMigrationPending = true;
    }
    await ensureDir(CONFIG_DIR);
    await ensureDir(DATA_DIR);
    const deps = {
      onChange: () => this.persist(),
      emitActivity: (type, data) => this._emitActivity(type, data),
    };
    for (const cfg of this.configs()) {
      try {
        const inst = createBackend(cfg, deps);
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
    try {
      await this.resumeTorrents(this._legacyClientMigration);
      if (this._legacyClientMigration) {
        this._preserveRestartState = false;
        this._legacyClientMigration = false;
        delete this.state.webTorrentMigrationPending;
        this.persist();
      }
    } catch (error) {
      this.clientRestart.error = error.message ?? String(error);
      console.error("[engine] WebTorrent migration incomplete; saved queue retained:", this.clientRestart.error);
    }
    this.ticker = setInterval(() => {
      if (this._preserveRestartState || this._factoryResetInProgress) return;
      for (const inst of this.instances.values()) inst.tick();
      this._recordStats();
    }, 5000);
    this._recordStats();
    if (this._freshInstall) this.persist();
    this.started = true;
    console.log(
      `[engine] started with ${this.instances.size} instance(s) [client: ${this._clientType}]: ` +
        [...this.instances.keys()].join(", ")
    );
  }

  async resumeTorrents(strict = false) {
    const saved = this.state.torrents ?? [];
    let resumed = 0;
    let restored = 0;
    const failuresByReason = new Map();
    for (const rec of saved) {
      const inst = this.instances.get(rec.instanceId);
      if (!inst) {
        if (strict) throw new Error(`Cannot restore instance ${rec.instanceId}`);
        continue;
      }
      if (rec.movedTo) {
        inst.restoreImported(rec);
        restored++;
        continue;
      }
      let torrentId = null;
      if (this._legacyClientMigration) await retainMetainfo(inst.cfg, rec.infoHash);
      try {
        torrentId = await fsp.readFile(path.join(TORRENT_CACHE_DIR, `${rec.infoHash}.torrent`));
      } catch {
        torrentId = rec.magnetURI ?? null;
      }
      if (!torrentId) {
        if (strict) throw new Error(`Cannot restore torrent ${rec.infoHash}`);
        continue;
      }
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
          rejectMissingSeriesPack: rec.rejectMissingSeriesPack === true,
          autoPackReleaseTitle: rec.autoPackReleaseTitle,
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
    if (strict && failuresByReason.size) throw new Error("Some torrents could not be restored");
  }

  // ---- Routing -----------------------------------------------------------

  instanceForCategory(category) {
    for (const inst of this.instances.values()) {
      if (inst.cfg.category === category) return inst;
    }
    return null;
  }

  findByInfoHash(infoHash) {
    const lower = infoHash.toLowerCase();
    for (const inst of this.instances.values()) {
      if (inst._get(lower) || inst._get(infoHash) || inst.importedHistory.has(lower) || inst.importedHistory.has(infoHash)) return inst;
    }
    return null;
  }

  // ---- Commands ----------------------------------------------------------

  async add({ torrentId, category, instanceId, sequential, paused, libraryRef, title, year, episodeTarget, episodeTargets, rejectMissingSeriesPack, autoPackReleaseTitle }) {
    let inst = instanceId ? this.instances.get(instanceId) : null;
    if (instanceId && !inst) throw new Error(`unknown instance id: ${instanceId}`);
    if (!inst && category) {
      inst = this.instanceForCategory(category);
      if (!inst) throw new Error(`no instance registered for category: ${category}`);
    }
    if (!inst) inst = this.instances.values().next().value;
    if (!inst) throw new Error("no download instance available");
    if (!torrentId) throw new Error("missing torrentId (magnet, URL or infohash)");
    return inst.add(torrentId, { sequential, paused, libraryRef, title, year, episodeTarget, episodeTargets, rejectMissingSeriesPack, autoPackReleaseTitle });
  }

  pause(infoHash) { return this.findByInfoHash(infoHash)?.pause(infoHash) ?? false; }
  async retryEpisodePlacementImport(infoHash) {
    const instance = this.findByInfoHash(infoHash);
    if (!instance) throw new Error("torrent_not_found");
    return instance.retryEpisodePlacementImport(infoHash);
  }
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

  /** Clear engine metadata without deleting torrent data or media files. */
  async factoryReset() {
    if (this._factoryResetInProgress || this._preserveRestartState || this.clientRestart.restarting) throw new Error("engine_busy");
    if (!this.started || DEFAULT_INSTANCES.some((cfg) => !this.instances.has(cfg.id))) throw new Error("engine_unavailable");
    for (const inst of this.instances.values()) {
      if ([...inst.meta.values()].some((m) => m.processing || m.finishing || m.rejectionInFlight)) throw new Error("engine_busy");
    }
    this._factoryResetInProgress = true;
    try {
      await quiesceStateWrites();
      for (const inst of this.instances.values()) {
        for (const torrent of inst.list()) {
          if (!(await inst.remove(torrent.infoHash, false))) throw new Error("torrent_remove_failed");
        }
      }
      const defaults = { movies: { maxActive: 2, maxPeers: 1000, seedRatio: 2 }, series: { maxActive: 4, maxPeers: 1000, seedRatio: 2 } };
      this._statsHistory = [];
      this.state = { clientType: this._clientType, instances: defaults, torrents: [], statsHistory: [] };
      await writeState(this.state);
      await this._recreateInstances(createBackend, true);
      await quiesceStateWrites();
      await writeState(this.state);
    } finally {
      this._factoryResetInProgress = false;
    }
  }

  patchInstance(id, patch) {
    const inst = this.instances.get(id);
    if (!inst) return null;
    if (Object.hasOwn(patch, "torrentPort")) {
      const port = patch.torrentPort;
      if (!Number.isInteger(port) || port < 1024 || port > 65535) {
        throw new RangeError("torrentPort must be an integer between 1024 and 65535");
      }
      if ([...this.instances.values()].some((other) => other !== inst && other.cfg.torrentPort === port)) {
        throw new RangeError("torrentPort is already used by another instance");
      }
    }
    const allowed = [
      "name", "downloadPath", "completedPath", "maxActive",
      "downloadLimitKbps", "uploadLimitKbps", "seedRatio", "autoStart",
      "sequential", "autoMoveOnComplete", "dht", "pex", "priority",
      "maxPeers", "uploadSlots", "torrentPort",
    ];
    const clean = {};
    for (const k of allowed) if (k in patch) clean[k] = patch[k];
    if (Object.hasOwn(clean, "torrentPort")) clean.torrentPortUserOverride = true;
    inst.applyConfig(clean);
    this.persist();
    return inst.cfg;
  }

  /** Compatibility endpoint: selecting the sole backend is a harmless no-op. */
  async setClientType(clientType) {
    if (this._preserveRestartState) throw new Error("Torrent client restart pending");
    if (clientType !== "webtorrent") {
      throw new Error(`invalid client type: ${clientType}`);
    }
  }

  /** Recreate the actual clients, retaining the durable queue even on failure. */
  restartClients() {
    if (this.clientRestart.restarting) return;
    this.clientRestart = { restarting: true, error: null };
    this._restartTask = (async () => {
      try {
        if (!this._preserveRestartState) this.persist();
        this._preserveRestartState = true;
        await writeState(this.state);
        await this._recreateInstances(createBackend, true);
        this._preserveRestartState = false;
        this._legacyClientMigration = false;
        delete this.state.webTorrentMigrationPending;
        this.persist();
      } catch (e) {
        this.clientRestart.error = e.message ?? String(e);
        console.error("[engine] client restart failed:", this.clientRestart.error);
      } finally {
        this.clientRestart.restarting = false;
      }
    })();
  }

  async _recreateInstances(factory = createBackend, strict = false) {
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
        const inst = factory(cfg, deps);
        await inst.init();
        this.instances.set(cfg.id, inst);
        if (strict && (!inst.client || inst.client.destroyed)) {
          throw new Error(`Client ${cfg.id} is offline`);
        }
      } catch (e) {
        console.error(`[engine] failed to recreate instance ${cfg.id}: ${e.message}`);
        if (strict) throw e;
      }
    }
    await this.resumeTorrents(strict);
    this._torrentsCache = null;
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
    const snapshot = {
      torrents: torrents.length,
      downloading: torrents.filter((t) => t.state === "downloading").length,
      queued: torrents.filter((t) => t.state === "queued").length,
      seeding: torrents.filter((t) => t.state === "seeding").length,
      completed: torrents.filter((t) => t.state === "completed").length,
      downloadSpeed: torrents.reduce((a, t) => a + t.downloadSpeed, 0),
      uploadSpeed: torrents.reduce((a, t) => a + t.uploadSpeed, 0),
      clientType: this._clientType,
    };
    return { ...snapshot, history: this._statsHistory };
  }

  _recordStats() {
    const torrents = this.listTorrents();
    const sample = {
      at: Date.now(),
      downloadSpeed: torrents.reduce((total, torrent) => total + torrent.downloadSpeed, 0),
      uploadSpeed: torrents.reduce((total, torrent) => total + torrent.uploadSpeed, 0),
      active: torrents.filter((torrent) => torrent.state === "downloading").length,
    };
    const last = this._statsHistory[this._statsHistory.length - 1];
    if (last && sample.at - last.at < 4500) return;
    this._statsHistory.push(sample);
    if (this._statsHistory.length > 360) this._statsHistory.splice(0, this._statsHistory.length - 360);
  }

  // ---- Persistence -------------------------------------------------------

  persist() {
    // Callbacks during destruction/restoration cannot overwrite the saved queue.
    // Failed restarts retain this snapshot for a safe retry.
    if (this._preserveRestartState || this._factoryResetInProgress) return;
    const instances = {};
    const torrents = [];
    for (const inst of this.instances.values()) {
      instances[inst.cfg.id] = inst.cfg;
      for (const rec of inst.persistable()) {
        torrents.push({ ...rec, instanceId: inst.cfg.id });
      }
    }
    this.state = { ...this.state, instances, torrents, statsHistory: this._statsHistory, savedAt: Date.now() };
    scheduleSave(this.state);
  }

  async shutdown() {
    clearInterval(this.ticker);
    this.persist();
    await writeState(this.state).catch((e) =>
      console.error("[engine] final state save failed:", e.message)
    );
    for (const inst of this.instances.values()) await inst.destroy();
  }
}
