import path from "node:path";
import fsp from "node:fs/promises";
import WebTorrent from "webtorrent";
import { ensureDir, movePath, linkOrCopy } from "./store.mjs";
import {
  loadNamingTemplates,
  parseRelease,
  buildContext,
  renderSegment,
  VIDEO_EXT_RE,
} from "./naming.mjs";
import { WEB_CALLBACK_URL, TORRENT_CACHE_DIR, ENGINE_TOKEN } from "./config.mjs";

/**
 * A single download instance, bound to one media category (movies or series).
 * Wraps its own WebTorrent client and enforces all the Movviz-specific policy
 * on top of the raw transport: queueing (max active), seed-ratio auto-stop,
 * and auto-move to the library folder on completion.
 *
 * All of this logic is original to Movviz; WebTorrent only provides the peer
 * wire protocol, DHT, PEX, trackers and piece exchange.
 */
export class MovvizInstance {
  constructor(cfg, { onChange } = {}) {
    this.cfg = cfg;
    this.onChange = onChange ?? (() => {});
    /** infoHash -> per-torrent Movviz metadata (not stored by WebTorrent). */
    this.meta = new Map();
    /**
     * infoHash -> snapshot of a torrent that finished and was moved into the
     * library. WebTorrent's own `client.torrents` only tracks what it's
     * actively managing — once the files are moved out of the download
     * folder there is nothing left for it to resume seeding, so instead of
     * re-adding it (which would just fail against an now-empty folder after
     * a restart) it lives here and is surfaced by list()/summary() directly.
     */
    this.importedHistory = new Map();
    this.client = null;
  }

  async init() {
    this.folderError = null;
    try {
      await ensureDir(this.cfg.downloadPath);
      await ensureDir(this.cfg.completedPath);
    } catch (e) {
      // A bad folder (stale path from an old volume layout, missing mount,
      // no permission…) must NOT kill the whole engine — that would make it
      // impossible to fix the paths from the UI. Keep the instance up in a
      // degraded state instead; applyConfig() clears this once the folders
      // point somewhere writable again.
      this.folderError = e.message;
      console.error(
        `[engine:${this.cfg.id}] folder unavailable (${e.message}) — downloads blocked until the folders are fixed in Settings`
      );
    }
    // Fixed peer port (TCP + uTP over UDP, same number) so it can actually be
    // forwarded on a router/NAS firewall — a random port (WebTorrent's
    // default) can never be forwarded, meaning no incoming peer connections
    // and much slower/stalled transfers. DHT deliberately keeps its own
    // random port: WebTorrent binds it as a separate UDP socket, so pinning
    // it to the same number as the peer port collides with uTP's UDP socket
    // (EADDRINUSE) — DHT still works fine without being forwarded, it just
    // relies on outbound-initiated lookups instead of accepting inbound ones.
    // uTP (utp-native) and WebRTC peers (node-datachannel) are both native
    // modules that are known to SIGSEGV on Alpine/musl — i.e. inside the
    // Docker image, the moment the first peer connection happens. Neither is
    // needed server-side: TCP peers + DHT + HTTP/UDP trackers cover
    // everything, so both stay off everywhere for predictability.
    this.client = await this.createClientWithPortFallback();
    this.applyThrottle();
  }

  /**
   * A busy configured port (another process still holding it after a crash,
   * two instances misconfigured onto the same port…) used to leave the
   * WebTorrent client permanently destroyed — every torrent add/resume
   * afterward failed with "client is destroyed", for the rest of the
   * process's life, until someone noticed and restarted it manually. This
   * tries the configured port first and falls back to an OS-assigned free
   * port instead of giving up, so the instance stays usable — just without
   * NAT-forwardable inbound peers on that fallback.
   */
  async createClientWithPortFallback() {
    const preferred = this.cfg.torrentPort || 0;
    const candidates = preferred ? [preferred, 0] : [0];
    let lastErr = null;

    for (const port of candidates) {
      try {
        const client = await this.tryBindClient(port);
        if (port !== preferred) {
          console.error(
            `[engine:${this.cfg.id}] port ${preferred} was already in use — fell back to an auto-assigned port. Inbound peers won't be forwardable until this is freed or a different port is set.`
          );
        } else if (port) {
          console.log(`[engine:${this.cfg.id}] peer port (TCP): ${port} — forward this on your router/NAS firewall for full speed`);
        }
        client.on("error", (e) => console.error(`[engine:${this.cfg.id}] client error:`, e.message ?? e));
        return client;
      } catch (e) {
        lastErr = e;
      }
    }
    // Every candidate failed (extremely unlikely for port 0) — surface one
    // clear error instead of leaving `this.client` null and every caller
    // discovering that individually.
    console.error(`[engine:${this.cfg.id}] could not start the download client on any port:`, lastErr?.message ?? lastErr);
    throw lastErr ?? new Error("client failed to start");
  }

  /** Resolves once the client is confirmed bound (or 1.5s pass with no bind error), rejects on a startup listen failure. */
  tryBindClient(port) {
    return new Promise((resolve, reject) => {
      const client = new WebTorrent({
        maxConns: Math.max(1, this.cfg.maxPeers ?? 55),
        dht: this.cfg.dht !== false,
        torrentPort: port,
        utp: false,
        tracker: { wrtc: false },
      });
      let settled = false;
      const onEarlyError = (e) => {
        if (settled) return;
        settled = true;
        client.removeListener("error", onEarlyError);
        if (!client.destroyed) client.destroy(() => {});
        reject(e);
      };
      client.once("error", onEarlyError);
      setTimeout(() => {
        if (settled) return;
        settled = true;
        client.removeListener("error", onEarlyError);
        resolve(client);
      }, 1500);
    });
  }

  applyThrottle() {
    // WebTorrent exposes throttling on some builds; apply when available and
    // fall back gracefully otherwise (limits stay advisory in the config).
    const dl = (this.cfg.downloadLimitKbps || 0) * 1024;
    const ul = (this.cfg.uploadLimitKbps || 0) * 1024;
    if (typeof this.client.throttleDownload === "function") {
      this.client.throttleDownload(dl > 0 ? dl : -1);
    }
    if (typeof this.client.throttleUpload === "function") {
      this.client.throttleUpload(ul > 0 ? ul : -1);
    }
  }

  // ---- Adding ------------------------------------------------------------

  /** Synchronous torrent lookup — WebTorrent's client.get() is async in v2. */
  _get(infoHash) {
    return this.client.torrents.find((t) => t && t.infoHash === infoHash) ?? null;
  }

  add(torrentId, opts = {}) {
    return new Promise((resolve, reject) => {
      if (this.folderError) {
        return reject(new Error(`download folder unavailable: ${this.folderError}`));
      }
      if (opts.infoHash) {
        const existing = this._get(opts.infoHash);
        if (existing) return resolve(this.summary(existing));
      }

      const t = this.client.add(torrentId, {
        path: this.cfg.downloadPath,
        // When targeting specific episode(s) inside a season or complete
        // series pack, prevent WebTorrent from selecting all pieces — only
        // the targeted files' pieces will be selected by selectEpisodeFiles().
        deselect: !!(opts.episodeTarget || opts.episodeTargets),
      });
      t.on("error", (err) => {
        this.emitActivity("failed", {
          media: {
            id: opts.libraryRef?.split(":")[1] ?? "inconnu",
            title: opts.title ?? "Inconnu",
            type: this.cfg.category,
            href: opts.libraryRef ? `/title/${this.cfg.category}` : "#",
          },
          failure: { code: "download_failed", message: err?.message ?? "Échec d'ajout du torrent" },
          metadata: { libraryRef: opts.libraryRef ?? undefined, year: opts.year ?? undefined },
        });
        reject(err);
      });

      const ensureMeta = () => {
        if (!this.meta.has(t.infoHash)) {
          this.meta.set(t.infoHash, {
            addedAt: opts.addedAt ?? Date.now(),
            completedAt: null,
            userPaused: !!opts.paused,
            queued: false,
            sequential: !!opts.sequential,
            completed: false,
            movedTo: null,
            // Ties this download back to a library entry (movie/episode) so
            // the completion callback knows what to mark available.
            libraryRef: opts.libraryRef ?? null,
            // Canonical title/year from the web app's metadata source (TMDb),
            // in whatever language it's configured for — takes priority over
            // whatever the release/scene name happened to call it when the
            // completed file gets renamed.
            title: opts.title ?? null,
            year: opts.year ?? null,
            // Set when this grab targets one specific episode inside a
            // torrent that may turn out to hold a whole season — see
            // selectEpisodeFiles(). When grabbing a complete series pack,
            // episodeTargets holds the full list of { season, episode } to
            // keep selected so every missing episode lands on disk.
            episodeTarget: opts.episodeTarget ?? null,
            episodeTargets: opts.episodeTargets ?? null,
            selectedFileIndices: null,
          });
        }
      };

      // Full wiring + automation happens once the metadata is ready (needs peers).
      t.on("metadata", () => {
        ensureMeta();
        this.selectEpisodeFiles(t, this.meta.get(t.infoHash));
        this.wireTorrent(t);
        if (opts.paused) t.pause();
        if (opts.sequential) this.setSequential(t.infoHash, true);
        this.reconcileQueue();
        this.onChange();
        // Log the grab — the release is now being fetched by the engine.
        // Quality is parsed from the torrent name when available.
        const releaseInfo = parseRelease(t.name ?? "");
        this.emitActivity("grabbed", {
          media: {
            id: opts.libraryRef?.split(":")[1] ?? t.infoHash,
            title: opts.title ?? t.name ?? "Inconnu",
            type: this.cfg.category,
            href: opts.libraryRef
              ? `/title/${this.cfg.category}/${opts.year ? "?year=" + opts.year : ""}`
              : "#",
          },
          release: {
            indexer: "Indexeur inconnu",
            releaseTitle: t.name ?? "Release inconnue",
            protocol: "torrent",
            size: t.length ?? 0,
            quality: releaseInfo.quality ?? releaseInfo.resolution ?? "Inconnue",
            score: 0,
            seeders: t.numPeers ?? 0,
            leechers: 0,
            customFormats: [],
          },
          download: {
            client: "Movviz",
            infoHash: t.infoHash ?? "",
            progress: 0,
            downloadSpeed: 0,
            uploadSpeed: 0,
            eta: 0,
            ratio: 0,
            peers: t.numPeers ?? 0,
            state: "downloading",
          },
          metadata: {
            libraryRef: opts.libraryRef ?? undefined,
            year: opts.year ?? undefined,
          },
        });
      });

      // But the API responds as soon as the infoHash is known — like a real
      // client, adding a magnet returns immediately ("fetching metadata").
      let waited = 0;
      const settle = () => {
        if (t.infoHash) {
          ensureMeta();
          if (opts.paused) t.pause();
          return resolve(this.summary(t));
        }
        if ((waited += 25) > 8000) {
          this.emitActivity("failed", {
            media: {
              id: opts.libraryRef?.split(":")[1] ?? "inconnu",
              title: opts.title ?? "Résolution échouée",
              type: this.cfg.category,
              href: "#",
            },
            failure: { code: "timeout", message: "Impossible de résoudre l'infoHash du torrent — l'aimant n'a pas de pairs" },
            metadata: { libraryRef: opts.libraryRef ?? undefined },
          });
          return reject(new Error("could not resolve infoHash"));
        }
        setTimeout(settle, 25);
      };
      settle();
    });
  }

  /**
   * Re-register a torrent that was already imported (moved to the library)
   * before the last restart — no live WebTorrent object needed or wanted,
   * since its files no longer live in the download folder.
   */
  restoreImported(rec) {
    this.importedHistory.set(rec.infoHash, {
      infoHash: rec.infoHash,
      magnetURI: rec.magnetURI ?? null,
      name: rec.name ?? rec.title ?? rec.infoHash,
      size: rec.size ?? 0,
      movedTo: rec.movedTo,
      addedAt: rec.addedAt ?? null,
      completedAt: rec.completedAt ?? null,
      libraryRef: rec.libraryRef ?? null,
      title: rec.title ?? null,
      year: rec.year ?? null,
    });
  }

  wireTorrent(torrent) {
    torrent.on("done", () => this.onComplete(torrent));
    // Persist/notify on lifecycle transitions (not on every chunk).
    // A magnet add has no metainfo until "ready" — cache it there too.
    torrent.on("ready", () => {
      this.cacheTorrentFile(torrent);
      this.onChange();
    });
    torrent.on("noPeers", () => {});
    torrent.on("error", (err) => {
      const m = this.meta.get(torrent.infoHash);
      console.error(`[engine:${this.cfg.id}] torrent error:`, err?.message ?? err);
      this.emitActivity("failed", {
        media: {
          id: m?.libraryRef?.split(":")[1] ?? torrent.infoHash,
          title: m?.title ?? torrent.name ?? "Inconnu",
          type: this.cfg.category,
          href: "#",
        },
        failure: { code: "download_failed", message: err?.message ?? "Torrent error" },
      });
    });
    // Stalled detection: if a downloading torrent has 0 peers and 0 speed
    // for more than 5 minutes, emit a stalled event so the user knows
    // something is stuck and can act.
    this._stallTimers ??= new Map();
    const checkStalled = () => {
      if (torrent.done || torrent.paused) return;
      const peers = torrent.numPeers ?? 0;
      const speed = torrent.downloadSpeed ?? 0;
      if (peers === 0 && speed === 0) {
        const m = this.meta.get(torrent.infoHash);
        this.emitActivity("failed", {
          media: {
            id: m?.libraryRef?.split(":")[1] ?? torrent.infoHash,
            title: m?.title ?? torrent.name ?? "Inconnu",
            type: this.cfg.category,
            href: "#",
          },
          failure: { code: "timeout", message: "Aucun pair trouvé — le torrent est bloqué" },
        });
      }
    };
    // Clear any previous timer for this infoHash, then set a 5-minute one.
    clearTimeout(this._stallTimers.get(torrent.infoHash));
    this._stallTimers.set(torrent.infoHash, setTimeout(checkStalled, 300_000));
    this.cacheTorrentFile(torrent);

    // Selective (episode-targeted) downloads get their own recovery loop
    // from _watchSelectiveCompletion, called just before this from the
    // "metadata" handler — skip here to avoid running two competing
    // watchers on the same torrent.
    const meta = this.meta.get(torrent.infoHash);
    if (!meta?.selectedFileIndices) this._watchWholeTorrentStall(torrent);
  }

  /**
   * Same stuck-at-99%-forever problem as _watchSelectiveCompletion, but for
   * an ordinary whole-torrent grab (no per-episode selection in play) — see
   * the comment there for why WebTorrent alone never recovers from this on
   * its own. Peer-reconnect nudge first, then accept what's on disk if only
   * a sliver is missing, then give up so the library item goes back to
   * "missing" and a fresh search can try a different release.
   */
  _watchWholeTorrentStall(t) {
    let lastDownloaded = -1;
    let stage = 0; // 0 = normal, 1 = nudged once
    let everProgressed = false;
    const stallTimer = setInterval(() => {
      if (t.destroyed || t.done) {
        clearInterval(stallTimer);
        return;
      }
      const downloaded = t.downloaded;
      if (downloaded > 0) everProgressed = true;
      if (downloaded !== lastDownloaded) {
        lastDownloaded = downloaded;
        return;
      }
      const missing = (t.length ?? 0) - downloaded;
      if (missing > 0 && missing <= Math.max(2 * 1024 * 1024, (t.length ?? 0) * 0.005)) {
        clearInterval(stallTimer);
        console.log(`[engine:${this.cfg.id}] accepting ${t.infoHash} as complete — only ${missing} byte(s) short and no peer has budged in a while`);
        this.onComplete(t);
        return;
      }
      if (stage === 0) {
        console.log(`[engine:${this.cfg.id}] download stalled (${t.numPeers} peers, 0 progress) — reconnecting all peers for ${t.infoHash}`);
        t.wires.slice().forEach((w) => w.destroy());
        stage = 1;
        lastDownloaded = -1;
        return;
      }
      // Never got a single byte at all — still finding/negotiating with
      // peers is normal for the first several minutes on a fresh torrent
      // (DHT bootstrap, tracker announces). Keep nudging instead of
      // deleting a download that never really got a chance to start.
      if (!everProgressed) {
        stage = 0;
        lastDownloaded = -1;
        return;
      }
      clearInterval(stallTimer);
      console.log(`[engine:${this.cfg.id}] still stalled after reconnect with no peer holding the missing piece(s) — giving up on ${t.infoHash}`);
      const meta = this.meta.get(t.infoHash);
      this.emitActivity("failed", {
        media: {
          id: meta?.libraryRef?.split(":")[1] ?? t.infoHash,
          title: meta?.title ?? t.name ?? "Inconnu",
          type: this.cfg.category,
          href: "#",
        },
        failure: { code: "no_peers_for_piece", message: "Aucun pair ne détient les dernières pièces de ce fichier — abandon de cette source" },
        metadata: { libraryRef: meta?.libraryRef ?? undefined },
        infoHash: t.infoHash,
      });
      this.remove(t.infoHash, true);
    }, 90_000);
  }

  /**
   * Persist the .torrent metainfo so a restart can resume from local data
   * alone. Resuming from the magnet link means waiting on the swarm to serve
   * metadata before the on-disk files can even be verified — no peers, no
   * resume, and the download shows 0% forever. With the metainfo cached the
   * engine re-verifies existing data immediately and picks up where it left.
   */
  async cacheTorrentFile(torrent) {
    try {
      if (!torrent.torrentFile) return;
      await ensureDir(TORRENT_CACHE_DIR);
      await fsp.writeFile(
        path.join(TORRENT_CACHE_DIR, `${torrent.infoHash}.torrent`),
        torrent.torrentFile
      );
    } catch (e) {
      console.error(`[engine:${this.cfg.id}] torrent metainfo cache failed:`, e.message);
    }
  }

  async dropCachedTorrentFile(infoHash) {
    await fsp.rm(path.join(TORRENT_CACHE_DIR, `${infoHash}.torrent`), { force: true }).catch(() => {});
  }

  // ---- Queue policy ------------------------------------------------------

  /**
   * Keep at most `maxActive` torrents actively downloading. Extra torrents are
   * paused and marked "queued"; freed slots pull the next queued torrent in.
   */
  reconcileQueue() {
    const max = this.cfg.maxActive || 0;
    const downloading = this.client.torrents.filter((t) => {
      const m = this.meta.get(t.infoHash);
      return m && !m.userPaused && !t.done;
    });
    if (max <= 0) return;

    // Active first, queued last, oldest first within each group.
    downloading.sort((a, b) => {
      const ma = this.meta.get(a.infoHash);
      const mb = this.meta.get(b.infoHash);
      return Number(ma.queued) - Number(mb.queued) || ma.addedAt - mb.addedAt;
    });

    downloading.forEach((t, i) => {
      const m = this.meta.get(t.infoHash);
      const shouldRun = i < max;
      if (shouldRun && m.queued) {
        m.queued = false;
        t.resume();
      } else if (!shouldRun && !m.queued) {
        m.queued = true;
        t.pause();
      }
    });
    this.reconcileUploadSlots();
  }

  /**
   * Limits the number of simultaneously seeding torrents to save CPU and
   * bandwidth. When uploadSlots is 0 (default), all seeders run freely.
   */
  reconcileUploadSlots() {
    const slots = this.cfg.uploadSlots || 0;
    if (slots <= 0) return;

    const seeders = this.client.torrents
      .filter((t) => {
        const m = this.meta.get(t.infoHash);
        return t.done && m && !m.queued && !m.userPaused && !m.completed;
      })
      .sort((a, b) => {
        // Prioritise torrents with the highest ratio first (closer to seed goal)
        return (b.ratio ?? 0) - (a.ratio ?? 0);
      });

    seeders.forEach((t, i) => {
      if (i >= slots) t.pause();
    });
  }

  // ---- Completion + ratio ------------------------------------------------

  async onComplete(torrent) {
    const m = this.meta.get(torrent.infoHash);
    if (!m) return;
    m.completedAt ??= Date.now();
    this.reconcileQueue(); // freed a download slot
    this.onChange();

    const snap = this.snapshotTorrent(torrent);
    const releaseInfo = parseRelease(snap.name ?? "");
    const mediaBase = {
      id: m.libraryRef?.split(":")[1] ?? snap.infoHash,
      title: m.title ?? snap.name ?? "Inconnu",
      type: this.cfg.category,
      href: m.libraryRef ? `/title/${this.cfg.category}/${m.year ?? ""}` : "#",
    };

    // Signal that the download is done and we're moving to import phase.
    this.emitActivity("importing", {
      media: mediaBase,
      download: {
        client: "Movviz",
        infoHash: snap.infoHash,
        progress: 1,
        downloadSpeed: 0,
        uploadSpeed: 0,
        eta: 0,
        ratio: torrent.ratio ?? 0,
        peers: torrent.numPeers ?? 0,
        state: "downloading",
      },
      metadata: { libraryRef: m.libraryRef ?? undefined, year: m.year ?? undefined },
    });

    if (!this.cfg.autoMoveOnComplete) return;

    const limit = Number(this.cfg.seedRatio) || 0;
    if (limit <= 0) {
      // Ratio 0 — no seeding wanted: stop sharing NOW, then rename + move.
      await this.finishTorrent(torrent).catch((e) => {
        console.error(`[engine:${this.cfg.id}] finish failed:`, e.message);
        this.emitActivity("failed", {
          media: mediaBase,
          failure: { code: "import_failed", message: e.message ?? "Échec du déplacement des fichiers" },
          metadata: { libraryRef: m.libraryRef ?? undefined },
        });
      });
    } else {
      // Seeding continues, but the library must not wait for the ratio:
      // hardlink the finished files into place immediately (same volume —
      // instant, no extra space), then let enforceRatio() stop the torrent
      // and clean the download folder once the ratio target is reached.
      const err = await this.importFiles(snap, linkOrCopy).catch((e) => {
        console.error(`[engine:${this.cfg.id}] import failed:`, e.message);
        return e;
      });

      if (err) {
        this.emitActivity("failed", {
          media: mediaBase,
          failure: { code: "import_failed", message: err.message ?? "Échec de l'import" },
          metadata: { libraryRef: m.libraryRef ?? undefined },
        });
      } else {
        // Import succeeded → log imported (or upgraded if it's a replacement)
        const m2 = this.meta.get(torrent.infoHash);
        const isUpgrade = m2?.completedAt && (torrent.completedAt ?? Date.now()) - m2.completedAt > 60_000;
        this.emitActivity(isUpgrade ? "upgraded" : "imported", {
          media: mediaBase,
          release: {
            indexer: "Indexeur inconnu",
            releaseTitle: snap.name ?? "Release inconnue",
            protocol: "torrent",
            size: snap.length ?? 0,
            quality: releaseInfo.quality ?? releaseInfo.resolution ?? "Inconnue",
            score: 0,
            customFormats: [],
          },
          metadata: { libraryRef: m.libraryRef ?? undefined, year: m.year ?? undefined },
        });
      }

      this.enforceRatio(torrent);
    }
  }

  enforceRatio(torrent) {
    const m = this.meta.get(torrent.infoHash);
    if (!m || !this._effectivelyDone(torrent) || m.completed || m.finishing) return;
    const limit = Number(this.cfg.seedRatio) || 0;
    if (limit <= 0 || torrent.ratio >= limit) {
      this.finishTorrent(torrent).catch((e) =>
        console.error(`[engine:${this.cfg.id}] finish failed:`, e.message)
      );
    }
  }

  /**
   * Everything importFiles() needs from a live torrent, captured as plain
   * data — required because finishing a torrent destroys the WebTorrent
   * object (that's what actually severs peer connections and releases the
   * file handles) and the fields become unusable afterwards.
   */
  snapshotTorrent(torrent) {
    const m = this.meta.get(torrent.infoHash);
    const selected = m?.selectedFileIndices ?? null;
    return {
      infoHash: torrent.infoHash,
      magnetURI: torrent.magnetURI,
      name: torrent.name,
      length: torrent.length ?? 0,
      files: (torrent.files ?? []).map((f, i) => ({
        name: f.name,
        path: f.path ?? f.name,
        length: f.length ?? 0,
        selected: !selected || selected.has(i),
      })),
    };
  }

  /**
   * Try to extract a season number from a file's path — useful when the
   * file sits inside a season-named subdirectory (e.g. "Season 01/episode.mkv",
   * "Staffel 2/01.mkv", "S03/foo.mkv").
   */
  _seasonFromPath(filePath) {
    const dirs = path.dirname(filePath).split(/[\\/]/);
    for (const d of dirs) {
      const m = d.match(/\bS(\d{1,2})\b/i);
      if (m) return parseInt(m[1], 10);
      // International season keywords
      const seasonWords = ["season", "saison", "staffel", "seizoen", "temporada", "stagione"];
      for (const word of seasonWords) {
        const re = new RegExp(`\\b${word}\\D*(\\d{1,2})\\b`, "i");
        const wm = d.match(re);
        if (wm) return parseInt(wm[1], 10);
      }
    }
    return null;
  }

  /**
   * Match one episode target against a file's parsed info and its path.
   * Handles both flat packs and season-subdirectory structures.
   */
  _matchesEpisode(f, target) {
    const info = parseRelease(f.name);
    if (info.season === target.season && info.episode === target.episode) return true;
    // Combined multi-episode file (e.g. S04E01E02) — select it for either
    // half, since that one file is the only place either episode lives.
    if (info.season === target.season && info.episode != null && info.episodeEnd != null &&
        target.episode >= info.episode && target.episode <= info.episodeEnd) return true;
    // Season not in filename — try the parent directory path
    if (info.season == null || info.episode == null) {
      const pathSeason = this._seasonFromPath(f.path);
      if (pathSeason == null) return false;
      if (pathSeason !== target.season) return false;
      // Season matches via path, now try episode from filename
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

  /**
   * Select only the files matching any of the episode targets inside a
   * season-pack or complete-series torrent. Supports three approaches:
   * 1) exact SxxExx from file name; 2) bare episode number + season from
   * parent directory; 3) position-based fallback for single-target grabs.
   * When episodeTargets (plural) is provided, every matching file is kept
   * and every non-matching file is deselected — only the pieces needed.
   */
  selectEpisodeFiles(t, meta) {
    const targets = meta.episodeTargets ?? (meta.episodeTarget ? [meta.episodeTarget] : []);
    if (targets.length === 0 || !t.files?.length) return;
    const matches = [];
    const targetSet = new Set(targets.map((ts) => `${ts.season}-${ts.episode}`));

    // Step 1 — match each file against every target via name + path
    t.files.forEach((f, i) => {
      for (const target of targets) {
        if (this._matchesEpisode(f, target)) { matches.push(i); break; }
      }
    });

    // Step 2 — single-target position fallback (only when looking for one
    // episode — position is meaningless when multiple targets exist)
    if (matches.length === 0 && targets.length === 1) {
      const target = targets[0];
      // Try bare number in filename + season from torrent name
      let ctxSeason = parseRelease(t.name).season;
      if (ctxSeason == null) {
        for (const f of t.files) {
          ctxSeason = parseRelease(f.name).season;
          if (ctxSeason != null) break;
        }
      }
      if ((ctxSeason ?? target.season) === target.season) {
        t.files.forEach((f, i) => {
          if (matches.includes(i)) return;
          if (parseRelease(f.name).season != null) return;
          const nums = [...f.name.replace(VIDEO_EXT_RE, "").matchAll(/(\d+)/g)];
          for (const n of nums) {
            if (parseInt(n[1], 10) === target.episode) { matches.push(i); return; }
          }
        });
      }
      // Absolute last-resort: pick the Nth file in sorted order
      if (matches.length === 0 && target.episode <= t.files.length) {
        const sorted = t.files
          .map((f, i) => ({ index: i, name: f.name }))
          .sort((a, b) => a.name.localeCompare(b.name));
        matches.push(sorted[target.episode - 1].index);
      }
    }

    if (matches.length === 0) return; // keep everything
    const matchSet = new Set(matches);
    t.files.forEach((f, i) => (matchSet.has(i) ? f.select() : f.deselect()));
    meta.selectedFileIndices = matchSet;
    // A targeted file's last piece is often shared with the very next
    // (deselected) file in the pack — at normal priority the swarm can
    // leave that one boundary piece dangling indefinitely (peers happily
    // serve everything else first), stalling the download at ~99% forever.
    // `critical()` requests it aggressively from every peer at once, the
    // same mechanism used for instant-start sequential playback.
    for (const i of matches) {
      const f = t.files[i];
      if (f._startPiece != null && f._endPiece != null) t.critical(f._startPiece, f._endPiece);
    }
    this._watchSelectiveCompletion(t, matchSet);
  }

  /**
   * WebTorrent's own `torrent.done` (wired to onComplete in wireTorrent)
   * only fires once every file in the torrent is downloaded — deselected
   * files never get their pieces, so for a season pack with 9 out of 10
   * files intentionally left deselected, `done` would never fire and the
   * download would stay stuck "in progress" forever, even once the one
   * file we actually wanted is fully there. Each file has its own `done`
   * event regardless of the others' selection state, so completion for a
   * selective download is driven off just the targeted files instead.
   */
  _watchSelectiveCompletion(t, matchSet) {
    const targets = [...matchSet].map((i) => t.files[i]);
    const checkDone = () => {
      if (t.done) return; // the normal path already handled it
      if (!targets.every((f) => f.done)) return;
      for (const f of targets) f.removeListener("done", checkDone);
      clearInterval(stallTimer);
      this.onComplete(t);
    };
    for (const f of targets) f.on("done", checkDone);
    checkDone(); // covers the rare case where the target file(s) were already complete (e.g. verified from cache) before this ran

    // A targeted file's last piece is often shared with the very next
    // (deselected) file. Nothing in this WebTorrent build ever forces a
    // stuck peer connection to let go of a piece it claimed but isn't
    // delivering — "endgame mode" (redundantly re-requesting the last few
    // pieces from every peer at once) is disabled upstream (see torrent.js,
    // search "end game"), and the hotswap path that's supposed to steal a
    // slow reservation only kicks in for a peer that's already fast, which
    // never happens once overall throughput has dropped near zero. From the
    // outside this looks exactly like the torrent got silently paused: dozens
    // of peers connected, nothing moving. The fix available to us without
    // patching the vendored library is to force the issue periodically —
    // disconnect every current peer connection so the client drops whatever
    // it was (not) doing and reconnects fresh from the tracker/DHT, which
    // frequently hands us different peers or re-negotiates the same ones
    // from a clean slate. Only fall back to the whole torrent (a wider piece
    // pool with much better odds someone actually has the needed data) if a
    // reconnect nudge doesn't get things moving either.
    let lastDownloaded = -1;
    let stage = 0; // 0 = selective, 1 = selective+nudged, 2 = full, 3 = full+nudged
    const stallTimer = setInterval(() => {
      if (t.destroyed || t.done || targets.every((f) => f.done)) {
        clearInterval(stallTimer);
        return;
      }
      const downloaded = stage >= 2
        ? t.downloaded
        : targets.reduce((sum, f) => sum + f.downloaded, 0);
      if (downloaded !== lastDownloaded) {
        lastDownloaded = downloaded;
        return;
      }
      // Stalled with only a sliver of the target file(s) left — the missing
      // bytes are almost certainly the shared boundary piece with a
      // deselected neighbor, and endlessly chasing the last fragment via
      // more peers isn't worth it. Most of the file is already sitting on
      // disk at its correct byte offsets (WebTorrent writes each verified
      // piece straight to the destination file as it arrives), so accept
      // what's there and move it into the library now rather than leaving
      // an episode that's 99.9% done stuck "downloading" forever.
      const targetSize = targets.reduce((sum, f) => sum + f.length, 0);
      const targetDownloaded = targets.reduce((sum, f) => sum + f.downloaded, 0);
      const missing = targetSize - targetDownloaded;
      if (missing > 0 && missing <= Math.max(2 * 1024 * 1024, targetSize * 0.005)) {
        clearInterval(stallTimer);
        for (const f of targets) f.removeListener("done", checkDone);
        console.log(`[engine:${this.cfg.id}] accepting ${t.infoHash} as complete — only ${missing} byte(s) short and no peer has budged in a while`);
        this.onComplete(t);
        return;
      }
      if (stage === 0 || stage === 2) {
        console.log(`[engine:${this.cfg.id}] download stalled (${t.numPeers} peers, 0 progress) — reconnecting all peers for ${t.infoHash}`);
        t.wires.slice().forEach((w) => w.destroy());
        stage += 1;
        lastDownloaded = -1;
        return;
      }
      if (stage === 1) {
        console.log(`[engine:${this.cfg.id}] selective download still stalled after reconnect — falling back to the full torrent for ${t.infoHash}`);
        t.files.forEach((f) => f.select());
        const meta = this.meta.get(t.infoHash);
        if (meta) meta.selectedFileIndices = null;
        stage = 2;
        lastDownloaded = -1;
        return;
      }
      clearInterval(stallTimer);
      console.log(`[engine:${this.cfg.id}] full torrent also stalled with no peer holding the missing piece(s) — giving up on ${t.infoHash}`);
      const meta = this.meta.get(t.infoHash);
      this.emitActivity("failed", {
        media: {
          id: meta?.libraryRef?.split(":")[1] ?? t.infoHash,
          title: meta?.title ?? t.name ?? "Inconnu",
          type: this.cfg.category,
          href: "#",
        },
        failure: { code: "no_peers_for_piece", message: "Aucun pair ne détient les dernières pièces de ce fichier — abandon de cette source" },
        metadata: { libraryRef: meta?.libraryRef ?? undefined },
        infoHash: t.infoHash,
      });
      this.remove(t.infoHash, true);
    }, 90_000);
  }

  /** torrent.done, but also true once every targeted file of a selective download is complete — see _watchSelectiveCompletion. */
  _effectivelyDone(t) {
    if (t.done) return true;
    const m = this.meta.get(t.infoHash);
    if (!m?.selectedFileIndices) return false;
    return [...m.selectedFileIndices].every((i) => t.files[i]?.done);
  }

  /**
   * Terminal transition for a finished torrent: stop sharing IMMEDIATELY
   * (WebTorrent's pause() only stops new connections — peers already
   * connected keep leeching, so the torrent must be removed from the client
   * to truly cut upload), then make sure the library has the files:
   *   - already imported earlier (hardlinked while seeding): just delete the
   *     download-folder copies — the library's hardlinks share the same data
   *     on disk and survive.
   *   - not imported yet (ratio 0, or auto-move enabled later): rename+move
   *     the files into the library now that nothing holds them open.
   */
  async finishTorrent(torrent) {
    const m = this.meta.get(torrent.infoHash);
    if (!m || m.finishing) return;
    m.finishing = true;
    m.completed = true;
    m.completedAt ??= Date.now();

    const snap = this.snapshotTorrent(torrent);
    const alreadyImported = !!m.movedTo;
    const doImport = this.cfg.autoMoveOnComplete && !alreadyImported;

    // destroyStore only when the library already holds the (hardlinked)
    // files: it deletes just the download-folder paths. When auto-move is
    // off, the files stay put in the download folder untouched.
    await new Promise((res) =>
      this.client.remove(snap.infoHash, { destroyStore: alreadyImported }, res)
    );

    if (doImport) {
      await this.importFiles(snap, movePath).catch((e) =>
        console.error(`[engine:${this.cfg.id}] move failed:`, e.message)
      );
    }
    // When auto-move is on, clear the download folder — files are either
    // already moved (seedRatio 0) or hardlinked into the library (seeding)
    // and the torrent is done sharing, so the download copies are unwanted.
    if (this.cfg.autoMoveOnComplete) {
      await fsp
        .rm(path.join(this.cfg.downloadPath, snap.name), { recursive: true, force: true })
        .catch(() => {});
    }
    if (!this.importedHistory.has(snap.infoHash)) {
      // Nothing was (or could be) imported — keep the torrent visible as a
      // completed entry pointing at wherever its files actually are.
      this.importedHistory.set(snap.infoHash, {
        infoHash: snap.infoHash,
        magnetURI: snap.magnetURI,
        name: snap.name,
        size: snap.length,
        movedTo: m.movedTo ?? path.join(this.cfg.downloadPath, snap.name),
        addedAt: m.addedAt,
        completedAt: m.completedAt,
        libraryRef: m.libraryRef ?? null,
        title: m.title ?? null,
        year: m.year ?? null,
      });
    }
    console.log(
      `[engine:${this.cfg.id}] finished "${snap.name}" — sharing stopped${doImport ? ", imported to library" : ""}`
    );
    await this.dropCachedTorrentFile(snap.infoHash);
    this.reconcileQueue();
    this.onChange();
  }

  /**
   * Import (and, when enabled, rename) completed files into the library
   * folder. `transfer` decides the mechanism: movePath when the torrent is
   * done sharing, linkOrCopy to import instantly while it keeps seeding.
   * With naming disabled files keep their release layout; with naming
   * enabled each video file is analyzed and placed according to the user's
   * templates — movies get "{title} ({year})/{file}", series get
   * "{title}/Season {NN}/{file}", one file at a time so season packs land
   * each episode in the right place.
   */
  async importFiles(snap, transfer) {
    const m = this.meta.get(snap.infoHash);
    if (!m || m.movedTo) return;

    const naming = loadNamingTemplates();
    const movedFiles = [];
    // Files deselected by selectEpisodeFiles() (episode-targeted grab inside
    // a season pack) were never downloaded to disk — importing them would
    // just fail against a missing/empty source. Everything else defaults to
    // selected (undefined = plain grab, no per-file selection in play).
    //
    // A stall-fallback (see _watchSelectiveCompletion/_watchWholeTorrentStall)
    // clears selectedFileIndices once it gives up staying selective and pulls
    // the whole pack instead — at that point every file in the torrent reads
    // as "selected" again, even though the user only ever asked for specific
    // episode(s). The original target list is the one thing that never
    // changes for the lifetime of this grab, so once it's set it stays the
    // authority on what actually gets imported: every other episode in the
    // pack is already sitting in the library from a prior import, and
    // blindly re-moving all of them (a) overwrites files nobody asked to
    // touch and (b) means one missing/partial file among the untouched ones
    // aborts the whole loop before it even reaches the file that mattered.
    const targetList = m.episodeTargets ?? (m.episodeTarget ? [m.episodeTarget] : null);
    const availableFiles = snap.files.filter((f) => {
      if (f.selected === false) return false;
      if (!targetList) return true;
      const info = parseRelease(f.name);
      return targetList.some(
        (t) => info.season === t.season && info.episode != null &&
          (info.episode === t.episode || (info.episodeEnd != null && t.episode > info.episode && t.episode <= info.episodeEnd))
      );
    });

    if (!naming.enabled) {
      let firstDest = null;
      for (const file of availableFiles) {
        const src = path.join(this.cfg.downloadPath, file.path);
        const dest = path.join(this.cfg.completedPath, file.path);
        await transfer(src, dest);
        firstDest ??= path.join(this.cfg.completedPath, snap.name);
        movedFiles.push({ path: dest, quality: null, resolution: null, size: file.length });
      }
      m.movedTo = firstDest ?? this.cfg.completedPath;
    } else {
      const videoFiles = availableFiles.filter((f) => VIDEO_EXT_RE.test(f.name));
      const targets = videoFiles.length ? videoFiles : availableFiles;
      const releaseInfo = parseRelease(snap.name);

      let firstDest = null;
      for (const file of targets) {
        // Prefer metadata parsed from the individual file name (season packs
        // carry different episode numbers per file); fall back to the
        // torrent name when a file doesn't parse on its own.
        const fileInfo = parseRelease(file.name);
        const info = fileInfo.season != null || fileInfo.episode != null ? fileInfo : releaseInfo;
        // The release/scene name's own title is whatever language/casing the
        // group used — prefer the canonical title (and year) Movviz already
        // knows from its metadata source, when the grab was tied to a library
        // entry. Season/episode numbers still come from the parsed filename
        // (season packs need the per-file value, not a single override).
        if (m.title) info.title = m.title;
        if (m.year) info.year = String(m.year);
        const ctx = buildContext(info);
        const ext = path.extname(file.name);

        let dest;
        if (this.cfg.category === "series") {
          const seriesFolder = renderSegment(naming.seriesFolder, ctx, naming.useDotsInsteadOfSpaces);
          const seasonFolder = renderSegment(naming.seasonFolder, ctx, naming.useDotsInsteadOfSpaces);
          const fileName = renderSegment(naming.episodeFile, ctx, naming.useDotsInsteadOfSpaces) + ext;
          dest = path.join(this.cfg.completedPath, seriesFolder, seasonFolder, fileName);
        } else {
          const movieFolder = renderSegment(naming.movieFolder, ctx, naming.useDotsInsteadOfSpaces);
          const fileName = renderSegment(naming.movieFile, ctx, naming.useDotsInsteadOfSpaces) + ext;
          dest = path.join(this.cfg.completedPath, movieFolder, fileName);
        }

        const src = path.join(this.cfg.downloadPath, file.path);
        await transfer(src, dest);
        firstDest ??= dest;
        movedFiles.push({
          path: dest,
          quality: ctx.quality || null,
          resolution: ctx.resolution || null,
          videoCodec: ctx.videoCodec || null,
          audioCodec: ctx.audioCodec || null,
          hdr: ctx.hdr || null,
          source: ctx.source || null,
          size: file.length,
          season: info.season ?? null,
          episode: info.episode ?? null,
          episodeEnd: info.episodeEnd ?? null,
        });
      }

      m.movedTo = firstDest ?? this.cfg.completedPath;
    }

    this.importedHistory.set(snap.infoHash, {
      infoHash: snap.infoHash,
      magnetURI: snap.magnetURI,
      name: snap.name,
      size: snap.length,
      movedTo: m.movedTo,
      addedAt: m.addedAt,
      completedAt: m.completedAt,
      libraryRef: m.libraryRef ?? null,
      title: m.title ?? null,
      year: m.year ?? null,
    });

    this.onChange();
    if (m.libraryRef) await this.notifyLibraryImport(m.libraryRef, movedFiles, snap.infoHash);
  }

  /** Tell the web app a monitored title just landed in the library. */
  async notifyLibraryImport(libraryRef, files, infoHash) {
    try {
      const res = await fetch(`${WEB_CALLBACK_URL}/api/library/import`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-movviz-token": ENGINE_TOKEN },
        body: JSON.stringify({ libraryRef, category: this.cfg.category, files, infoHash }),
      });
      if (!res.ok) {
        console.error(`[engine:${this.cfg.id}] library import callback failed: HTTP ${res.status}`);
      }
    } catch (e) {
      console.error(`[engine:${this.cfg.id}] library import callback unreachable:`, e.message);
    }
  }

  /** Emit an activity event to the web app's v2 activity log. */
  async emitActivity(kind, data = {}) {
    try {
      const res = await fetch(`${WEB_CALLBACK_URL}/api/activity/log`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-movviz-token": ENGINE_TOKEN },
        body: JSON.stringify({ kind, actor: "system", ...data }),
      });
      if (!res.ok) {
        console.error(`[engine:${this.cfg.id}] activity log failed: HTTP ${res.status}`);
      }
    } catch (e) {
      // Web app might be restarting — non-critical, just log and move on.
      if (!e.message?.includes("ECONNREFUSED")) {
        console.error(`[engine:${this.cfg.id}] activity log unreachable:`, e.message);
      }
    }
  }

  // ---- Per-torrent controls ---------------------------------------------

  /** Force-restart a stalled torrent: remove (keep files) + re-add with same magnetURI. */
  async restart(infoHash) {
    const t = this._get(infoHash);
    if (!t) return false;
    const m = this.meta.get(infoHash);
    const magnetURI = t.magnetURI;
    if (!magnetURI) return false;

    const opts = {
      paused: m?.userPaused ?? false,
      sequential: m?.sequential ?? false,
      libraryRef: m?.libraryRef ?? null,
      title: m?.title ?? null,
      year: m?.year ?? null,
      episodeTarget: m?.episodeTarget ?? null,
      episodeTargets: m?.episodeTargets ?? null,
      infoHash,
    };

    // Remove the current torrent (keep files on disk)
    await new Promise((resolve) => {
      this.client.remove(infoHash, { destroyStore: false }, () => {
        this.meta.delete(infoHash);
        this.importedHistory.delete(infoHash);
        this.dropCachedTorrentFile(infoHash);
        resolve();
      });
    });

    // Small delay to let WebTorrent fully clean up internal state
    await new Promise((r) => setTimeout(r, 100));

    // Re-add with the same metadata — WebTorrent re-checks existing files
    const resumed = await this.add(magnetURI, opts).catch(() => null);
    this.reconcileQueue();
    this.onChange();
    return resumed !== null;
  }

  pause(infoHash) {
    const t = this._get(infoHash);
    const m = this.meta.get(infoHash);
    if (!t || !m) return false;
    m.userPaused = true;
    m.queued = false;
    t.pause();
    this.reconcileQueue();
    this.onChange();
    return true;
  }

  resume(infoHash) {
    const t = this._get(infoHash);
    const m = this.meta.get(infoHash);
    if (!t || !m) return false;
    m.userPaused = false;
    t.resume();
    this.reconcileQueue();
    this.onChange();
    return true;
  }

  setSequential(infoHash, on) {
    const m = this.meta.get(infoHash);
    if (!m) return false;
    m.sequential = !!on;
    // Best-effort: prioritise from the first piece so playback can start early.
    const t = this._get(infoHash);
    if (t && on && t.pieces?.length) t.critical(0, Math.min(8, t.pieces.length - 1));
    this.onChange();
    return true;
  }

  setFilePriorities(infoHash, priorities) {
    const t = this._get(infoHash);
    if (!t) return false;
    // priorities: array aligned to files; 0 = skip, >0 = download.
    t.files.forEach((f, i) => {
      const p = priorities[i] ?? 1;
      if (p <= 0) f.deselect();
      else f.select();
    });
    this.onChange();
    return true;
  }

  async remove(infoHash, deleteData) {
    const t = this._get(infoHash);
    if (t) {
      return new Promise((resolve) => {
        this.client.remove(infoHash, { destroyStore: !!deleteData }, () => {
          this.meta.delete(infoHash);
          this.importedHistory.delete(infoHash);
          this.dropCachedTorrentFile(infoHash);
          this.reconcileQueue();
          this.onChange();
          resolve(true);
        });
      });
    }

    // No live WebTorrent object — this is a post-restart imported entry;
    // "removing" it just drops it from the list unless the caller also
    // wants the actual library file deleted.
    const rec = this.importedHistory.get(infoHash);
    if (!rec) return false;
    this.importedHistory.delete(infoHash);
    await this.dropCachedTorrentFile(infoHash);
    if (deleteData && rec.movedTo) {
      await fsp.rm(rec.movedTo, { recursive: true, force: true }).catch(() => {});
    }
    this.onChange();
    return true;
  }

  applyConfig(patch) {
    Object.assign(this.cfg, patch);
    // Make sure any newly-pointed folders exist (Plex-aligned remaps), and
    // keep folderError in sync so a degraded instance recovers as soon as
    // the paths point somewhere writable again.
    Promise.all([ensureDir(this.cfg.downloadPath), ensureDir(this.cfg.completedPath)])
      .then(() => {
        if (this.folderError) {
          this.folderError = null;
          console.log(`[engine:${this.cfg.id}] folders OK again, downloads unblocked`);
          this.onChange();
        }
      })
      .catch((e) => {
        this.folderError = e.message;
      });
    this.applyThrottle();
    this.reconcileQueue();
    this.reconcileUploadSlots();
    this.client.torrents.forEach((t) => this.enforceRatio(t));
    this.onChange();
  }

  // ---- Reporting ---------------------------------------------------------

  state(torrent, m) {
    if (m.userPaused) return "paused";
    if (m.completed) return "completed";
    if (torrent.done) return "seeding";
    if (!torrent.ready) return "metadata";
    if (m.queued) return "queued";
    if (torrent.numPeers === 0 && torrent.downloadSpeed === 0) return "stalled";
    return "downloading";
  }

  summary(torrent, withFiles = false) {
    const m = this.meta.get(torrent.infoHash) ?? {};
    // Sanitize: WebTorrent getters can be NaN early on, and JSON turns NaN into
    // null — which would break numeric formatting on the client.
    const n = (v) => (Number.isFinite(v) ? v : 0);
    // For a selective download (season pack, only the wanted episode(s)
    // selected), torrent.length/progress/timeRemaining are all computed
    // against the WHOLE pack — showing "10% of 23 GB" for a single ~2 GB
    // episode that's actually nearly done. Report against just the selected
    // files' total instead, so the numbers reflect what's actually being
    // fetched rather than the untouched rest of the pack. Crucially this
    // also sums each selected file's OWN `.downloaded` rather than using
    // torrent.downloaded — a boundary piece shared with the very next
    // (deselected) file leaks a few bytes into that neighbor too, which
    // would otherwise make the torrent-wide total exceed the selected
    // file's exact size and round the progress bar up to 100% before the
    // file is actually fully there.
    const selectedSize = m.selectedFileIndices
      ? [...m.selectedFileIndices].reduce((sum, i) => sum + (torrent.files?.[i]?.length ?? 0), 0)
      : null;
    const size = selectedSize || n(torrent.length);
    const downloaded = m.selectedFileIndices
      ? [...m.selectedFileIndices].reduce((sum, i) => sum + n(torrent.files?.[i]?.downloaded), 0)
      : n(torrent.downloaded);
    const downloadSpeed = n(torrent.downloadSpeed);
    const s = {
      infoHash: torrent.infoHash,
      name: torrent.name ?? torrent.infoHash,
      magnetURI: torrent.magnetURI,
      instanceId: this.cfg.id,
      category: this.cfg.category,
      state: this.state(torrent, m),
      progress: selectedSize ? Math.min(1, downloaded / size) : n(torrent.progress),
      size,
      downloaded,
      uploaded: n(torrent.uploaded),
      ratio: n(torrent.ratio),
      downloadSpeed,
      uploadSpeed: n(torrent.uploadSpeed),
      numPeers: n(torrent.numPeers),
      // Always derived from the exact same size/downloaded/downloadSpeed
      // reported right above, instead of trusting WebTorrent's own
      // torrent.timeRemaining getter — that one re-reads its internal speed
      // average independently, and on a torrent that just went through a
      // stall/reconnect cycle (see _watchWholeTorrentStall) it can lag well
      // behind the freshly-sampled speed shown here, producing an ETA that
      // doesn't match the displayed speed at all (e.g. "521h" next to
      // "3.6 MB/s" for 6 GB left). Computing it from the same numbers we
      // just reported guarantees the two always agree.
      timeRemaining: downloadSpeed > 0 ? Math.max(0, ((size - downloaded) / downloadSpeed) * 1000) : null,
      sequential: !!m.sequential,
      savePath: m.movedTo ?? this.cfg.downloadPath,
      addedAt: m.addedAt ?? null,
      completedAt: m.completedAt ?? null,
      libraryRef: m.libraryRef ?? null,
      title: m.title ?? null,
      year: m.year ?? null,
    };
    if (withFiles) {
      s.files = (torrent.files ?? []).map((f) => ({
        name: f.name,
        length: f.length,
        progress: f.progress ?? 0,
        selected: f.length ? f.downloaded / f.length : 0,
      }));
    }
    return s;
  }

  /** Summary for an imported (post-restart, no live WebTorrent object) entry. */
  importedSummary(r) {
    return {
      infoHash: r.infoHash,
      name: r.name,
      magnetURI: r.magnetURI,
      instanceId: this.cfg.id,
      category: this.cfg.category,
      state: "completed",
      progress: 1,
      size: r.size ?? 0,
      downloaded: r.size ?? 0,
      uploaded: 0,
      ratio: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      numPeers: 0,
      timeRemaining: null,
      sequential: false,
      savePath: r.movedTo,
      addedAt: r.addedAt,
      completedAt: r.completedAt,
      libraryRef: r.libraryRef,
      title: r.title,
      year: r.year,
      imported: true,
    };
  }

  list() {
    const live = this.client.torrents.map((t) => this.summary(t));
    const liveHashes = new Set(live.map((s) => s.infoHash));
    const imported = [...this.importedHistory.values()]
      .filter((r) => !liveHashes.has(r.infoHash))
      .map((r) => this.importedSummary(r));
    return [...live, ...imported];
  }

  /** Periodic tick: enforce ratio limits as they cross the threshold. */
  tick() {
    this.client.torrents.forEach((t) => this.enforceRatio(t));
    this.reconcileUploadSlots();
  }

  /** Serializable set of torrents to resume on next start. */
  persistable() {
    const live = this.client.torrents.map((t) => {
      const m = this.meta.get(t.infoHash) ?? {};
      return {
        magnetURI: t.magnetURI,
        infoHash: t.infoHash,
        name: t.name,
        size: t.length ?? 0,
        addedAt: m.addedAt,
        completedAt: m.completedAt,
        userPaused: m.userPaused,
        sequential: m.sequential,
        completed: m.completed,
        // Set once importFiles() has placed the files in the library — on the next
        // start this tells resumeTorrents() to restore it as history instead
        // of re-adding a torrent pointed at an now-empty download folder.
        movedTo: m.movedTo ?? null,
        libraryRef: m.libraryRef ?? null,
        title: m.title ?? null,
        year: m.year ?? null,
        episodeTarget: m.episodeTarget ?? null,
        episodeTargets: m.episodeTargets ?? null,
      };
    });
    const liveHashes = new Set(live.map((r) => r.infoHash));
    const imported = [...this.importedHistory.values()].filter((r) => !liveHashes.has(r.infoHash));
    return [...live, ...imported];
  }

  async destroy() {
    await new Promise((res) => this.client.destroy(res));
  }
}
