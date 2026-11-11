/**
 * FfmpegRemuxEngine — browser-side player for the Movviz local ffmpeg remux
 * leg.
 *
 * Unlike MSEPlaybackEngine (which feeds SourceBuffers segment by segment),
 * this engine is deliberately simple: the server streams a fragmented-MP4
 * response directly consumable as a `<video>` element's `src`. No manifest,
 * no MediaSource, no SourceBuffer pacing — the browser's native progressive
 * download/buffering takes over.
 *
 * Deterministic fallback contract (mirrors MSEPlaybackEngine): every failure
 * path calls `onError(msg, fatal)`. The caller (VideoPlayer) tears the
 * engine down and falls back to the next engine in the chain — this leg
 * must never dead-end.
 */

import { DeepBufferFeed, deepBufferSupported } from "./deepBuffer";

/** Secondes de tampon à réunir avant de lancer la lecture (chemin tampon profond). */
const START_BUFFER_SEC = 12;
/** Attente maximale de ce tampon de départ. */
const START_BUFFER_MAX_WAIT_MS = 20_000;

export interface FfmpegEngineOptions {
  audioStreamId?: number | null;
  seekTo?: number;
  debug?: boolean;
  /** Profil de compression vidéo (remuxSession) — "original" = copie bit-exacte. */
  quality?: "original" | "4k" | "2k" | "fhd" | "hd";
}

export interface FfmpegDebugStats {
  engine: "ffmpeg";
  src: string;
  active: boolean;
  ratingKey: string;
}

export interface FfmpegEngineCallbacks {
  onBuffering: (buffering: boolean) => void;
  onError: (message: string, fatal: boolean) => void;
  onDebug?: (stats: FfmpegDebugStats) => void;
}

export class FfmpegRemuxEngine {
  private video: HTMLVideoElement | null = null;
  private cb: FfmpegEngineCallbacks;
  private ratingKey = "";
  private lastOptions: FfmpegEngineOptions = {};
  private src: string | null = null;
  private destroyed = false;
  private active = false;
  private debugTimer: ReturnType<typeof setInterval> | null = null;
  private _seekBase = 0;
  /** Flux injecté dans un MediaSource (tampon profond) ; null = lecture native `video.src`. */
  private deep: DeepBufferFeed | null = null;
  /** Posé après un échec du tampon profond : on revient au chemin natif pour cette lecture. */
  private deepDisabled = false;
  private _loadSeq = 0;
  /** Monotonic counter guarding against overlapping seek() calls resolving
   *  out of order — see seek()'s own comment for the real bug this fixes. */
  private _seekSeq = 0;
  /** Last real movie position played (seekBase + currentTime), seconds. */
  private lastPosition = 0;
  private hasPlayed = false;
  /** Position an automatic restart started from — null while a restart is
   *  allowed. Re-armed once playback has really moved on from it, so a
   *  stream that fails again right away is reported instead of looping. */
  private recoveryFrom: number | null = null;
  /** Real length of the movie, seconds (0 = unknown). */
  private expectedDurationSec = 0;
  /** Route prefix this engine streams from — defaults to the CURRENT
   *  Plex-backed production route. The new local decision-engine (Phases
   *  9-13, /api/playback/session/{id}/stream) reuses this exact client-side
   *  MSE-piping logic by pointing it at its own prefix instead — every
   *  existing caller is unaffected since they never pass this option. */
  private urlPrefix: string;
  /** Appended after the id, before the query string — the new engine's
   *  route is /api/playback/session/{id}/stream (a nested route so
   *  /subtitle can be a sibling), unlike the old flat
   *  /api/playback-ffmpeg/{ratingKey}. Empty by default (old behavior). */
  private urlSuffix: string;

  /** Base de temps du flux courant (0 en début normal de lecture). Le fMP4
   *  servi par le serveur cherche réellement à cette position (option `-ss`),
   *  mais côté navigateur le flux repart TOUJOURS de 0 (conteneur fragmenté
   *  sans index — `el.currentTime` redevient 0 après un seek/reload).
   *  Le lecteur doit afficher/sauvegarder `seekBase + el.currentTime`. */
  get seekBase(): number {
    return this._seekBase;
  }

  constructor(callbacks: FfmpegEngineCallbacks, urlPrefix = "/api/playback-ffmpeg", urlSuffix = "") {
    this.cb = callbacks;
    this.urlPrefix = urlPrefix;
    this.urlSuffix = urlSuffix;
  }

  attach(video: HTMLVideoElement): void {
    this.video = video;
  }

  /** Vrai quand le flux est lu avec le tampon profond (MSE) plutôt qu'en natif. */
  get deepBuffered(): boolean {
    return this.deep !== null;
  }

  /** Secondes d'avance gardées en réserve, en plus de ce que `video.buffered` indique. */
  get reserveSeconds(): number {
    return this.deep?.reserveSeconds ?? 0;
  }

  private stopDeep(): void {
    const deep = this.deep;
    this.deep = null;
    deep?.stop();
  }

  /** Le tampon profond a lâché : repli sur la lecture native, à la même position. */
  private onDeepFailure(deep: DeepBufferFeed, reason: string, kind: "network" | "append" | "codec"): void {
    if (this.destroyed || this.deep !== deep) return;
    this.deep = null;
    // Une coupure réseau se retente en tampon profond ; toute autre cause repasse en natif.
    if (kind !== "network") this.deepDisabled = true;
    if (!this.hasPlayed) {
      this.deepDisabled = true;
      void this.load(this.ratingKey, { ...this.lastOptions, seekTo: this._seekBase > 0 ? this._seekBase : this.lastOptions.seekTo });
      return;
    }
    this.recoverOrFail(`Deep buffer feed failed (${kind}): ${reason}`);
  }

  /** Last movie position really played, or null if nothing played yet. */
  get playedPosition(): number | null {
    return this.hasPlayed ? this.lastPosition : null;
  }

  setExpectedDuration(seconds: number): void {
    this.expectedDurationSec = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  }

  /** The pipe closed cleanly before the movie's end — ffmpeg stopped on the
   *  server (restart, purge) or a proxy closed the response. The browser
   *  reports that as `ended`; it is a lost stream, not the end of the film. */
  isPrematureEnd(): boolean {
    return this.expectedDurationSec > 0 && this.lastPosition < this.expectedDurationSec - 30;
  }

  async load(ratingKey: string, options: FfmpegEngineOptions): Promise<void> {
    if (this.destroyed) return;
    const video = this.video;
    if (!video) {
      this.cb.onError("Video element not attached", true);
      return;
    }

    // Detach any listeners tied to a previous src before wiring the new one.
    this.detachVideoListeners();

    this.ratingKey = ratingKey;
    this.lastOptions = options;

    // Base de temps du flux courant. Le fMP4 servi par le serveur cherche
    // réellement à `seekTo` (option `-ss`), mais côté navigateur le flux
    // repart TOUJOURS de 0 (conteneur fragmenté sans index — `el.currentTime`
    // redevient 0 après un seek/reload). Le lecteur doit afficher
    // `seekBase + el.currentTime` pour toute position/sauvegarde.
    this._seekBase = options.seekTo && options.seekTo > 0.5 ? options.seekTo : 0;

    const params = new URLSearchParams();
    if (options.audioStreamId !== undefined && options.audioStreamId !== null) {
      params.set("audioStreamID", String(options.audioStreamId));
    }
    if (options.seekTo && options.seekTo > 0.5) {
      params.set("seekTo", String(options.seekTo));
    }
    if (options.quality && options.quality !== "original") {
      params.set("quality", options.quality);
    }
    const qs = params.toString();
    this.src = `${this.urlPrefix}/${ratingKey}${this.urlSuffix}${qs ? `?${qs}` : ""}`;

    this.attachVideoListeners();

    const seq = ++this._loadSeq;
    this.stopDeep();
    this.active = true;
    if (!this.deepDisabled && deepBufferSupported()) {
      const deep = new DeepBufferFeed(video, this.src);
      this.deep = deep;
      const started = await deep.start((reason, kind) => this.onDeepFailure(deep, reason, kind));
      if (this.destroyed || seq !== this._loadSeq) {
        if (this.deep === deep) this.stopDeep();
        return;
      }
      if (started) {
        // Attendre un vrai tampon avant de lancer la lecture : sans lui, elle démarre à
        // 0 s d'avance et chaque à-coup du serveur devient une coupure visible.
        await this.waitForStartBuffer(video, seq);
        if (this.destroyed || seq !== this._loadSeq) return;
        void video.play().catch(() => void 0);
      } else {
        // Codec non pris en charge, MSE indisponible, serveur refusé… : lecture native, comme avant.
        if (this.deep === deep) this.deep = null;
        video.src = this.src;
        video.load();
        void video.play().catch(() => void 0);
      }
    } else {
      video.src = this.src;
      video.load();
      void video.play().catch(() => void 0);
    }

    if (options.debug && this.cb.onDebug) {
      if (this.debugTimer) clearInterval(this.debugTimer);
      this.debugTimer = setInterval(() => this.cb.onDebug?.(this.stats()), 500);
    }
  }

  /** Vrai pendant l'attente du tampon de départ : le rond de chargement reste affiché. */
  private startGate = false;

  /**
   * Retient le lancement de la lecture jusqu'à START_BUFFER_SEC secondes de tampon devant la
   * tête de lecture (ou la fin du flux, ou START_BUFFER_MAX_WAIT_MS au plus : un serveur lent
   * ne doit jamais bloquer le film). Vaut aussi après un saut dans le film, qui relance ffmpeg.
   */
  private async waitForStartBuffer(video: HTMLVideoElement, seq: number): Promise<void> {
    const startedAt = Date.now();
    this.startGate = true;
    this.cb.onBuffering(true);
    try {
      while (!this.destroyed && seq === this._loadSeq && Date.now() - startedAt < START_BUFFER_MAX_WAIT_MS) {
        const t = video.currentTime;
        let ahead = 0;
        let reachesEnd = false;
        for (let r = 0; r < video.buffered.length; r++) {
          if (t >= video.buffered.start(r) - 0.25 && t <= video.buffered.end(r)) {
            ahead = video.buffered.end(r) - t;
            reachesEnd = Number.isFinite(video.duration) && video.buffered.end(r) >= video.duration - 0.5;
          }
        }
        if (ahead >= START_BUFFER_SEC || (reachesEnd && ahead > 0)) break;
        await new Promise<void>((resolve) => setTimeout(resolve, 200));
      }
    } finally {
      if (seq === this._loadSeq) this.startGate = false;
    }
  }

  private onWaiting = (): void => {
    if (this.destroyed) return;
    this.cb.onBuffering(true);
  };

  private onPlaying = (): void => {
    if (this.destroyed) return;
    this.cb.onBuffering(false);
  };

  private onCanPlay = (): void => {
    if (this.destroyed || this.startGate) return;
    this.cb.onBuffering(false);
  };

  private onCanPlayThrough = (): void => {
    if (this.destroyed || this.startGate) return;
    this.cb.onBuffering(false);
  };

  private onTimeUpdate = (): void => {
    const video = this.video;
    if (this.destroyed || !video || video.currentTime <= 0) return;
    this.hasPlayed = true;
    this.lastPosition = this._seekBase + video.currentTime;
    if (this.recoveryFrom !== null && this.lastPosition - this.recoveryFrom >= 5) this.recoveryFrom = null;
  };

  private onError = (): void => {
    if (this.destroyed) return;
    const video = this.video;
    const mediaError = video?.error;
    if (this.deep) {
      // Erreur du décodeur sur le flux MSE : on réessaie en natif plutôt qu'en MSE.
      this.stopDeep();
      this.deepDisabled = true;
    }
    const code = mediaError?.code ?? "unknown";
    const message = mediaError?.message || "no detail";
    this.recoverOrFail(`FFmpeg remux playback error (code ${code}): ${message}`);
  };

  private onEnded = (): void => {
    if (this.destroyed || !this.isPrematureEnd()) return;
    // Deferred so every other `ended` listener (the player's own) still sees
    // this engine active and can ask isPrematureEnd() before a fatal report
    // tears it down.
    const reason = `FFmpeg remux stream ended at ${Math.round(this.lastPosition)}s of ${Math.round(this.expectedDurationSec)}s`;
    setTimeout(() => { if (!this.destroyed) this.recoverOrFail(reason); }, 0);
  };

  /**
   * A stream that was playing and broke is restarted once at the same
   * position — the same path as a seek — instead of ending playback. A
   * stream that never played, or breaks again right after that restart, is
   * reported as fatal.
   */
  private recoverOrFail(reason: string): void {
    // Un saut demandé par l'utilisateur tue lui-même l'ancien flux : la coupure qui en découle ne doit
    // pas déclencher une « récupération » à l'ancienne position, qui écraserait le clic.
    if (this._seekPending > 0 && this.hasPlayed) return;
    if (this.hasPlayed && this.recoveryFrom === null) {
      this.recoveryFrom = this.lastPosition;
      this.cb.onError(`${reason} — restarting at ${Math.round(this.lastPosition)}s`, false);
      this.cb.onBuffering(true);
      void this.seek(this.lastPosition);
      return;
    }
    this.cb.onError(reason, true);
  }

  private attachVideoListeners(): void {
    const video = this.video;
    if (!video) return;
    video.addEventListener("waiting", this.onWaiting);
    video.addEventListener("playing", this.onPlaying);
    video.addEventListener("canplay", this.onCanPlay);
    video.addEventListener("canplaythrough", this.onCanPlayThrough);
    video.addEventListener("error", this.onError);
    video.addEventListener("timeupdate", this.onTimeUpdate);
    video.addEventListener("ended", this.onEnded);
  }

  private detachVideoListeners(): void {
    const video = this.video;
    if (!video) return;
    video.removeEventListener("waiting", this.onWaiting);
    video.removeEventListener("playing", this.onPlaying);
    video.removeEventListener("canplay", this.onCanPlay);
    video.removeEventListener("canplaythrough", this.onCanPlayThrough);
    video.removeEventListener("error", this.onError);
    video.removeEventListener("timeupdate", this.onTimeUpdate);
    video.removeEventListener("ended", this.onEnded);
  }

  private stats(): FfmpegDebugStats {
    return {
      engine: "ffmpeg",
      src: this.src ?? "",
      active: this.active,
      ratingKey: this.ratingKey,
    };
  }

  async play(): Promise<void> {
    void this.video?.play().catch(() => void 0);
  }

  async pause(): Promise<void> {
    this.video?.pause();
  }

  /** Sauts demandés par l'utilisateur et pas encore terminés (un clic sur la barre peut en cacher plusieurs). */
  private _seekPending = 0;

  async seek(time: number): Promise<void> {
    if (this.destroyed) return;
    this._seekPending++;
    try {
      await this.seekInner(time);
    } finally {
      this._seekPending--;
    }
  }

  private async seekInner(time: number): Promise<void> {
    // ffmpeg piped stdout can't seek in place — kill the current session
    // (DELETE) and restart with a new seekTo, which produces a different
    // session key server-side. The DELETE MUST be awaited before load():
    // a fire-and-forget DELETE could arrive at the server AFTER the new
    // GET, and stopAllForRatingKey would kill the just-created session —
    // the seek would always fall back to HLS.
    const mySeq = ++this._seekSeq;
    // Saut dans la partie déjà reçue : on déplace la tête de lecture, sans relancer ffmpeg.
    const video = this.video;
    if (this.deep && video) {
      const range = this.deep.bufferedRange();
      const local = time - this._seekBase;
      if (range && local >= range[0] + 0.5 && local <= range[1] - 2) {
        video.currentTime = local;
        return;
      }
      // Saut en avant dans la réserve (reçue, pas encore confiée au navigateur) : on la réutilise.
      if (range && local > range[1] - 2 && (await this.deep.jumpInReserve(local))) {
        if (mySeq !== this._seekSeq || this.destroyed) return;
        video.currentTime = local;
        return;
      }
      if (mySeq !== this._seekSeq || this.destroyed) return;
    }
    if (this.ratingKey) {
      await fetch(`${this.urlPrefix}/${this.ratingKey}${this.urlSuffix}`, { method: "DELETE", keepalive: true }).catch(() => void 0);
    }
    // A NEWER seek() call started while this one's DELETE was still in
    // flight (rapid progress-bar scrubbing fires seekTo() repeatedly with
    // no debounce). Without this guard, two overlapping seeks race and can
    // resolve in EITHER order — confirmed live: dragging the seek bar
    // produced audio/video that didn't match what was on screen, because
    // an earlier-requested-but-later-resolving seek's load() ran last and
    // silently won, setting video.src to the WRONG (stale) position even
    // though the UI already displayed the newer, correct timestamp
    // (setCurrentTime() in seekTo() is synchronous and always reflects the
    // latest request). Abandoning every superseded seek here — only the
    // most recent one is ever allowed to actually call load().
    if (mySeq !== this._seekSeq) return;
    await this.load(this.ratingKey, { ...this.lastOptions, seekTo: time });
  }

  setPlaybackRate(rate: number): void {
    if (this.video) this.video.playbackRate = rate;
  }

  async destroy(): Promise<void> {
    this.destroyed = true;
    this.active = false;
    this.stopDeep();
    if (this.debugTimer) {
      clearInterval(this.debugTimer);
      this.debugTimer = null;
    }
    if (this.ratingKey) {
      await fetch(`${this.urlPrefix}/${this.ratingKey}${this.urlSuffix}`, { method: "DELETE", keepalive: true }).catch(() => void 0);
    }
    const video = this.video;
    if (video) {
      this.detachVideoListeners();
      video.pause();
      try {
        video.removeAttribute("src");
      } catch {
        /* ignore */
      }
      try {
        video.load();
      } catch {
        /* ignore */
      }
    }
    this.src = null;
  }
}
