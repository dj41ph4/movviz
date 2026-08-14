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

  /** Base de temps du flux courant (0 en début normal de lecture). Le fMP4
   *  servi par le serveur cherche réellement à cette position (option `-ss`),
   *  mais côté navigateur le flux repart TOUJOURS de 0 (conteneur fragmenté
   *  sans index — `el.currentTime` redevient 0 après un seek/reload).
   *  Le lecteur doit afficher/sauvegarder `seekBase + el.currentTime`. */
  get seekBase(): number {
    return this._seekBase;
  }

  constructor(callbacks: FfmpegEngineCallbacks) {
    this.cb = callbacks;
  }

  attach(video: HTMLVideoElement): void {
    this.video = video;
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
    this.src = `/api/playback-ffmpeg/${ratingKey}${qs ? `?${qs}` : ""}`;

    this.attachVideoListeners();

    this.active = true;
    video.src = this.src;
    video.load();
    void video.play().catch(() => void 0);

    if (options.debug && this.cb.onDebug) {
      if (this.debugTimer) clearInterval(this.debugTimer);
      this.debugTimer = setInterval(() => this.cb.onDebug?.(this.stats()), 500);
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
    if (this.destroyed) return;
    this.cb.onBuffering(false);
  };

  private onCanPlayThrough = (): void => {
    if (this.destroyed) return;
    this.cb.onBuffering(false);
  };

  private onError = (): void => {
    if (this.destroyed) return;
    const video = this.video;
    const mediaError = video?.error;
    const code = mediaError?.code ?? "unknown";
    const message = mediaError?.message || "no detail";
    this.cb.onError(`FFmpeg remux playback error (code ${code}): ${message}`, true);
  };

  private attachVideoListeners(): void {
    const video = this.video;
    if (!video) return;
    video.addEventListener("waiting", this.onWaiting);
    video.addEventListener("playing", this.onPlaying);
    video.addEventListener("canplay", this.onCanPlay);
    video.addEventListener("canplaythrough", this.onCanPlayThrough);
    video.addEventListener("error", this.onError);
  }

  private detachVideoListeners(): void {
    const video = this.video;
    if (!video) return;
    video.removeEventListener("waiting", this.onWaiting);
    video.removeEventListener("playing", this.onPlaying);
    video.removeEventListener("canplay", this.onCanPlay);
    video.removeEventListener("canplaythrough", this.onCanPlayThrough);
    video.removeEventListener("error", this.onError);
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

  async seek(time: number): Promise<void> {
    if (this.destroyed) return;
    // ffmpeg piped stdout can't seek in place — kill the current session
    // (DELETE) and restart with a new seekTo, which produces a different
    // session key server-side. The DELETE MUST be awaited before load():
    // a fire-and-forget DELETE could arrive at the server AFTER the new
    // GET, and stopAllForRatingKey would kill the just-created session —
    // the seek would always fall back to HLS.
    if (this.ratingKey) {
      await fetch(`/api/playback-ffmpeg/${this.ratingKey}`, { method: "DELETE", keepalive: true }).catch(() => void 0);
    }
    await this.load(this.ratingKey, { ...this.lastOptions, seekTo: time });
  }

  setPlaybackRate(rate: number): void {
    if (this.video) this.video.playbackRate = rate;
  }

  async destroy(): Promise<void> {
    this.destroyed = true;
    this.active = false;
    if (this.debugTimer) {
      clearInterval(this.debugTimer);
      this.debugTimer = null;
    }
    if (this.ratingKey) {
      await fetch(`/api/playback-ffmpeg/${this.ratingKey}`, { method: "DELETE", keepalive: true }).catch(() => void 0);
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
