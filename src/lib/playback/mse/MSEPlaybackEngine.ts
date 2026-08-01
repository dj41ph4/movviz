/**
 * MSEPlaybackEngine — browser-side Media Source Extensions player for the
 * Movviz fMP4 pipeline.
 *
 * The server slices the source MP4 into fMP4 init + media segments (bitstream
 * copy, zero re-encode). This engine fetches the manifest, feeds two
 * SourceBuffers (video/audio) and keeps a sliding window of buffered data.
 *
 * Deterministic fallback contract: every failure path calls
 * `onError(msg, fatal)`. The caller (VideoPlayer) tears the engine down and
 * falls back to the existing engines — the player must never dead-end.
 */

export interface MseSegment {
  index: number;
  firstSample: number;
  lastSample: number;
  keyframe: boolean;
  startSec: number;
  endSec: number;
}

export interface MseTrackInfo {
  id: number;
  kind: string;
  timescale: number;
  codec: string;
  width: number | null;
  height: number | null;
  channels: number | null;
  sampleRate: number | null;
  segments: MseSegment[];
}

export interface MseManifest {
  durationSec: number;
  video: MseTrackInfo;
  audio: MseTrackInfo[];
}

export interface MseDebugStats {
  bufferedSec: number;
  networkMbps: number;
  rebufferCount: number;
  segmentMs: number;
  startupMs: number;
  errors: number;
  fetchedBytes: number;
  state: string;
}

export interface MseEngineOptions {
  videoMime: string;
  audioMime: string;
  seekTo?: number;
  debug?: boolean;
}

export interface MseEngineCallbacks {
  onBuffering: (buffering: boolean) => void;
  onError: (message: string, fatal: boolean) => void;
  onDebug?: (stats: MseDebugStats) => void;
}

const FORWARD_BUFFER = 60;
const BACK_BUFFER = 30;
const MAX_RETRIES = 3;
const END_THRESHOLD = 0.6;

function segmentAtTime(segments: MseSegment[], timeSec: number): MseSegment {
  let best = segments[0];
  for (const s of segments) {
    if (s.startSec > timeSec + 0.01) break;
    best = s;
  }
  return best;
}

async function fetchBuf(url: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  const res = await fetch(url, { cache: "no-store", signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.arrayBuffer();
}

interface SourceBufferWrap {
  buf: SourceBuffer;
  queue: Promise<void>;
}

export class MSEPlaybackEngine {
  private video: HTMLVideoElement | null = null;
  private mediaSource: MediaSource | null = null;
  private sb: SourceBufferWrap[] = [];
  private manifest: MseManifest | null = null;
  private ratingKey = "";
  private videoMime = "";
  private audioMime = "";
  private opts: MseEngineOptions | null = null;
  private cb: MseEngineCallbacks;
  private destroyed = false;
  private loaded = false;
  private pendingSeek: number | null = null;
  private appending = false;
  private retries = 0;
  private rebuffers = 0;
  private errors = 0;
  private fetchedBytes = 0;
  private fetchTimes: number[] = [];
  private startedAt = 0;
  private lastNetworkSample = 0;
  private objectUrl: string | null = null;
  private debugTimer: ReturnType<typeof setInterval> | null = null;

  constructor(callbacks: MseEngineCallbacks) {
    this.cb = callbacks;
  }

  attach(video: HTMLVideoElement): void {
    this.video = video;
  }

  async load(ratingKey: string, options: MseEngineOptions): Promise<void> {
    if (this.destroyed) return;
    this.ratingKey = ratingKey;
    this.opts = options;
    this.videoMime = options.videoMime;
    this.audioMime = options.audioMime;
    this.startedAt = performance.now();

    if (typeof window === "undefined" || !("MediaSource" in window)) {
      this.cb.onError("MediaSource API unavailable", true);
      return;
    }

    try {
      const manifest = (await (await fetch(`/api/playback/${ratingKey}/manifest`, { cache: "no-store" })).json()) as MseManifest;
      if (!manifest?.video || !Array.isArray(manifest.audio)) {
        this.cb.onError("Invalid MSE manifest", true);
        return;
      }
      this.manifest = manifest;
    } catch {
      this.cb.onError("Failed to load MSE manifest", true);
      return;
    }

    const video = this.video;
    if (!video) {
      this.cb.onError("Video element not attached", true);
      return;
    }

    const ms = new MediaSource();
    this.mediaSource = ms;
    ms.addEventListener("sourceopen", () => this.onSourceOpen());
    ms.addEventListener("sourceended", () => this.cb.onBuffering(false));

    this.objectUrl = URL.createObjectURL(ms);
    video.src = this.objectUrl;
    video.load();

    if (this.opts?.debug && this.cb.onDebug) {
      this.debugTimer = setInterval(() => this.cb.onDebug?.(this.stats()), 500);
    }
  }

  private onSourceOpen(): void {
    const ms = this.mediaSource;
    const manifest = this.manifest;
    if (!ms || !manifest || this.destroyed) return;

    try {
      const vb = ms.addSourceBuffer(this.videoMime);
      this.sb.push({ buf: vb, queue: Promise.resolve() });
      const audioTrack = manifest.audio[0];
      if (audioTrack && this.audioMime) {
        const ab = ms.addSourceBuffer(this.audioMime);
        this.sb.push({ buf: ab, queue: Promise.resolve() });
      }
    } catch (e) {
      this.cb.onError(`SourceBuffer rejected (${this.videoMime}/${this.audioMime})`, true);
      return;
    }

    ms.duration = manifest.durationSec || 0;
    this.loaded = true;

    const initial = this.opts?.seekTo && this.opts.seekTo > 0 ? this.opts.seekTo : 0;
    void this.startPlayback(initial);
  }

  private async startPlayback(seekTo: number): Promise<void> {
    const video = this.video;
    if (!video || this.destroyed) return;

    video.addEventListener("seeking", this.onSeeking);
    video.addEventListener("waiting", this.onWaiting);
    video.addEventListener("playing", this.onPlaying);

    const bufferingTimer = setTimeout(() => {
      if (!this.destroyed) this.cb.onBuffering(true);
    }, 350);

    try {
      await this.appendInitAll();
      this.pendingSeek = seekTo > 0.5 ? seekTo : 0;
      await this.runAppender();
      clearTimeout(bufferingTimer);
      this.cb.onBuffering(false);
      if (this.pendingSeek !== null && this.pendingSeek > 0) {
        video.currentTime = this.pendingSeek;
      }
      this.pendingSeek = null;
      void video.play().catch(() => void 0);
    } catch (e) {
      clearTimeout(bufferingTimer);
      if (this.destroyed) return;
      this.errors++;
      this.cb.onError(`MSE start failed: ${e instanceof Error ? e.message : "unknown"}`, true);
    }
  }

  private onWaiting = (): void => {
    this.rebuffers++;
    const video = this.video;
    const manifest = this.manifest;
    if (!video || !manifest || this.destroyed) return;
    if (!this.appending) {
      this.pendingSeek = video.currentTime;
      void this.runAppender();
    }
  };

  private onPlaying = (): void => {
    this.cb.onBuffering(false);
  };

  private onSeeking = (): void => {
    const video = this.video;
    if (!video || this.destroyed) return;
    this.pendingSeek = video.currentTime;
    if (!this.appending) void this.runAppender();
  };

  private async appendInitAll(): Promise<void> {
    const manifest = this.manifest!;
    await this.sb[0].queue;
    await this.appendInit(this.sb[0], `${manifest.video.id}`);
    const audioTrack = manifest.audio[0];
    if (this.sb[1] && audioTrack) {
      await this.sb[1].queue;
      await this.appendInit(this.sb[1], `${audioTrack.id}`);
    }
  }

  private appendInit(w: SourceBufferWrap, trackId: string): Promise<void> {
    const op = (async () => {
      if (this.destroyed) return;
      const buf = await fetchBuf(`/api/playback/${this.ratingKey}/init/${trackId}`);
      await new Promise<void>((resolve, reject) => {
        if (this.destroyed) return resolve();
        const done = () => {
          w.buf.removeEventListener("updateend", done);
          w.buf.removeEventListener("error", onErr);
          resolve();
        };
        const onErr = () => {
          w.buf.removeEventListener("updateend", done);
          w.buf.removeEventListener("error", onErr);
          reject(new Error("appendBuffer error"));
        };
        w.buf.addEventListener("updateend", done, { once: true });
        w.buf.addEventListener("error", onErr, { once: true });
        try {
          w.buf.appendBuffer(new Uint8Array(buf));
        } catch (e) {
          w.buf.removeEventListener("updateend", done);
          reject(e);
        }
      });
      this.fetchedBytes += buf.byteLength;
    })();
    w.queue = w.queue.then(() => op);
    return op;
  }

  private enqueue(w: SourceBufferWrap, buf: ArrayBuffer): Promise<void> {
    const op = (async () => {
      if (this.destroyed) return;
      await new Promise<void>((resolve, reject) => {
        if (this.destroyed) return resolve();
        const done = () => {
          w.buf.removeEventListener("updateend", done);
          w.buf.removeEventListener("error", onErr);
          resolve();
        };
        const onErr = () => {
          w.buf.removeEventListener("updateend", done);
          w.buf.removeEventListener("error", onErr);
          reject(new Error("appendBuffer error"));
        };
        w.buf.addEventListener("updateend", done, { once: true });
        w.buf.addEventListener("error", onErr, { once: true });
        try {
          w.buf.appendBuffer(new Uint8Array(buf));
        } catch (e) {
          w.buf.removeEventListener("updateend", done);
          reject(e);
        }
      });
      this.fetchedBytes += buf.byteLength;
    })();
    w.queue = w.queue.then(() => op);
    return op;
  }

  private async runAppender(): Promise<void> {
    if (this.appending || this.destroyed || !this.manifest) return;
    this.appending = true;
    try {
      await this.appendLoop();
    } catch (e) {
      if (this.destroyed) return;
      this.errors++;
      if (this.retries < MAX_RETRIES) {
        this.retries++;
        await new Promise((r) => setTimeout(r, 400 * this.retries));
        try {
          await this.appendLoop();
        } catch (e2) {
          if (!this.destroyed) this.cb.onError(`MSE segment failure: ${e2 instanceof Error ? e2.message : "unknown"}`, true);
        }
      } else if (!this.destroyed) {
        this.cb.onError(`MSE segment failure: ${e instanceof Error ? e.message : "unknown"}`, true);
      }
    } finally {
      this.appending = false;
    }
  }

  private async appendLoop(): Promise<void> {
    const video = this.video;
    const manifest = this.manifest;
    if (!video || !manifest || this.destroyed) return;

    let seek = this.pendingSeek;
    if (seek !== null) {
      this.pendingSeek = null;
      this.retries = 0;
      await this.resetBuffers(seek);
    }

    const videoTrack = manifest.video;
    const audioTrack = manifest.audio[0];
    let vi = this.videoIndexAt(video.currentTime);
    let ai = audioTrack ? this.audioIndexAt(video.currentTime) : -1;
    const lastV = videoTrack.segments.length - 1;
    const lastA = audioTrack ? audioTrack.segments.length - 1 : -1;
    const maxQueue = Math.max(videoTrack.segments.length, lastA + 1);

    for (let guard = 0; guard < maxQueue + 4 && !this.destroyed; guard++) {
      if (this.pendingSeek !== null) {
        const target = this.pendingSeek;
        this.pendingSeek = null;
        await this.resetBuffers(target);
        vi = this.videoIndexAt(target);
        ai = audioTrack ? this.audioIndexAt(target) : -1;
      }

      const time = video.currentTime;
      const ahead = this.bufferedAhead(video);

      if (ahead >= FORWARD_BUFFER) return;
      if (vi > lastV && (ai > lastA || !audioTrack)) {
        this.trimBack(time);
        this.endIfDone();
        return;
      }

      if (this.needsAudio(vi, ai, lastV, lastA, time)) {
        const seg = audioTrack!.segments[ai];
        const t0 = performance.now();
        const buf = await fetchBuf(`/api/playback/${this.ratingKey}/audio/${audioTrack!.id}/${seg.index}`);
        this.fetchTimes.push(performance.now() - t0);
        await this.enqueue(this.sb[1], buf);
        ai++;
      } else if (vi <= lastV) {
        const seg = videoTrack.segments[vi];
        const t0 = performance.now();
        const buf = await fetchBuf(`/api/playback/${this.ratingKey}/video/${seg.index}`);
        this.fetchTimes.push(performance.now() - t0);
        await this.enqueue(this.sb[0], buf);
        vi++;
      }

      this.trimBack(time);

      if (this.fetchTimes.length > 40) this.fetchTimes.splice(0, this.fetchTimes.length - 40);
      if (this.pendingSeek !== null && !this.destroyed) continue;
      const t2 = video.currentTime;
      const a2 = this.bufferedAhead(video);
      if (a2 >= FORWARD_BUFFER) return;
      if (t2 !== time) continue;
    }
    this.endIfDone();
  }

  private needsAudio(vi: number, ai: number, lastV: number, lastA: number, time: number): boolean {
    if (ai < 0 || ai > lastA) return false;
    const vSeg = this.manifest!.video.segments[Math.min(vi, lastV)];
    const aSeg = this.manifest!.audio[0].segments[ai];
    if (vi > lastV) return true;
    if (aSeg.startSec <= time && vi > 0) {
      const prevV = this.manifest!.video.segments[Math.max(0, vi - 1)];
      return aSeg.startSec <= prevV.endSec;
    }
    return aSeg.startSec <= vSeg.startSec + 0.5;
  }

  private videoIndexAt(time: number): number {
    const segs = this.manifest!.video.segments;
    return Math.max(0, Math.min(segs.length - 1, segs.findIndex((s) => s.startSec > time) === -1 ? segs.length - 1 : Math.max(0, segs.findIndex((s) => s.startSec > time)) - 1));
  }

  private audioIndexAt(time: number): number {
    const segs = this.manifest!.audio[0].segments;
    return Math.max(0, Math.min(segs.length - 1, segs.findIndex((s) => s.startSec > time) === -1 ? segs.length - 1 : Math.max(0, segs.findIndex((s) => s.startSec > time)) - 1));
  }

  private bufferedAhead(video: HTMLVideoElement): number {
    if (video.buffered.length === 0) return 0;
    const time = video.currentTime;
    for (let i = 0; i < video.buffered.length; i++) {
      if (video.buffered.start(i) <= time + 0.1 && time + 0.1 <= video.buffered.end(i)) {
        return video.buffered.end(i) - time;
      }
    }
    return 0;
  }

  private trimBack(time: number): void {
    for (const w of this.sb) {
      const b = w.buf;
      if (b.updating) continue;
      try {
        const ranges = b.buffered;
        for (let i = 0; i < ranges.length; i++) {
          if (ranges.end(i) < time - BACK_BUFFER) {
            b.remove(ranges.start(i), ranges.end(i));
          }
        }
      } catch { /* race — retried next pass */ }
    }
  }

  private async resetBuffers(seek: number): Promise<void> {
    for (const w of this.sb) {
      await w.queue;
    }
    for (const w of this.sb) {
      const b = w.buf;
      try {
        for (let i = b.buffered.length - 1; i >= 0; i--) {
          b.remove(b.buffered.start(i), b.buffered.end(i));
        }
      } catch { /* ignore */ }
    }
  }

  private endIfDone(): void {
    const video = this.video;
    const manifest = this.manifest;
    if (!video || !manifest || this.destroyed) return;
    const dur = manifest.durationSec;
    if (dur > 0 && video.currentTime >= dur - END_THRESHOLD) {
      this.cb.onBuffering(false);
    }
  }

  private stats(): MseDebugStats {
    const video = this.video;
    let bufferedSec = 0;
    if (video && video.buffered.length > 0) {
      bufferedSec = Math.max(0, video.buffered.end(video.buffered.length - 1) - video.currentTime);
    }
    const now = performance.now();
    const elapsed = Math.max(1, now - this.startedAt);
    const recent = this.fetchTimes.slice(-20);
    const avgMs = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
    const networkMbps = (this.fetchedBytes * 8) / elapsed / 1000;
    const windowMs = now - this.lastNetworkSample;
    if (windowMs > 1500) this.lastNetworkSample = now;
    return {
      bufferedSec,
      networkMbps,
      rebufferCount: this.rebuffers,
      segmentMs: avgMs,
      startupMs: this.startedAt ? now - this.startedAt : 0,
      errors: this.errors,
      fetchedBytes: this.fetchedBytes,
      state: this.appending ? "appending" : this.destroyed ? "destroyed" : "idle",
    };
  }

  async seek(time: number): Promise<void> {
    if (this.destroyed) return;
    this.pendingSeek = time;
    if (!this.appending) void this.runAppender();
  }

  async play(): Promise<void> {
    void this.video?.play().catch(() => void 0);
  }

  async pause(): Promise<void> {
    this.video?.pause();
  }

  setPlaybackRate(rate: number): void {
    if (this.video) this.video.playbackRate = rate;
  }

  destroy(): void {
    this.destroyed = true;
    if (this.debugTimer) clearInterval(this.debugTimer);
    const video = this.video;
    if (video) {
      video.removeEventListener("seeking", this.onSeeking);
      video.removeEventListener("waiting", this.onWaiting);
      video.removeEventListener("playing", this.onPlaying);
      video.pause();
      try { video.removeAttribute("src"); } catch { /* ignore */ }
      try { video.load(); } catch { /* ignore */ }
    }
    for (const w of this.sb) {
      try {
        if (w.buf.updating === false) w.buf.remove(0, Number.MAX_SAFE_INTEGER);
      } catch { /* ignore */ }
    }
    this.sb = [];
    const ms = this.mediaSource;
    if (ms && ms.readyState !== "closed") {
      try { ms.endOfStream(); } catch { /* ignore */ }
    }
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
      this.objectUrl = null;
    }
    this.mediaSource = null;
  }
}
