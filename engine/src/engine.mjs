import path from "node:path";
import fsp from "node:fs/promises";
import { MovvizInstance } from "./instance.mjs";
import {
  DEFAULT_INSTANCES,
  DATA_DIR,
  CONFIG_DIR,
  TORRENT_CACHE_DIR,
} from "./config.mjs";
import { loadState, scheduleSave, writeState, ensureDir } from "./store.mjs";

/**
 * The engine ties the per-category instances together and drives automation:
 * routing a grab to the right instance, resuming torrents after a restart,
 * aggregating stats, and persisting state. It is the single object the API
 * (and therefore Movviz) talks to.
 */
export class MovvizEngine {
  constructor() {
    this.instances = new Map(); // id -> MovvizInstance
    this.state = loadState() ?? {};
    this.started = false;
  }

  configs() {
    // Persisted instance configs win over the built-in defaults.
    const saved = this.state.instances ?? {};
    return DEFAULT_INSTANCES.map((d) => ({ ...d, ...(saved[d.id] ?? {}) }));
  }

  async start() {
    await ensureDir(CONFIG_DIR);
    await ensureDir(DATA_DIR);
    for (const cfg of this.configs()) {
      const inst = new MovvizInstance(cfg, { onChange: () => this.persist() });
      await inst.init();
      this.instances.set(cfg.id, inst);
    }

    await this.resumeTorrents();

    // Ratio enforcement + persistence heartbeat.
    this.ticker = setInterval(() => {
      for (const inst of this.instances.values()) inst.tick();
    }, 5000);

    this.started = true;
    console.log(
      `[engine] started with ${this.instances.size} instance(s): ` +
        [...this.instances.keys()].join(", ")
    );
  }

  async resumeTorrents() {
    const saved = this.state.torrents ?? [];
    let resumed = 0;
    let restored = 0;
    // A systemic failure (client never came up) used to print one "resume
    // failed" line per saved torrent — hundreds on a large queue. Track
    // failures by message instead and print one summary line per distinct
    // cause once the pass is done.
    const failuresByReason = new Map();
    for (const rec of saved) {
      const inst = this.instances.get(rec.instanceId);
      if (!inst) continue;

      // Already imported before the restart — its files were moved out of
      // the download folder, so there's nothing for WebTorrent to resume.
      // Restore it as history instead of re-adding a doomed torrent.
      if (rec.movedTo) {
        inst.restoreImported(rec);
        restored++;
        continue;
      }

      // Resume from the cached .torrent metainfo when we have it — the
      // engine can then verify the on-disk data immediately, with zero
      // dependency on peers being around to serve metadata. The magnet link
      // stays as the fallback for torrents added before the cache existed.
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
  restart(infoHash) { return this.findByInfoHash(infoHash)?.restart(infoHash) ?? Promise.resolve(false); }
  setSequential(infoHash, on) { return this.findByInfoHash(infoHash)?.setSequential(infoHash, on) ?? false; }
  setFilePriorities(infoHash, p) { return this.findByInfoHash(infoHash)?.setFilePriorities(infoHash, p) ?? false; }
  remove(infoHash, deleteData) {
    const inst = this.findByInfoHash(infoHash);
    return inst ? inst.remove(infoHash, deleteData) : Promise.resolve(false);
  }

  detail(infoHash) {
    for (const inst of this.instances.values()) {
      const t = inst._get(infoHash);
      if (t) return inst.summary(t, true);
      const rec = inst.importedHistory.get(infoHash);
      if (rec) return inst.importedSummary(rec);
    }
    return null;
  }

  /** Drop every finished (completed/seeding) torrent from every instance's list — keeps files, no Plex/disk changes. */
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
    // Whitelist mutable fields — never let a caller rewrite id or category.
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

  // ---- Reporting ---------------------------------------------------------

  listTorrents() {
    const out = [];
    for (const inst of this.instances.values()) out.push(...inst.list());
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
    this.state = { instances, torrents, savedAt: Date.now() };
    scheduleSave(this.state);
  }

  async shutdown() {
    clearInterval(this.ticker);
    // persist() only schedules a debounced write — the process is about to
    // exit, so flush the state to disk NOW or the last ~800ms of progress
    // (completions, moves, resume data) silently vanish on every restart.
    this.persist();
    await writeState(this.state).catch((e) =>
      console.error("[engine] final state save failed:", e.message)
    );
    for (const inst of this.instances.values()) await inst.destroy();
  }
}
