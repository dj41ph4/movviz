import path from "node:path";
import fsp from "node:fs/promises";
import { ensureDir, movePath, linkOrCopy } from "../store.mjs";
import {
  loadNamingTemplates,
  parseRelease,
  buildContext,
  renderSegment,
  VIDEO_EXT_RE,
} from "../naming.mjs";
import { WEB_CALLBACK_URL, ENGINE_TOKEN, TORRENT_CACHE_DIR } from "../config.mjs";
import { ManualSeed, cacheMetainfo, retainMetainfo, torrentPath } from "../manualSeed.mjs";
import { validateEpisodeTargets, resolveEpisodePlacement, ensurePresentationFolder } from "../episodePlacement.mjs";

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

// Metadata/scene-tag extras a release can ship alongside the actual video —
// never meaningful as an import target on their own (see _import below).
const JUNK_EXT_RE = /\.(nfo|txt|url|torrent|tmp|sfv|md5|jpg|jpeg|png|gif|db)$/i;

/** Below 20 bytes/s for 2 minutes is stalled, even with connected peers. */
const STALL_MS = 120_000;
const MIN_ACTIVE_BYTES_PER_SECOND = 20;

/** After this many consecutive import failures for the same torrent, stop retrying automatically — see onComplete's `err` branch. */
const IMPORT_MAX_RETRIES = 5;

function fmtSize(bytes) {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + " " + units[i];
}

async function avoidCollision(dest) {
  let candidate = dest;
  let attempt = 2;
  const ext = path.extname(dest);
  const base = dest.slice(0, dest.length - ext.length);
  while (await fsp.access(candidate).then(() => true).catch(() => false)) {
    candidate = `${base} (${attempt})${ext}`;
    attempt += 1;
  }
  return candidate;
}

/**
 * Shared WebTorrent download/import/queue/naming logic. Subclasses implement the
 * `_client*` abstract methods for transport-specific operations.
 */
export class AbstractBackend {
  constructor(cfg, { onChange, emitActivity } = {}) {
    this.cfg = cfg;
    this.onChange = onChange ?? (() => {});
    this.emitActivity = emitActivity ?? (() => {});
    this.meta = new Map();
    this.importedHistory = new Map();
    this.client = null;
    this.folderError = null;
    this.manualSeed = new ManualSeed(cfg, () => this._manualSeedClient(), () => this.onChange());
    this.cfg.logTag = "stable";
  }

  // ─── Abstract methods (override in subclass) ──────────────────────────────
  /** Create the underlying torrent client. Must set `this.client`. */
  async _clientCreate() { throw new Error("_clientCreate not implemented"); }
  async _clientDestroy() { throw new Error("_clientDestroy not implemented"); }
  async _clientAdd(torrentId, opts) { throw new Error("_clientAdd not implemented"); }
  async _clientRemove(infoHash, deleteData) { throw new Error("_clientRemove not implemented"); }
  async _clientPause(infoHash) { throw new Error("_clientPause not implemented"); }
  async _clientResume(infoHash) { throw new Error("_clientResume not implemented"); }
  async _dropCachedTorrentFile(infoHash) {
    if (/^[a-f0-9]{40}$/i.test(infoHash)) await fsp.unlink(path.join(TORRENT_CACHE_DIR, `${infoHash.toLowerCase()}.torrent`)).catch(() => {});
  }
  _clientList() { throw new Error("_clientList not implemented"); }
  _clientGet(infoHash) { throw new Error("_clientGet not implemented"); }
  /** Return snapshot: { infoHash, name, length, files: [{name,path,length,selected}], magnetURI } */
  _clientSnapshot(infoHash) { throw new Error("_clientSnapshot not implemented"); }
  /** Wire done/error/download/ready events on a newly added torrent handle. Called after meta is set. */
  _clientWireEvents(handle, infoHash) { throw new Error("_clientWireEvents not implemented"); }
  _clientSetSequential(infoHash, on) { return false; }
  _clientSetFilePriorities(infoHash, priorities) { return false; }
  _clientSetPriority(infoHash, priority) {}
  _clientSelectFiles(handle, matchSet) {}
  /** How many ms to wait between polling for progress (0 = event-driven like WT) */
  get _clientPollIntervalMs() { return 0; }
  /** Called every poll tick — for backends that need to sync state from an external process. */
  async _clientPoll() {}

  // ─── Init ────────────────────────────────────────────────────────────────

  async init() {
    this.folderError = null;
    try {
      await ensureDir(this.cfg.downloadPath);
      await ensureDir(this.cfg.completedPath);
    } catch (e) {
      this.folderError = e.message;
      console.error(
        `[engine:${this.cfg.id}][${this.cfg.logTag}] folder unavailable (${e.message}) — downloads blocked until the folders are fixed in Settings`
      );
    }
    await this._clientCreate().catch((e) => {
      console.error(`[engine:${this.cfg.id}][${this.cfg.logTag}] client init failed (${e.message}) — instance offline until restart`);
      this.client = null;
    });
    this._applyThrottle?.();
    import("../upnp.mjs").then(({ addMapping }) =>
      addMapping(this.cfg.torrentPort, this.cfg.name || this.cfg.id)
    ).catch(() => {});

    const pi = this._clientPollIntervalMs;
    if (pi > 0) {
      this._pollTimer = setInterval(() => this._clientPoll().catch(() => {}), pi);
    }
  }

  async destroy() {
    this._shuttingDown = true;
    import("../upnp.mjs").then(({ removeMapping }) =>
      removeMapping(this.cfg.torrentPort)
    ).catch(() => {});
    clearInterval(this._pollTimer);
    await this.manualSeed.destroy();
    await this._seedClientPromise?.catch(() => {});
    if (this._seedClient && !this._seedClient.destroyed) await new Promise((resolve) => this._seedClient.destroy(resolve));
    await this._clientDestroy();
  }

  async _manualSeedClient() {
    // All download clients share the same read-only manual-seed transport.
    // Native clients cannot safely resume after their original files were moved.
    if (!this._seedClientPromise) this._seedClientPromise = (async () => {
      const { default: WebTorrent } = await import("webtorrent");
      if (this._shuttingDown) throw new Error("seed_client_stopped");
      this._seedClient = new WebTorrent({ torrentPort: 0, utp: false, dht: this.cfg.dht !== false, tracker: { wrtc: false }, maxConns: this.cfg.maxPeers ?? 55 });
      this._seedClient.on("error", () => {});
      this._seedClient.throttleUpload((this.cfg.uploadLimitKbps || 0) * 1024 || -1);
      return this._seedClient;
    })().catch((error) => { this._seedClientPromise = null; throw error; });
    return this._seedClientPromise;
  }

  // ─── Lookup ──────────────────────────────────────────────────────────────

  _get(infoHash) {
    return this._clientGet(infoHash);
  }

  // ─── Adding ──────────────────────────────────────────────────────────────

  async add(torrentId, opts = {}) {
    validateEpisodeTargets(opts.episodeTargets ?? (opts.episodeTarget ? [opts.episodeTarget] : []));
    if (this.folderError) {
      throw new Error(`download folder unavailable: ${this.folderError}`);
    }
    // Extract the stable identity before add() to detect duplicates early.
    if (!opts.infoHash && typeof torrentId === "string") {
      const m = torrentId.match(/[?&]xt=urn:btih:([a-f0-9]{32,64})/i);
      if (m) opts = { ...opts, infoHash: m[1].toLowerCase() };
    }
    if (opts.infoHash) {
      const existing = this._get(opts.infoHash);
      if (existing) return this.summary(existing);
      const hist = this.importedHistory.get(opts.infoHash);
      if (hist) return this.importedSummary(hist);
    }

    const handle = await this._clientAdd(torrentId, opts);
    if (Buffer.isBuffer(torrentId)) await cacheMetainfo(handle.infoHash, torrentId).catch(() => {});

    this.meta.set(handle.infoHash, {
      addedAt: opts.addedAt ?? Date.now(),
      completedAt: null,
      userPaused: !!opts.paused,
      queued: false,
      stalled: !!opts.stalled,
      stalledAt: opts.stalledAt ?? null,
      dequeuedAt: opts.dequeuedAt ?? null,
      lastActivityAt: null,
      lastActivitySampleAt: null,
      lastDownloaded: 0,
      priority: opts.priority ?? "medium",
      sequential: !!opts.sequential,
      completed: false,
      finishing: false,
      seeding: false,
      magnetURI: handle.magnetURI ?? (typeof torrentId === "string" && torrentId.startsWith("magnet:") ? torrentId : null),
      movedTo: null,
      libraryRef: opts.libraryRef ?? null,
      title: opts.title ?? null,
      year: opts.year ?? null,
      episodeTarget: opts.episodeTarget ?? null,
      episodeTargets: opts.episodeTargets ?? null,
      selectedFileIndices: null,
    });

    this._clientWireEvents(handle, handle.infoHash);

    if (opts.paused) Promise.resolve(this._clientPause(handle.infoHash)).catch(() => {});
    if (opts.sequential) this._clientSetSequential(handle.infoHash, true);

    this._selectEpisodeFiles(handle, this.meta.get(handle.infoHash));
    this.reconcileQueue();
    this.onChange();

    console.log(`[engine:${this.cfg.id}][${this.cfg.logTag}] + ${handle.name ?? handle.infoHash} (${fmtSize(handle.length ?? 0)})`);

    const releaseInfo = parseRelease(handle.name ?? "");
    this.emitActivity("grabbed", {
      media: {
        id: opts.libraryRef?.split(":")[1] ?? handle.infoHash,
        title: opts.title ?? handle.name ?? "Inconnu",
        type: this.cfg.category,
        href: opts.libraryRef
          ? `/title/${this.cfg.category}/${opts.year ? "?year=" + opts.year : ""}`
          : "#",
      },
      release: {
        indexer: "Indexeur inconnu",
        releaseTitle: handle.name ?? "Release inconnue",
        protocol: "torrent",
        size: handle.length ?? 0,
        quality: releaseInfo.quality ?? releaseInfo.resolution ?? "Inconnue",
        score: 0,
        seeders: handle.numPeers ?? 0,
        leechers: 0,
        customFormats: [],
      },
      download: {
        client: this.constructor.name.replace("Backend", ""),
        infoHash: handle.infoHash ?? "",
        progress: 0,
        downloadSpeed: 0,
        uploadSpeed: 0,
        eta: 0,
        ratio: 0,
        peers: handle.numPeers ?? 0,
        state: "downloading",
      },
      metadata: {
        libraryRef: opts.libraryRef ?? undefined,
        year: opts.year ?? undefined,
      },
    });

    return this.summary(handle);
  }

  restoreImported(rec) {
    if ((rec.replacementFailure && !rec.replacementFailure.discarded && rec.movedFiles) ||
        (rec.notifiedLibrary === false && rec.movedFiles?.some(file => file.episodePlacement))) {
      this.meta.set(rec.infoHash, { ...rec, movedFiles: rec.movedFiles, completed: false, notifiedLibrary: false });
    }
    this.importedHistory.set(rec.infoHash, {
      infoHash: rec.infoHash,
      magnetURI: rec.magnetURI ?? null,
      name: rec.name ?? rec.title ?? rec.infoHash,
      size: rec.size ?? 0,
      movedTo: rec.movedTo,
      movedFiles: rec.movedFiles,
      addedAt: rec.addedAt ?? null,
      completedAt: rec.completedAt ?? null,
      libraryRef: rec.libraryRef ?? null,
      replacementFailure: rec.replacementFailure,
      title: rec.title ?? null,
      year: rec.year ?? null,
      episodeTarget: rec.episodeTarget ?? null,
      episodeTargets: rec.episodeTargets ?? null,
      notifiedLibrary: rec.notifiedLibrary,
    });
  }

  // ─── Completion ──────────────────────────────────────────────────────────

  async onComplete(infoHash) {
    const m = this.meta.get(infoHash);
    if (!m || m.completed || m.processing || m.importAbandoned || m.replacementFailure) return;
    m.processing = true;
    try {
      m.completedAt ??= Date.now();
      this.reconcileQueue();
      this.onChange();

      const snap = this._clientSnapshot(infoHash);
      snap.magnetURI ??= m.magnetURI;
      await retainMetainfo(this.cfg, infoHash, this._clientGet(infoHash)?.torrentFile).catch(() => {});
      const releaseInfo = parseRelease(snap.name ?? "");
      const mediaBase = {
        id: m.libraryRef?.split(":")[1] ?? snap.infoHash,
        title: m.title ?? snap.name ?? "Inconnu",
        type: this.cfg.category,
        href: m.libraryRef ? `/title/${this.cfg.category}/${m.year ?? ""}` : "#",
      };

      this.emitActivity("importing", {
        media: mediaBase,
        download: {
          client: this.constructor.name.replace("Backend", ""),
          infoHash: snap.infoHash,
          progress: 1, downloadSpeed: 0, uploadSpeed: 0, eta: 0,
          ratio: snap.ratio ?? 0, peers: snap.numPeers ?? 0, state: "downloading",
        },
        metadata: { libraryRef: m.libraryRef ?? undefined, year: m.year ?? undefined },
      });

      const limit = Number(this.cfg.seedRatio) || 0;
      if (!this.cfg.autoMoveOnComplete) {
        m.completed = true;
        m.completedAt ??= Date.now();
        if (!this.importedHistory.has(snap.infoHash)) {
          this.importedHistory.set(snap.infoHash, {
            infoHash: snap.infoHash, magnetURI: snap.magnetURI ?? null, name: snap.name,
            size: snap.length, movedTo: null,
            addedAt: m.addedAt, completedAt: m.completedAt, libraryRef: m.libraryRef ?? null,
            title: m.title ?? null, year: m.year ?? null,
          });
        }
        this.reconcileQueue();
        this.onChange();
        return;
      }

      if (limit <= 0) {
        await this._finish(snap, false).catch((e) => {
          console.error(`[engine:${this.cfg.id}][${this.cfg.logTag}] finish failed:`, e.message);
          this.emitActivity("failed", {
            media: mediaBase,
            failure: { code: "import_failed", message: e.message ?? "Échec du déplacement des fichiers" },
            metadata: { libraryRef: m.libraryRef ?? undefined },
          });
        });
      } else {
        if (m.movedTo) {
          // Already imported via linkOrCopy; seeding finished.
          // Only cleanup if the library notification actually went through.
          if (!m.notifiedLibrary && m.libraryRef) {
            // Notification never succeeded — retry NOW before cleanup
            m.movedFiles ??= [];
            const ok = await this._notifyLibrary(m.libraryRef, m.movedFiles, snap.infoHash);
            if (ok) m.notifiedLibrary = true;
          }
          if (m.notifiedLibrary || !m.libraryRef) {
            await this._finish(snap, true).catch((e) => {
              console.error(`[engine:${this.cfg.id}][${this.cfg.logTag}] finish failed:`, e.message);
            });
          }
          return;
        }
        console.log(`[engine:${this.cfg.id}][${this.cfg.logTag}] → import ${snap.name ?? infoHash} → bibliothèque...`);
        const err = await this._import(snap, linkOrCopy).catch((e) => {
          console.error(`[engine:${this.cfg.id}][${this.cfg.logTag}] import failed:`, e.message);
          return e;
        });
        if (err) {
          // A permanently-failing import (e.g. the torrent's file is
          // genuinely gone) previously retried forever, every ~5s, with no
          // backoff or give-up — observed live in production: 20+ minutes,
          // ~250 identical "import failed" log lines, spamming the activity
          // feed and every notification webhook, until someone noticed and
          // restarted the engine by hand. Past IMPORT_MAX_RETRIES, stop:
          // mark importAbandoned (checked by onComplete's guard above) so
          // this torrent is left alone instead of retried on every future
          // completion check, and emit exactly one clear "gave up" activity
          // instead of one per attempt.
          m.importFailCount = (m.importFailCount ?? 0) + 1;
          const givingUp = m.importFailCount >= IMPORT_MAX_RETRIES;
          if (givingUp) m.importAbandoned = true;
          if (m.importFailCount === 1 || givingUp) {
            this.emitActivity("failed", {
              media: mediaBase,
              failure: {
                code: "import_failed",
                message: givingUp
                  ? `${err.message ?? "Échec de l'import"} — abandon après ${m.importFailCount} tentatives, intervention manuelle nécessaire`
                  : err.message ?? "Échec de l'import",
              },
              metadata: { libraryRef: m.libraryRef ?? undefined },
            });
          }
          if (givingUp) {
            console.error(`[engine:${this.cfg.id}][${this.cfg.logTag}] import abandonné pour ${snap.name ?? infoHash} après ${m.importFailCount} échecs consécutifs — intervention manuelle nécessaire`);
          }
          this.onChange();
        } else {
          // Import succeeded (linkOrCopy). Notification was attempted inside
          // _import — if it succeeded, m.notifiedLibrary is true.
          // Set completed only if library was notified (or no libraryRef).
          if (m.notifiedLibrary || !m.libraryRef) {
            m.completed = true;
          }
          m.completedAt ??= Date.now();
          // Cleanup here, not just inside _finish — once m.completed is set
          // above, tick() never calls onComplete() for this torrent again
          // (see the `if (m?.completed) continue;` guard), so the
          // `if (m.movedTo)` branch above (which reaches _finish(snap,true)
          // and ITS cleanup call) structurally cannot run a second time in
          // the normal success case. Without this, the download folder was
          // never actually cleaned up for a torrent that imported correctly
          // on the first try — the leftover symlinks/residue files just sat
          // there permanently. Gated the same way _finish gates it: only
          // after a successful import, regardless of notify status (matches
          // path A's model, where cleanup depends on the move succeeding,
          // not on notify succeeding — the retry loop in tick() handles a
          // failed notify independently via m.movedFiles). ALSO gated on
          // !m.symlinkVerificationFailed — _cleanupDownloadFolder deletes
          // the whole download folder unconditionally, so it must never run
          // when _swapForSymlink (above, inside _import) declined to touch
          // one of this torrent's files because its copy couldn't be
          // verified: that file is the only good copy left, sitting in the
          // exact folder this would otherwise wipe. ALSO gated on
          // !m.hasUnmatchedFiles — set by _import() when a downloaded video
          // file matched no episode target; cleanup deletes the whole
          // folder regardless of match status, so an unmatched file must
          // never be swept away with the rest (see the [import-match] log
          // lines for what specifically didn't match and why).
          if (!m.replacementFailure && this.cfg.autoMoveOnComplete && snap.name && !m.symlinkVerificationFailed && !m.hasUnmatchedFiles) {
            await this._cleanupDownloadFolder(snap);
          }
          if (!this.importedHistory.has(snap.infoHash)) {
            this.importedHistory.set(snap.infoHash, {
              infoHash: snap.infoHash, magnetURI: snap.magnetURI ?? null, name: snap.name,
              size: snap.length, movedTo: m.movedTo ?? null,
              addedAt: m.addedAt, completedAt: m.completedAt, libraryRef: m.libraryRef ?? null,
              title: m.title ?? null, year: m.year ?? null,
            });
          }
          const wasUpgrade = m.completedAt && (Date.now() - m.completedAt > 60_000);
          this.emitActivity(wasUpgrade ? "upgraded" : "imported", {
            media: mediaBase,
            release: {
              indexer: "Indexeur inconnu",
              releaseTitle: snap.name ?? "Release inconnue",
              protocol: "torrent",
              size: snap.length ?? 0,
              quality: releaseInfo.quality ?? releaseInfo.resolution ?? "Inconnue",
              score: 0, customFormats: [],
            },
            metadata: { libraryRef: m.libraryRef ?? undefined, year: m.year ?? undefined },
          });
        }
      }
    } finally {
      m.processing = false;
    }
  }

  // ─── Queue ───────────────────────────────────────────────────────────────

  reconcileQueue() {
    const max = this.cfg.maxActive || 0;
    if (max <= 0) return;
    const all = this._clientList().filter((t) => {
      const m = this.meta.get(t.infoHash);
      return m && !m.completed && !m.userPaused && !this._isDone(t);
    });
    all.sort((a, b) => {
      const ma = this.meta.get(a.infoHash);
      const mb = this.meta.get(b.infoHash);
      // Torrents without dequeuedAt (never stalled) go FIRST; recently
      // unstalled ones are re-queued by their dequeuedAt — the most recent
      // recovery goes to the END of the queue.
      const da = ma?.dequeuedAt ?? 0;
      const db = mb?.dequeuedAt ?? 0;
      const pa = PRIORITY_RANK[ma?.priority ?? "medium"] ?? 1;
      const pb = PRIORITY_RANK[mb?.priority ?? "medium"] ?? 1;
      return da - db || pa - pb || Number(ma?.queued) - Number(mb?.queued) || (ma?.addedAt ?? 0) - (mb?.addedAt ?? 0);
    });
    let slotsUsed = 0;
    for (const t of all) {
      const m = this.meta.get(t.infoHash);
      if (m?.stalled) continue;
      const shouldRun = slotsUsed < max;
      if (shouldRun) slotsUsed++;
      if (shouldRun && m?.queued) {
        m.queued = false;
        Promise.resolve(this._clientResume(t.infoHash)).catch(() => {});
      } else if (!shouldRun && m && !m.queued) {
        m.queued = true;
        Promise.resolve(this._clientPause(t.infoHash)).catch(() => {});
      }
    }
  }

  // ─── Tick ────────────────────────────────────────────────────────────────

  tick() {
    // Retry failed _notifyLibrary calls for any torrent that has been
    // imported (movedTo set) but whose library callback never went through.
    // Runs every 15s — doesn't depend on _clientList() (torrent may have
    // been removed from the client after _finish cleanup).
    for (const [infoHash, m] of this.meta) {
      // m.movedFiles is set (even to []) once _import has run — checking
      // the array reference rather than its length lets a zero-match
      // import (see _import's notify call, which now fires even with no
      // moved files to release orphaned episodes back to "missing") retry
      // on the same 15s cadence if the callback itself failed, instead of
      // silently never retrying because [] is falsy-length.
      if (m?.libraryRef && m?.movedFiles && !m.notifiedLibrary && !m.replacementFailure?.discarded
          && (!m.replacementFailure?.retryAt || Date.now() >= m.replacementFailure.retryAt)
          && !m.notifyInFlight && (!m.lastNotifyAttempt || Date.now() - m.lastNotifyAttempt > 15_000)) {
        m.lastNotifyAttempt = Date.now();
        m.notifyInFlight = true;
        this._notifyLibrary(m.libraryRef, m.movedFiles, infoHash)
          .then((ok) => { if (ok) { m.notifiedLibrary = true; m.completed = true; } })
          .catch(() => {})
          .finally(() => { m.notifyInFlight = false; });
      }
    }

    for (const t of this._clientList()) {
      const m = this.meta.get(t.infoHash);
      if (m?.completed) continue;
      this._checkStall(t);
      if (this._isDone(t) && !m?.finishing) {
        this.onComplete(t.infoHash).catch((e) =>
          console.error(`[engine:${this.cfg.id}][${this.cfg.logTag}] onComplete tick failed:`, e.message)
        );
      }
    }
  }

  // ─── Commands ────────────────────────────────────────────────────────────

  async remove(infoHash, deleteData) {
    infoHash = infoHash.toLowerCase();
    if (this.manualSeed?.report(infoHash) && !(await this.manualSeed.stop(infoHash))) return false;
    const m = this.meta.get(infoHash);
    if (!m) {
      // Completed/imported torrent: clean the history entry.
      if (this.importedHistory.has(infoHash)) {
        this.importedHistory.delete(infoHash);
        await this._dropCachedTorrentFile?.(infoHash);
        this.onChange();
        return true;
      }
      return false;
    }
    m.finishing = true;
    const snap = this._clientSnapshot(infoHash);
    // _clientRemove can silently fail to resolve the client's internal handle
    // (client lookup miss) and return false without
    // throwing — confirmed live: this used to fall straight through to
    // meta.delete() below regardless, wiping libraryRef and every other
    // bookkeeping field while the torrent kept running/seeding in the actual
    // client, completely untouched. From that point Movviz had zero record
    // of it ever existing — showing up later as a permanently "unlinked"
    // torrent with no way back short of a blind filename-matching recovery
    // scan. Only wipe this backend's own state once the client itself
    // confirms the torrent is actually gone (either _clientRemove returned
    // true, or an independent _clientGet lookup shows it's no longer there).
    const removed = await this._clientRemove(infoHash, deleteData).catch(() => false);
    if (!removed && this._clientGet(infoHash)) {
      m.finishing = false;
      return false;
    }
    if (deleteData && !m.completed && snap?.name) {
      const safeName = snap.name.replace(/[/\\:]/g, "_").replace(/\.\.+/g, "_");
      const cleanupTarget = path.join(this.cfg.downloadPath, safeName);
      const resolved = path.resolve(cleanupTarget);
      if (resolved.startsWith(path.resolve(this.cfg.downloadPath)) && resolved !== path.resolve(this.cfg.downloadPath)) {
        await fsp.rm(resolved, { recursive: true, force: true }).catch(() => {});
      }
      for (const f of (snap.files ?? [])) {
        const fp = f.path ? (path.isAbsolute(f.path) ? f.path : path.join(this.cfg.downloadPath, f.path)) : null;
        if (fp && path.resolve(fp).startsWith(path.resolve(this.cfg.downloadPath))) {
          try { await fsp.unlink(fp); } catch {}
        }
      }
      try {
        const dlPath = path.resolve(this.cfg.downloadPath);
        const entries = await fsp.readdir(dlPath, { withFileTypes: true });
        for (const e of entries) {
          if (e.isDirectory()) {
            const dp = path.join(dlPath, e.name);
            try {
              const contents = await fsp.readdir(dp, { withFileTypes: true, recursive: true });
              const hasVideo = contents.some((c) => c.isFile() && VIDEO_EXT_RE.test(c.name));
              if (!hasVideo) await fsp.rm(dp, { recursive: true, force: true });
              else try { await fsp.rmdir(dp); } catch {}
            } catch { try { await fsp.rmdir(dp); } catch {} }
          }
        }
      } catch {}
    }
    await this._dropCachedTorrentFile?.(infoHash);
    this.importedHistory.delete(infoHash);
    this.meta.delete(infoHash);
    this.reconcileQueue();
    this.onChange();
    return true;
  }

  async pause(infoHash) {
    const key = infoHash.toLowerCase();
    const m = this.meta.get(key) ?? this.meta.get(infoHash);
    const previouslyPaused = m?.userPaused;
    if (m) m.userPaused = true;
    // Ensure the persisted meta key is lowercased for future lookups
    if (m && this.meta.has(infoHash) && infoHash !== key) {
      this.meta.set(key, m);
      this.meta.delete(infoHash);
    }
    let ok = false;
    try { ok = await this._clientPause(key); } catch { /* reported to caller */ }
    if (!ok && m) m.userPaused = previouslyPaused;
    this.onChange();
    return ok;
  }

  async resume(infoHash) {
    const key = infoHash.toLowerCase();
    const m = this.meta.get(key) ?? this.meta.get(infoHash);
    let ok = false;
    try { ok = await this._clientResume(key); } catch { /* reported to caller */ }
    if (!ok) return false;
    if (m) {
      m.userPaused = false;
      m.stalled = false;
      m.stalledAt = null;
      m.dequeuedAt = null;
      m.queued = false;
      m.lastActivityAt = Date.now();
      m.lastActivitySampleAt = null;
    }
    if (m && this.meta.has(infoHash) && infoHash !== key) {
      this.meta.set(key, m);
      this.meta.delete(infoHash);
    }
    this.onChange();
    return true;
  }

  /**
   * Post-completion manual seed toggle — deliberately separate from pause()/
   * resume() above (those are "pause the active download", a different
   * concept). Only valid once a torrent is completed; state only flips on
   * confirmed success so a failed stop never lies that uploads actually
   * stopped, and a failed start never claims seeding is active.
   */
  async startSeeding(infoHash) {
    infoHash = infoHash.toLowerCase();
    const rec = this.importedHistory.get(infoHash);
    const m = this.meta.get(infoHash);
    if (!rec || m?.replacementFailure || rec.replacementFailure || (m && (!m.completed || m.processing || (m.libraryRef && !m.notifiedLibrary)))) return false;
    if (["verifying", "full", "partial"].includes(this.manualSeed.report(infoHash)?.state)) return true;
    // Detach any remaining download handle before opening library data read-only.
    if (this._clientGet(infoHash)) {
      const removed = await this._clientRemove(infoHash, false).catch(() => false);
      if (!removed && this._clientGet(infoHash)) return false;
    }
    return this.manualSeed.start(rec);
  }

  async stopSeeding(infoHash) {
    infoHash = infoHash.toLowerCase();
    if (!this.importedHistory.has(infoHash)) return false;
    return this.manualSeed.stop(infoHash);
  }

  setSequential(infoHash, on) {
    const m = this.meta.get(infoHash);
    if (m) m.sequential = on;
    return this._clientSetSequential(infoHash, on);
  }

  setFilePriorities(infoHash, p) {
    return this._clientSetFilePriorities(infoHash, p);
  }

  setPriority(infoHash, priority) {
    const m = this.meta.get(infoHash);
    if (m) {
      m.priority = priority;
      // Override manuel : remonte dans la file (efface la remise en dernier du
      // recovery) et débloque un torrent stalled (le remet en course — il sera
      // re-stallé 2 min plus tard s'il ne bouge toujours pas).
      if (m.dequeuedAt) m.dequeuedAt = null;
      if (m.stalled) {
        m.stalled = false;
        m.stalledAt = null;
        // Réarme le compteur d'activité : le re-stall ne survient qu'après
        // 2 min d'inactivité réelle, pas immédiatement au tick suivant.
        m.lastActivityAt = Date.now();
        if (m.queued) {
          m.queued = false;
          Promise.resolve(this._clientResume(infoHash)).catch(() => {});
        }
      }
    }
    this._clientSetPriority(infoHash, priority);
    this.reconcileQueue();
    this.onChange();
    return true;
  }

  detail(infoHash) {
    const t = this._clientGet(infoHash);
    if (t) return this.summary(t, true);
    const rec = this.importedHistory.get(infoHash);
    if (rec) return this.importedSummary(rec);
    return null;
  }

  // ─── Reporting ───────────────────────────────────────────────────────────

  summary(t, detail = false) {
    const m = this.meta.get(t.infoHash);
    const imported = this.importedHistory?.get(t.infoHash);
    if (!m && imported) return this.importedSummary(imported);
    const bytesComplete = Number(t.length) > 0 && Number(t.downloaded) >= Number(t.length);
    const isSeeding = m?.seeding || this._isDone(t) || bytesComplete;
    // Re-hash phase after a restart, reported by
    // the backend as t.verifying. Must win over stalled/queued so a torrent
    // mid-verification never shows as blocked or stuck in the queue.
    const verifying = !!t.verifying || !!m?.verifying;
    const state = m?.replacementFailure ? "blocked" : m?.importAbandoned ? "blocked" : verifying ? "verifying" : m?.completed ? (m.seeding ? "seeding" : "completed") : m?.userPaused ? "paused" : isSeeding ? "seeding" : m?.stalled ? "blocked" : m?.queued ? "queued" : "downloading";
    const base = {
      infoHash: t.infoHash,
      name: t.name ?? t.infoHash,
      size: t.length ?? 0,
      length: t.length ?? 0,
      downloaded: t.downloaded ?? 0,
      progress: t.length > 0 ? (t.downloaded ?? 0) / t.length : 0,
      downloadSpeed: t.downloadSpeed ?? 0,
      uploadSpeed: t.uploadSpeed ?? 0,
      numPeers: t.numPeers ?? 0,
      ratio: t.ratio ?? 0,
      timeRemaining: t.timeRemaining ?? null,
      state,
      addedAt: m?.addedAt ?? null,
      completedAt: m?.completedAt ?? null,
      libraryRef: m?.libraryRef ?? null,
      title: m?.title ?? null,
      year: m?.year ?? null,
      priority: m?.priority ?? "medium",
      sequential: m?.sequential ?? false,
      userPaused: m?.userPaused ?? false,
      queued: m?.queued ?? false,
      stalled: m?.stalled ?? false,
      // Confirmed manual post-import sharing; the badge follows this flag.
      replacementFailure: m?.replacementFailure,
      seeding: m?.seeding ?? false,
      category: this.cfg.category,
      instanceId: this.cfg.id,
      ...(m?.movedFiles?.some(file => file.episodePlacement) ? { movedTo: m.movedTo, movedFiles: m.movedFiles } : {}),
    };
    if (detail) base.files = (t.files ?? []).map((f) => ({
      name: f.name, path: f.path, length: f.length, downloaded: f.downloaded ?? 0,
    }));
    return this._seedSummary(base);
  }

  _seedSummary(base) {
    const seed = this.manualSeed?.report(base.infoHash);
    if (!seed) return base;
    const { uploadSpeed, numPeers, uploaded, ratio, ...seedStatus } = seed;
    const seeding = seed.state === "full" || seed.state === "partial";
    return { ...base, seedStatus, seeding, state: seed.state === "verifying" ? "verifying" : seeding ? "seeding" : "completed", downloadSpeed: 0, uploadSpeed, numPeers, uploaded, ratio };
  }

  importedSummary(rec) {
    return this._seedSummary({
      infoHash: rec.infoHash,
      replacementFailure: rec.replacementFailure,
      name: rec.name,
      size: rec.size,
      length: rec.size,
      downloaded: rec.size,
      progress: 1,
      downloadSpeed: 0,
      uploadSpeed: 0,
      numPeers: 0,
      ratio: 0,
      state: rec.replacementFailure ? "blocked" : "completed",
      addedAt: rec.addedAt,
      completedAt: rec.completedAt,
      libraryRef: rec.libraryRef ?? null,
      title: rec.title ?? null,
      year: rec.year ?? null,
      priority: "medium",
      sequential: false,
      userPaused: false,
      queued: false,
      stalled: false,
      // A torrent restored from history after an engine restart has no live
      // client-side handle behind it (WebTorrent's in-memory client is gone)
      // — nothing is genuinely seeding until the user explicitly toggles it
      // back on, so this is never true for an imported/restored record.
      seeding: false,
      category: this.cfg.category,
      instanceId: this.cfg.id,
      movedTo: rec.movedTo ?? null,
      ...(rec.movedFiles?.some(file => file.episodePlacement) ? { movedFiles: rec.movedFiles } : {}),
    });
  }

  list() {
    const out = [];
    const seen = new Set();
    for (const t of this._clientList()) {
      out.push(this.summary(t));
      seen.add(t.infoHash);
    }
    for (const rec of this.importedHistory.values()) {
      if (!seen.has(rec.infoHash)) out.push(this.importedSummary(rec));
    }
    return out;
  }

  // ─── Persistence ─────────────────────────────────────────────────────────

  persistable() {
    const out = [];
    const seen = new Set();
    for (const t of this._clientList()) {
      const m = this.meta.get(t.infoHash);
      if (!m) continue;
      seen.add(t.infoHash);
      out.push({
        infoHash: t.infoHash,
        magnetURI: t.magnetURI ?? m.magnetURI ?? null,
        name: t.name ?? t.infoHash,
        size: t.length ?? 0,
        addedAt: m.addedAt,
        completedAt: m.completedAt,
        movedTo: m.movedTo,
        movedFiles: this.importedHistory.get(t.infoHash)?.movedFiles ?? m.movedFiles,
        notifiedLibrary: m.notifiedLibrary ?? this.importedHistory.get(t.infoHash)?.notifiedLibrary,
        replacementFailure: m.replacementFailure,
        libraryRef: m.libraryRef ?? null,
        title: m.title ?? null,
        year: m.year ?? null,
        episodeTarget: m.episodeTarget ?? null,
        episodeTargets: m.episodeTargets ?? null,
        userPaused: m.userPaused,
        sequential: m.sequential,
        priority: m.priority,
        stalled: m.stalled ?? false,
        stalledAt: m.stalledAt ?? null,
        dequeuedAt: m.dequeuedAt ?? null,
        paused: m.userPaused,
      });
    }
    for (const rec of this.importedHistory.values()) {
      if (seen.has(rec.infoHash)) continue;
      out.push({
        infoHash: rec.infoHash,
        magnetURI: rec.magnetURI,
        name: rec.name,
        size: rec.size,
        movedTo: rec.movedTo,
        replacementFailure: this.meta.get(rec.infoHash)?.replacementFailure ?? rec.replacementFailure,
        movedFiles: rec.movedFiles ?? this.meta.get(rec.infoHash)?.movedFiles,
        notifiedLibrary: rec.notifiedLibrary ?? this.meta.get(rec.infoHash)?.notifiedLibrary,
        addedAt: rec.addedAt,
        completedAt: rec.completedAt,
        libraryRef: rec.libraryRef,
        title: rec.title,
        year: rec.year,
      episodeTarget: rec.episodeTarget ?? null,
      episodeTargets: rec.episodeTargets ?? null,
        userPaused: false,
        sequential: false,
        priority: "medium",
        paused: false,
      });
    }
    return out;
  }

  applyConfig(patch) {
    Object.assign(this.cfg, patch);
    this._applyThrottle?.();
    this._seedClient?.throttleUpload((this.cfg.uploadLimitKbps || 0) * 1024 || -1);
  }

  // ─── Import files (shared) ───────────────────────────────────────────────

  /** Recovery uses the same persisted selection/placement as first import.
   * Never reconstruct an ambiguous anime episode from a leftover filename. */
  async retryEpisodePlacementImport(infoHash) {
    const m = this.meta.get(infoHash);
    const targets = m?.episodeTargets ?? (m?.episodeTarget ? [m.episodeTarget] : []);
    if (!m?.libraryRef || !targets.length || targets.some(t => !t.library || !t.placement)) throw new Error("episode_placement_recovery_unavailable");
    if (m.movedTo && m.movedFiles) {
      const ok = await this._notifyLibrary(m.libraryRef, m.movedFiles, infoHash);
      if (!ok) throw new Error("episode_placement_callback_pending");
      return { ok: true, files: m.movedFiles };
    }
    const handle = this._clientGet(infoHash);
    if (!handle || !this._isDone(handle)) throw new Error("episode_placement_download_incomplete");
    const snapshot = this._clientSnapshot(infoHash);
    await this._import(snapshot, Number(this.cfg.seedRatio) > 0 ? linkOrCopy : movePath);
    if (!m.notifiedLibrary) throw new Error("episode_placement_callback_pending");
    m.completed = true;
    this.onChange();
    return { ok: true, files: m.movedFiles };
  }

  async _import(snap, transfer) {
    const m = this.meta.get(snap.infoHash);
    if (!m || m.movedTo) return;

    const naming = loadNamingTemplates();
    const movedFiles = [];
    const targetList = m.episodeTargets ?? (m.episodeTarget ? [m.episodeTarget] : null);
    // Remember which target each file was selected for — _matchesEpisode
    // already resolves season/episode for files whose name carries neither
    // (path-based season + absolute-numbering fallback, see below it). That
    // resolution is otherwise thrown away: the per-file loop below re-parses
    // file.name from scratch and would end up with season/episode both null
    // for exactly those files.
    const matchedTargetByFile = new Map();
    const placementByFile = new Map();
    validateEpisodeTargets(targetList ?? []);
    const availableFiles = snap.files.filter((f) => {
      if (f.selected === false) return false;
      if (!targetList) return true;
      const matches = targetList.filter((t) => this._matchesEpisode(f, t, targetList));
      if (matches.length) {
        matchedTargetByFile.set(f, matches[0]);
        const placement = resolveEpisodePlacement(matches, parseRelease(f.name), f.name);
        if (placement) placementByFile.set(f, placement);
      }
      return matches.length > 0;
    });
    // Validate every destination identity before transferring the first file.
    const presentations = new Map();
    for (const explicit of placementByFile.values()) if (explicit.presentation) {
      const previous = presentations.get(explicit.presentation.folder);
      if (previous && JSON.stringify(previous) !== JSON.stringify(explicit.presentation)) throw new Error("conflicting_episode_presentation");
      presentations.set(explicit.presentation.folder, explicit.presentation);
    }
    for (const presentation of presentations.values()) await ensurePresentationFolder(this.cfg.completedPath, presentation);

    // Diagnostic: a video file that's actually part of this torrent but
    // matched NO target is exactly how a season pack silently loses episodes
    // — confirmed live twice (Dragon Ball Super, Blood Lad): the torrent
    // downloads 100%, but _matchesEpisode only recognizes a subset of files
    // against episodeTargets, and _cleanupDownloadFolder then deletes
    // literally everything in the download folder regardless, including the
    // unmatched originals — an unrecoverable loss with no trace of what
    // those files even were. Log every miss with enough detail (parsed
    // season/episode, path-derived season, raw name) to diagnose why the
    // match failed, and flag the torrent so cleanup below refuses to run
    // instead of destroying files nothing ever accounted for.
    if (targetList) {
      // Exclude tiny video files — bundled samples/trailers are almost
      // always well under this, never a real episode, and would otherwise
      // trip the guard on an import that's actually completely fine.
      const MIN_EPISODE_BYTES = 50 * 1024 * 1024;
      const unmatchedVideo = snap.files.filter(
        (f) => f.selected !== false && VIDEO_EXT_RE.test(f.name) && !matchedTargetByFile.has(f) && (f.length ?? 0) >= MIN_EPISODE_BYTES
      );
      if (unmatchedVideo.length > 0) {
        m.hasUnmatchedFiles = true;
        console.warn(
          `[engine:${this.cfg.id}][${this.cfg.logTag}][import-match] ${snap.name}: ${unmatchedVideo.length} fichier(s) vidéo non apparié(s) sur ${targetList.length} cible(s), ${matchedTargetByFile.size} apparié(s) — nettoyage désactivé pour ce torrent.`
        );
        for (const f of unmatchedVideo) {
          const info = parseRelease(f.name);
          console.warn(
            `[engine:${this.cfg.id}][${this.cfg.logTag}][import-match]   ✗ ${f.path} — parsed S${info.season ?? "?"}E${info.episode ?? "?"}, pathSeason=${this._seasonFromPath(f.path) ?? "?"}`
          );
        }
      }
    }

    if (!naming.enabled && placementByFile.size === 0) {
      let firstDest = null;
      for (const file of availableFiles) {
        const src = path.isAbsolute(file.path) ? file.path : path.join(this.cfg.downloadPath, file.path);
        const dest = path.join(this.cfg.completedPath, file.path);
        await transfer(src, dest);
        // Replace download copy with symlink → library to seed from
        // the library file (saves disk and keeps library as single source of truth).
        if (transfer === linkOrCopy) {
          if (!(await this._swapForSymlink(src, dest))) m.symlinkVerificationFailed = true;
        }
        firstDest ??= path.join(this.cfg.completedPath, snap.name);
        // Keep the torrent's original identity independently of the library filename.
        movedFiles.push({ path: dest, quality: null, resolution: null, size: file.length, originalPath: torrentPath(path.isAbsolute(file.path) ? path.relative(this.cfg.downloadPath, file.path) : file.path) });
      }
      m.movedTo = firstDest ?? this.cfg.completedPath;
    } else {
      const videoFiles = availableFiles.filter((f) => VIDEO_EXT_RE.test(f.name));
      // The empty-videoFiles fallback below exists for genuinely unusual
      // rips (e.g. ISO) whose extension VIDEO_EXT_RE doesn't cover — but it
      // must never pick up known junk (nfo/txt/jpg/sfv/...) as "the episode
      // to rename": confirmed live (Smallville intégrale) — once every real
      // video file had already been matched/moved on an earlier partial run,
      // videoFiles came back empty and the fallback tried to rename the
      // release's leftover .nfo to an episode filename (e.g. "S03E02.nfo"),
      // failing with ENOENT once that file didn't match what was on disk.
      // These extras aren't used for anything (Movviz has no .nfo parsing —
      // TMDb/TVDB drive all metadata) and are already swept up unconditionally
      // by _cleanupDownloadFolder once the torrent finishes, so simply
      // leaving them out of `targets` here is enough — no separate delete needed.
      const nonJunk = availableFiles.filter((f) => !JUNK_EXT_RE.test(f.name));
      let targets = videoFiles.length ? videoFiles : nonJunk;
      // A movie is exactly one video file. Importing every file of a torrent
      // into the movie folder is how a season pack ended up as 12 "Title
      // (2026) (2).mkv … (13).mkv" (avoidCollision suffixes) next to the
      // film: a torrent with several episode files is not a movie at all —
      // import nothing (the library releases the movie back to "missing");
      // otherwise keep only the largest file and leave extras/samples out.
      if (this.cfg.category !== "series" && targets.length > 1) {
        const episodic = targets.filter((f) => parseRelease(f.name).episode != null);
        if (episodic.length >= 2) {
          console.warn(`[engine:${this.cfg.id}][${this.cfg.logTag}]   ${snap.name} — ${episodic.length} fichiers d'épisodes dans un torrent « film » : import refusé`);
          targets = [];
        } else {
          targets = [targets.reduce((a, b) => (b.length > a.length ? b : a))];
        }
      }
      const releaseInfo = parseRelease(snap.name);
      let firstDest = null;
      for (const file of targets) {
        const fileInfo = parseRelease(file.name);
        // Clone ! Ne PAS réutiliser releaseInfo directement : la résolution
        // matchedTarget ci-dessous mute `info` — l'objet partagé corromprait
        // tous les fichiers suivants (confirmé live : un pack Trigun entier
        // renommé 25× "S01E03" puis "S01E04").
        const info = { ...(fileInfo.season != null || fileInfo.episode != null ? fileInfo : releaseInfo) };
        if (m.title) info.title = m.title;
        if (m.year) info.year = String(m.year);
        // Neither the filename nor the overall release name carried a season
        // and/or episode (e.g. an anime pack with absolute episode numbering,
        // or per-season subfolders but season-less filenames). Without a
        // fallback, `info.season`/`info.episode` stay null, which both
        // misfiles the library folder ("Season 00") and — more importantly —
        // makes the library-side import (applyImportedFiles) unable to match
        // this file to any episode: the "series"/"season"/"episode" branches
        // all require a concrete season/episode number (movedFileCoversEpisode
        // returns false whenever f.episode is null). Reuse the target this
        // file was already matched against above (same _matchesEpisode call,
        // which already resolves season via folder path and episode via
        // absolute-number-in-filename) rather than re-guessing blind.
        if (info.season == null || info.episode == null) {
          const matchedTarget = matchedTargetByFile.get(file);
          if (matchedTarget) {
            if (info.season == null) info.season = matchedTarget.season;
            if (info.episode == null) info.episode = matchedTarget.episode;
          } else if (info.season == null) {
            const pathSeason = this._seasonFromPath(file.path);
            if (pathSeason != null) info.season = pathSeason;
          }
        }
        const explicit = placementByFile.get(file);
        if (explicit) {
          info.season = explicit.placement.season;
          info.episode = explicit.placement.episode;
          info.episodeEnd = explicit.placement.episodeEnd ?? null;
          if (explicit.presentation) { info.title = explicit.presentation.title; info.year = String(explicit.presentation.year); }
        }
        const ctx = buildContext(info);
        const ext = path.extname(file.name);
        let dest;
        if (this.cfg.category === "series") {
          const seriesFolder = explicit?.presentation?.folder ?? renderSegment(naming.seriesFolder, ctx, naming.useDotsInsteadOfSpaces);
          // Specials always land in a literal "Specials" folder regardless of
          // the user's season-folder template — Plex specifically expects
          // "Specials" or "Season 00", and there's no real reason to let the
          // naming template vary for this one folder the way it can for
          // regular seasons.
          const seasonFolder = ctx.season === 0 ? "Specials" : explicit ? `Season ${String(ctx.season).padStart(2, "0")}` : renderSegment(naming.seasonFolder, ctx, naming.useDotsInsteadOfSpaces);
          // A series file whose episode number couldn't be resolved (no target
          // list on the torrent, filename/release name carrying none, no path
          // season) would render an EMPTY "S01E" placeholder in the episode
          // template — and every such file in the same pack would collide on
          // the SAME destination path, each rename silently overwriting the
          // previous one (confirmed live: a full season pack collapsed into a
          // single "Noblesse - S01E.mkv"). Keep the original basename instead:
          // unique per file, never overwritten, still discoverable by the
          // rename/rescan tooling once an episode can be identified.
          let fileName =
            info.episode == null
              ? path.basename(file.name)
              : renderSegment(naming.episodeFile, ctx, naming.useDotsInsteadOfSpaces) + ext;
          if (explicit) {
            const rendered = parseRelease(fileName);
            if (rendered.season !== info.season || rendered.episode !== info.episode || (rendered.episodeEnd ?? null) !== (info.episodeEnd ?? null)) {
              const range = explicit.placement.episodeEnd ? `-E${String(explicit.placement.episodeEnd).padStart(2, "0")}` : "";
              fileName = renderSegment("{title} - S{season:00}E{episode:00}", ctx, naming.useDotsInsteadOfSpaces) + range + ext;
            }
          }
          dest = await avoidCollision(path.join(this.cfg.completedPath, seriesFolder, seasonFolder, fileName));
        } else {
          const movieFolder = renderSegment(naming.movieFolder, ctx, naming.useDotsInsteadOfSpaces);
          const fileName = renderSegment(naming.movieFile, ctx, naming.useDotsInsteadOfSpaces) + ext;
          dest = await avoidCollision(path.join(this.cfg.completedPath, movieFolder, fileName));
        }
        const src = path.isAbsolute(file.path) ? file.path : path.join(this.cfg.downloadPath, file.path);
        await transfer(src, dest);
        if (transfer === linkOrCopy) {
          if (!(await this._swapForSymlink(src, dest))) m.symlinkVerificationFailed = true;
        }
        firstDest ??= dest;
        movedFiles.push({
          path: dest, quality: ctx.quality || null, resolution: ctx.resolution || null,
          videoCodec: ctx.videoCodec || null, audioCodec: ctx.audioCodec || null,
          hdr: ctx.hdr || null, source: ctx.source || null, size: file.length,
          season: explicit?.library.season ?? info.season ?? null, episode: explicit?.library.episode ?? info.episode ?? null,
          episodeEnd: explicit?.library.episodeEnd ?? info.episodeEnd ?? null,
          ...(explicit ? { episodePlacement: explicit } : {}),
          // See the equivalent comment in the !naming.enabled branch above.
          originalPath: torrentPath(path.isAbsolute(file.path) ? path.relative(this.cfg.downloadPath, file.path) : file.path),
        });
      }
      m.movedTo = firstDest ?? this.cfg.completedPath;
    }

    this.importedHistory.set(snap.infoHash, {
      infoHash: snap.infoHash, magnetURI: snap.magnetURI ?? null, name: snap.name,
      size: snap.length, movedTo: m.movedTo, addedAt: m.addedAt,
      completedAt: m.completedAt, libraryRef: m.libraryRef ?? null,
      title: m.title ?? null, year: m.year ?? null,
      episodeTarget: m.episodeTarget ?? null, episodeTargets: m.episodeTargets ?? null,
      ...(movedFiles.some(file => file.episodePlacement) ? { notifiedLibrary: false } : {}),
      // Original torrent paths survive import and process restarts for manual seed.
      movedFiles: movedFiles.map((f) => ({ ...f })),
    });

    this.onChange();
    // Notify even with zero moved files — confirmed live (Futurama S6): a
    // "season pack" release can download 100% and structurally not contain
    // ANY of the targeted episodes at all (e.g. a release group's own
    // "season 6" only covers a different episode range than TMDb/TVDB's —
    // not a filename-parsing bug, the episodes just genuinely aren't in this
    // release). Previously this branch only ran when movedFiles.length > 0,
    // so the library callback — and with it applyImportedFiles's
    // releaseIfOrphaned reset — never fired, leaving every targeted episode
    // stuck on "downloading" forever with no path back to "missing" for a
    // retry. The callback (and the web app's route) both already handle an
    // empty files array correctly: every episode still claiming this
    // infoHash gets released back to "missing" instead of silently orphaned.
    if (m.libraryRef) {
      m.movedFiles = movedFiles;
      const ok = await this._notifyLibrary(m.libraryRef, movedFiles, snap.infoHash);
      if (ok) {
        m.notifiedLibrary = true;
        console.log(`[engine:${this.cfg.id}][${this.cfg.logTag}]   bibliothèque notifiée ✓${movedFiles.length === 0 ? " (0 fichier — cibles relâchées vers « manquant »)" : ""}`);
      } else {
        console.warn(`[engine:${this.cfg.id}][${this.cfg.logTag}]   bibliothèque injoignable — retry automatique dans ~15s`);
      }
    }
    // No files matched the episode targets — nothing to import, stop retrying.
    if (movedFiles.length === 0 && m.libraryRef) {
      m.completed = true;
    }
  }

  /**
   * Replaces a download-folder file with a symlink to its library copy —
   * ONLY once that library copy is confirmed present with a matching size.
   * `fsp.cp`/`fsp.link`'s fallback copy inside linkOrCopy() doesn't checksum
   * or size-verify against the source, so without this check a silently
   * incomplete copy (torrent client still flushing the file, a transient
   * I/O hiccup) could get "confirmed" by unlinking the only good copy —
   * exactly the failure mode this function exists to rule out before
   * touching `src` at all. If verification fails, both copies are left in
   * place (safe but not cleaned up) rather than guessing.
   *
   * Returns true only if the swap fully completed as expected (verified +
   * symlinked) — callers MUST treat a false return as "do not assume this
   * file is safe to clean up elsewhere" (see the symlinkVerificationFailed
   * flag set by _import's callers, which gates _cleanupDownloadFolder: that
   * method deletes the whole download folder unconditionally once called,
   * so it must never run while a file this function declined to touch is
   * still sitting there as the only good copy).
   */
  async _swapForSymlink(src, dest) {
    let verified = false;
    try {
      const [s, d] = await Promise.all([fsp.stat(src), fsp.stat(dest)]);
      verified = s.size === d.size;
    } catch {
      verified = false; // stat failing on either side — cannot confirm, do nothing
    }
    if (!verified) {
      console.error(`[engine:${this.cfg.id}][${this.cfg.logTag}] skipping cleanup of ${src}: destination copy not verified (size mismatch or unreadable) — leaving both copies in place`);
      return false;
    }
    await fsp.unlink(src).catch(() => {});
    const linked = await fsp.symlink(dest, src).then(() => true).catch(() => false);
    if (!linked) {
      console.error(`[engine:${this.cfg.id}][${this.cfg.logTag}] symlink swap failed after removing ${src} — seeding source for this file is now missing (library copy at ${dest} is unaffected)`);
    }
    return linked;
  }

  async _cleanupReplacementSource(snap, movedFiles = []) {
    const root = path.resolve(this.cfg.downloadPath), library = path.resolve(this.cfg.completedPath);
    for (const file of [...(snap?.files ?? []), ...movedFiles.map(file => ({ path: file.originalPath }))]) {
      if (!file.path) continue;
      const candidate = path.resolve(root, file.path), relative = path.relative(root, candidate), libraryRelative = path.relative(library, candidate);
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || !libraryRelative || (!libraryRelative.startsWith("..") && !path.isAbsolute(libraryRelative))) continue;
      await fsp.unlink(candidate).catch(() => {});
      // Remove only empty parents of this file, never the download root or other contents.
      let folder = path.dirname(candidate);
      while (folder !== root && folder.startsWith(root + path.sep)) {
        try { await fsp.rmdir(folder); } catch { break; }
        folder = path.dirname(folder);
      }
    }
  }

  async _notifyLibrary(libraryRef, files, infoHash) {
    try {
      const res = await fetch(`${WEB_CALLBACK_URL}/api/library/import`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-movviz-token": ENGINE_TOKEN },
        body: JSON.stringify({ libraryRef, category: this.cfg.category, files, infoHash }),
      });
      const m = this.meta.get(infoHash);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        if (body.error === "replacement_refused" && body.replacementFailure && m) {
          m.replacementFailure = body.replacementFailure;
          m.seeding = false;
          m.completed = false;
          const history = this.importedHistory.get(infoHash);
          if (history) history.replacementFailure = m.replacementFailure;
          if (m.replacementFailure.discarded) {
            const snap = (() => { try { return this._clientSnapshot(infoHash); } catch { return { files: (m.movedFiles ?? []).map(file => ({ path: file.originalPath })) }; } })();
            // Stop sharing before removing only this download's uninstalled source files.
            const removed = await this._clientRemove(infoHash, false).catch(() => false);
            if (removed || !this._clientGet(infoHash)) {
              await this._cleanupReplacementSource(snap, m.movedFiles);
              await this._dropCachedTorrentFile?.(infoHash);
            }
            const record = this.importedHistory.get(infoHash) ?? { infoHash, name: m.title ?? snap?.name ?? infoHash, size: snap?.length ?? 0, libraryRef, addedAt: m.addedAt, completedAt: Date.now() };
            this.importedHistory.set(infoHash, { ...record, replacementFailure: m.replacementFailure });
            this.emitActivity("failed", {
              media: { id: libraryRef.split(":")[1], title: m.title ?? snap?.name ?? infoHash, type: this.cfg.category, href: "#" },
              failure: { code: "import_failed", message: `Remplacement impossible : ${{ fileInUse: "fichier utilisé", nameOccupied: "nom déjà occupé", incomplete: "fichier incomplet", unavailable: "fichier inaccessible" }[m.replacementFailure.reason] ?? "fichier inaccessible"}. Après 3 nouvelles tentatives : nouveau supprimé, ancien conservé.` },
              metadata: { libraryRef },
            });
          }
          this.onChange();
        }
        console.error(`[engine:${this.cfg.id}][${this.cfg.logTag}] library import callback failed: HTTP ${res.status}`);
        return false;
      }
      const result = await res.json().catch(() => ({}));
      // The library may rename a collision file once replacement succeeds.
      // Persist its final path, never the temporary pre-replacement location.
      const history = this.importedHistory.get(infoHash);
      if (m) m.notifiedLibrary = true;
      if (history) history.notifiedLibrary = true;
      for (const changed of result.seedPaths ?? []) {
        if (typeof changed.from !== "string" || typeof changed.to !== "string") continue;
        for (const list of [files, m?.movedFiles, history?.movedFiles]) {
          for (const file of list ?? []) if (file.path === changed.from) file.path = changed.to;
        }
        if (history?.movedTo === changed.from) history.movedTo = changed.to;
        if (m?.movedTo === changed.from) m.movedTo = changed.to;
      }
      if (m?.replacementFailure) {
        const snap = (() => { try { return this._clientSnapshot(infoHash); } catch { return { files: (m.movedFiles ?? []).map(file => ({ path: file.originalPath })) }; } })();
        if (snap) await this._cleanupReplacementSource(snap, m.movedFiles);
      }
      if (m) delete m.replacementFailure;
      if (history) delete history.replacementFailure;
      this.onChange();
      return true;
    } catch (e) {
      console.error(`[engine:${this.cfg.id}][${this.cfg.logTag}] library import callback unreachable:`, e.message);
      return false;
    }
  }

  async _finish(snap, alreadyImported) {
    const m = this.meta.get(snap.infoHash);
    if (!m) return;
    m.completed = true;
    m.completedAt ??= Date.now();

    let importOk = false;
    if (!alreadyImported && this.cfg.autoMoveOnComplete) {
      try {
        await this._import(snap, movePath);
        importOk = true;
      } catch (e) {
        // Unlike onComplete's linkOrCopy path (which used to retry this
        // forever with no backoff — see IMPORT_MAX_RETRIES), this path
        // (movePath, seedRatio<=0) already only runs once: m.completed is
        // set unconditionally above regardless of outcome, so onComplete's
        // own guard prevents a retry loop here. But a failure was
        // previously ONLY a console.error with no emitActivity call at
        // all — silent from the user's point of view, no bell/webhook, no
        // visible reason the torrent never showed up in the library.
        console.error(`[engine:${this.cfg.id}][${this.cfg.logTag}] move failed:`, e.message);
        this.emitActivity("failed", {
          media: {
            id: m.libraryRef?.split(":")[1] ?? snap.infoHash,
            title: m.title ?? snap.name ?? "Inconnu",
            type: this.cfg.category,
            href: m.libraryRef ? `/title/${this.cfg.category}/${m.year ?? ""}` : "#",
          },
          failure: { code: "import_failed", message: e.message ?? "Échec du déplacement des fichiers" },
          metadata: { libraryRef: m.libraryRef ?? undefined },
        });
      }
    } else {
      importOk = true;
    }

    // Only delete the download folder if the import/move succeeded — otherwise
    // the original files are still needed in the download directory. Also
    // gated on !m.symlinkVerificationFailed for the same reason as the other
    // _cleanupDownloadFolder call site in onComplete() above — this branch
    // is reached both for path A (movePath, where the flag is never set)
    // and for a retried linkOrCopy import (alreadyImported=true, where it
    // can be). ALSO gated on !m.hasUnmatchedFiles — see the matching guard
    // in onComplete() above for why.
    if (importOk && !m.replacementFailure && this.cfg.autoMoveOnComplete && snap.name && !m.symlinkVerificationFailed && !m.hasUnmatchedFiles) {
      await this._cleanupDownloadFolder(snap);
    }

    if (!this.importedHistory.has(snap.infoHash)) {
      this.importedHistory.set(snap.infoHash, {
        infoHash: snap.infoHash, magnetURI: snap.magnetURI ?? null, name: snap.name,
        size: snap.length, movedTo: m.movedTo ?? path.join(this.cfg.downloadPath, snap.name),
        addedAt: m.addedAt, completedAt: m.completedAt, libraryRef: m.libraryRef ?? null,
        title: m.title ?? null, year: m.year ?? null,
      });
    }

    // Metainfo is retained until the user removes the history entry, for reseeding.
    this.reconcileQueue();
    this.onChange();
  }

  // Extracted from _finish so it can also be invoked directly from
  // onComplete's first-time-import success branch (linkOrCopy / seedRatio>0
  // path) — that path never gets a SECOND onComplete() call to reach this
  // cleanup via _finish, since m.completed is already set on the first call
  // and tick() skips completed torrents from then on; see onComplete.
  async _cleanupDownloadFolder(snap) {
    const safeName = snap.name.replace(/[/\\:]/g, "_").replace(/\.\.+/g, "_");
    const cleanupTarget = path.join(this.cfg.downloadPath, safeName);
    const resolved = path.resolve(cleanupTarget);
    if (resolved.startsWith(path.resolve(this.cfg.downloadPath)) && resolved !== path.resolve(this.cfg.downloadPath)) {
      try { await fsp.rm(resolved, { recursive: true, force: true }); } catch {}
      console.log(`[engine:${this.cfg.id}][${this.cfg.logTag}]   download nettoyé: ${safeName}`);
    }
    // Also cleanup individual files — for flat torrents the directory cleanup
    // above may miss them because snap.name doesn't include the file extension.
    for (const f of (snap.files ?? [])) {
      const fp = f.path ? (path.isAbsolute(f.path) ? f.path : path.join(this.cfg.downloadPath, f.path)) : null;
      if (fp && path.resolve(fp).startsWith(path.resolve(this.cfg.downloadPath))) {
        try { await fsp.unlink(fp); } catch {}
      }
    }
    // Remove subdirectories left behind — if a dir contains no video files
    // (only .torrent, .nfo, .txt, etc.), it's safe to delete entirely.
    try {
      const dlPath = path.resolve(this.cfg.downloadPath);
      const entries = await fsp.readdir(dlPath, { withFileTypes: true });
      for (const e of entries) {
        if (e.isDirectory()) {
          const dp = path.join(dlPath, e.name);
          try {
            const contents = await fsp.readdir(dp, { withFileTypes: true, recursive: true });
            const hasVideo = contents.some((c) => c.isFile() && VIDEO_EXT_RE.test(c.name));
            if (!hasVideo) await fsp.rm(dp, { recursive: true, force: true });
            else try { await fsp.rmdir(dp); } catch {}
          } catch { try { await fsp.rmdir(dp); } catch {} }
        }
      }
    } catch {}
  }

  // ─── Episode matching (shared) ───────────────────────────────────────────

  _seasonFromPath(filePath) {
    const dirs = path.dirname(filePath).split(/[\\/]/);
    for (const d of dirs) {
      // "Specials" carries no digit at all — recognized by name, mapped
      // straight to season 0, same convention as scanSeriesDiskStructure.
      if (/^specials?$/i.test(d.trim())) return 0;
      const m = d.match(/\bS(\d{1,2})\b/i);
      if (m) return parseInt(m[1], 10);
      const seasonWords = ["season", "saison", "staffel", "seizoen", "temporada", "stagione"];
      for (const word of seasonWords) {
        const re = new RegExp(`\\b${word}\\D*(\\d{1,2})\\b`, "i");
        const wm = d.match(re);
        if (wm) return parseInt(wm[1], 10);
      }
    }
    return null;
  }

  /** Episode number of a season-less file name, ignoring resolution, codec,
   * year, audio layout and release-group tokens. null when nothing credible. */
  _bareEpisodeNumber(name) {
    const clean = name.replace(VIDEO_EXT_RE, "")
      .replace(/\[[0-9a-f]{8}\]/gi, " ")
      .replace(/\b(?:2160|1440|1080|720|576|480)[pi]\b/gi, " ")
      .replace(/\b(?:x|h)[ .]?26[45]\b|\b(?:10|8)[ -]?bits?\b|\b(?:5|7)\.1\b|\b(?:19|20)\d{2}\b|\bv\d\b/gi, " ");
    const m = clean.match(/(?:^|[\s._\-\]\)#])(\d{1,3})(?=$|[\s._\-\[\(])/);
    return m ? parseInt(m[1], 10) : null;
  }

  _matchesEpisode(f, target, allTargets = []) {
    const info = parseRelease(f.name);
    // Absolutely numbered packs (Bleach: 366 episodes, no season) are filed by
    // the target's absolute number — a local number would match one episode
    // in every season at once, or none past the first season's length.
    if (target.absolute != null) {
      if (info.season === 1 && info.episode != null && info.episode <= 366) {
        const end = info.episodeEnd ?? info.episode;
        if (target.absolute >= info.episode && target.absolute <= end) return true;
      }
      if (info.season == null || info.episode == null) {
        const pathSeason = this._seasonFromPath(f.path);
        if (pathSeason == null) {
          const n = info.season == null ? (info.episode ?? this._bareEpisodeNumber(f.name)) : null;
          if (n != null && n > 0 && n <= 366) return n === target.absolute;
          return false;
        }
        // A season folder holding absolute numbers (e.g. "Saison 02" with
        // episodes 21-40): when that season has no local episode with this
        // number, the number is the absolute index.
        const m = info.season == null ? (info.episode ?? this._bareEpisodeNumber(f.name)) : null;
        if (m != null && m === target.absolute && !allTargets.some((t) => t.season === pathSeason && t.episode === m)) return true;
      }
    }
    if (info.season === target.season && info.episode === target.episode) return true;
    if (info.season === target.season && info.episode != null && info.episodeEnd != null &&
        target.episode >= info.episode && target.episode <= info.episodeEnd) return true;
    if (info.season == null || info.episode == null) {
      const pathSeason = this._seasonFromPath(f.path);
      // Neither the filename nor the containing folder carries a season at
      // all — a single-file torrent (numbered-episode-title fansub release,
      // e.g. "02 - Le donjon evolue.mkv") lands directly under the download
      // root with no wrapping folder, so there's no path to read a season
      // from either. Confirmed live: this silently dropped a fully-completed
      // download back to "missing" every time. The grab itself already knows
      // which season this target belongs to — that's what was searched for —
      // so trust it instead of demanding independent folder confirmation
      // that simply can't exist for this release shape, and fall back to the
      // same embedded-episode-number heuristic used below.
      if (pathSeason == null && info.season == null) {
        const nums = [...f.name.replace(VIDEO_EXT_RE, "").matchAll(/(\d+)/g)];
        for (const n of nums) {
          if (parseInt(n[1], 10) === target.episode) return true;
        }
        return false;
      }
      if (pathSeason == null) return false;
      if (pathSeason !== target.season) return false;
      if (info.season == null && info.episode === target.episode) return true;
      if (info.season == null && info.episode == null) {
        const nums = [...f.name.replace(VIDEO_EXT_RE, "").matchAll(/(\d+)/g)];
        for (const n of nums) {
          if (parseInt(n[1], 10) === target.episode) return true;
        }
      }
    }
    return false;
  }

  _selectEpisodeFiles(handle, meta) {
    const targets = meta.episodeTargets ?? (meta.episodeTarget ? [meta.episodeTarget] : []);
    if (targets.length === 0 || !handle.files?.length) return;

    const matches = [];
    handle.files.forEach((f, i) => {
      for (const target of targets) {
        if (this._matchesEpisode(f, target, targets)) { matches.push(i); break; }
      }
    });

    if (matches.length === 0 && targets.length === 1) {
      const target = targets[0];
      let ctxSeason = parseRelease(handle.name).season;
      if (ctxSeason == null) {
        for (const f of handle.files) {
          ctxSeason = parseRelease(f.name).season;
          if (ctxSeason != null) break;
        }
      }
      if ((ctxSeason ?? target.season) === target.season) {
        handle.files.forEach((f, i) => {
          if (matches.includes(i)) return;
          if (parseRelease(f.name).season != null) return;
          const nums = [...f.name.replace(VIDEO_EXT_RE, "").matchAll(/(\d+)/g)];
          for (const n of nums) {
            if (parseInt(n[1], 10) === target.episode) { matches.push(i); return; }
          }
        });
      }
      if (matches.length === 0 && target.episode <= handle.files.length) {
        const sorted = handle.files.map((f, i) => ({ index: i, name: f.name })).sort((a, b) => a.name.localeCompare(b.name));
        matches.push(sorted[target.episode - 1].index);
      }
    }

    if (matches.length === 0) return;
    const matchSet = new Set(matches);
    this._clientSelectFiles(handle, matchSet);
    meta.selectedFileIndices = matchSet;
  }

  _isDone(t) {
    if (t.done) return true;
    const m = this.meta.get(t.infoHash);
    if (!m?.selectedFileIndices || !t.files) return false;
    return [...m.selectedFileIndices].every((i) => t.files[i]?.done);
  }

  // ─── Stall detection (règle produit : 2 min sans activité → "blocked") ─

  /**
   * Règle produit : un torrent sans mouvement pendant 2 minutes passe en
   * catégorie "blocked" — il ne consomme plus de slot dans la file (ne bloque
   * plus les autres). S'il se débloque, il se remet EN DERNIER dans la file.
   * Détection pilotée par tick() (5 s) :
   * `lastActivityAt` est réarmé uniquement à partir de 20 octets/s,
   * ce qui couvre aussi le cycle stall → recovery → re-stall.
   */
  _checkStall(t) {
    const m = this.meta.get(t.infoHash);
    if (!m) return;
    const now = Date.now();
    const downloaded = t.downloaded ?? 0;
    const complete = m.completed || m.seeding || this._isDone(t) || (Number(t.length) > 0 && Number(downloaded) >= Number(t.length));
    if (complete && m.stalled) {
      m.stalled = false;
      m.stalledAt = null;
      m.queued = false;
      this.reconcileQueue();
      this.onChange();
    }
    // Hash verification after a restart shows no download activity — not a
    // stall. Time paused, queued or verifying must not count as inactivity.
    if (complete || m.userPaused || m.finishing || t.verifying || m.verifying || (m.queued && !m.stalled)) {
      m.lastActivityAt = now;
      m.lastActivitySampleAt = now;
      m.lastDownloaded = downloaded;
      return;
    }
    const speed = t.downloadSpeed ?? 0;
    const elapsed = now - (m.lastActivitySampleAt ?? now);
    const measuredSpeed = elapsed > 0 ? Math.max(0, downloaded - (m.lastDownloaded ?? downloaded)) * 1000 / elapsed : 0;
    // Update every sample, including trickle traffic: accumulating tiny
    // deltas until they exceed 20 bytes would falsely count them as progress.
    m.lastDownloaded = downloaded;
    m.lastActivitySampleAt = now;
    if (speed >= MIN_ACTIVE_BYTES_PER_SECOND || measuredSpeed >= MIN_ACTIVE_BYTES_PER_SECOND) {
      if (m.stalled) {
        this._recoverFromStall(t.infoHash);
        return;
      }
      m.lastActivityAt = now;
      return;
    }
    // En attente de slot (pausé par le moteur) → jamais "blocked" (faux positif).
    if (m.queued) return;
    if (!m.lastActivityAt) {
      m.lastActivityAt = now;
      return;
    }
    if (now - m.lastActivityAt >= STALL_MS && !m.stalled) {
      m.stalled = true;
      m.stalledAt = now;
      m.queued = true; // ne consomme plus de slot
      this.reconcileQueue();
      this.onChange();
    }
  }

  /**
   * Un torrent "blocked" a repris du téléchargement : il est remis EN DERNIER
   * dans la file (dequeuedAt = clé de tri primaire, pause côté client, queued
   * reste true — il ne reprend qu'après tous les autres torrents).
   */
  _recoverFromStall(infoHash) {
    const m = this.meta.get(infoHash);
    if (!m?.stalled) return;
    m.stalled = false;
    m.stalledAt = null;
    m.dequeuedAt = Date.now();
    m.queued = true;
    m.lastActivityAt = Date.now();
    // Le torrent débloqué est remis dans la file (queued=true) : tant qu'un
    // slot est libre il reprend via reconcileQueue. La pause n'est posée que
    // si maxActive > 0 — avec maxActive=0 reconcileQueue retourne tôt sans
    // jamais reprendre un torrent pausé, une pause y créerait un blocage
    // permanent.
    if ((this.cfg.maxActive || 0) > 0) {
      Promise.resolve(this._clientPause(infoHash)).catch(() => {});
    }
    this.reconcileQueue();
    this.onChange();
  }
}
