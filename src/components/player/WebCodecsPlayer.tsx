"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CodecCapabilities } from "@/lib/player/webcodecs";
import { fetchAndDemux, type DemuxerSample, type DemuxerTrack } from "@/lib/player/mp4Demuxer";
import { cn } from "@/lib/utils";

interface WebCodecsPlayerProps {
  src: string;
  capabilities: CodecCapabilities;
  audioSrc?: string;
  onError?: (msg: string) => void;
  onTimeUpdate?: (time: number) => void;
  onFallback?: () => void;
  paused?: boolean;
  onPauseChange?: (paused: boolean) => void;
}

interface AudioQueueItem {
  data: AudioData;
  pts: number;
  duration: number;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function WebCodecsPlayer({
  src, capabilities, audioSrc, onError, onTimeUpdate, onFallback, paused: externalPaused, onPauseChange,
}: WebCodecsPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [internalPaused, setInternalPaused] = useState(true);
  const paused = externalPaused ?? internalPaused;
  const [buffering, setBuffering] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs for all the internals
  const stoppedRef = useRef(false);
  const pausedRef = useRef(paused);
  const fallbackRef = useRef(onFallback);
  fallbackRef.current = onFallback;
  const demoRef = useRef<AbortController | null>(null);
  const videoDecoderRef = useRef<VideoDecoder | null>(null);
  const audioDecoderRef = useRef<AudioDecoder | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const videoQueueRef = useRef<VideoFrame[]>([]);
  const audioQueueRef = useRef<AudioQueueItem[]>([]);
  const videoTimelineRef = useRef<{ pts: number; duration: number }[]>([]);
  const renderRafRef = useRef<number>(0);
  const playStartTimeRef = useRef<number>(0);
  const mediaStartTimeRef = useRef<number>(0);
  const durationRef = useRef(0);
  const volumeRef = useRef(1);
  const mutedRef = useRef(false);
  const seekTargetRef = useRef<number | null>(null);
  const pausedDurationRef = useRef(0);
  const pauseStartRef = useRef(0);
  const videoTracksRef = useRef<DemuxerTrack[]>([]);
  const audioTracksRef = useRef<DemuxerTrack[]>([]);
  const initDoneRef = useRef(false);

  pausedRef.current = paused;

  const setPaused = useCallback((v: boolean) => {
    setInternalPaused(v);
    onPauseChange?.(v);
  }, [onPauseChange]);

  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!pausedRef.current) setControlsVisible(false);
    }, 3000);
  }, []);

  const renderFrame = useCallback(() => {
    if (stoppedRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Get the current audio time for sync
    const audioCtx = audioCtxRef.current;
    const now = audioCtx?.currentTime ?? 0;
    const elapsed = audioCtx ? now - playStartTimeRef.current : 0;
    const mediaTime = mediaStartTimeRef.current + elapsed;

    // Find the right video frame for the current media time
    const queue = videoQueueRef.current;
    let frame: VideoFrame | undefined;
    let dropCount = 0;

    while (queue.length > 0) {
      const f = queue[0];
      const frameStart = f.timestamp / 1_000_000;
      const frameEnd = frameStart + (f.duration ?? 41000) / 1_000_000;

      if (frameEnd < mediaTime - 0.1) {
        // Frame is more than 100ms past — drop it
        f.close();
        queue.shift();
        videoTimelineRef.current.shift();
        dropCount++;
      } else if (frameStart <= mediaTime + 0.05) {
        // This frame is current (or within 50ms of being current)
        frame = f;
        break;
      } else {
        // This is a future frame — break and render the previous matching frame if any
        if (frame) break;
        // No current frame yet — render the closest future frame
        frame = f;
        break;
      }
    }

    // Render the frame if found
    if (frame) {
      canvas.width = frame.displayWidth;
      canvas.height = frame.displayHeight;
      ctx.drawImage(frame, 0, 0);
      frame.close();
      queue.shift();
      videoTimelineRef.current.shift();
    }

    // Dispatch time update
    const ct = seekTargetRef.current ?? mediaTime;
    setCurrentTime(ct);
    onTimeUpdate?.(ct);

    renderRafRef.current = requestAnimationFrame(renderFrame);
  }, [onTimeUpdate]);

  const scheduleAudio = useCallback(() => {
    const audioCtx = audioCtxRef.current;
    const gain = gainNodeRef.current;
    if (!audioCtx || !gain) return;

    const now = audioCtx.currentTime;
    const queue = audioQueueRef.current;

    while (queue.length > 0) {
      const item = queue[0];
      const ptsSeconds = item.pts / 1_000_000;
      const durSeconds = item.duration / 1_000_000;
      const scheduledTime = playStartTimeRef.current + ptsSeconds;

      // Only schedule if it's in the near future
      if (scheduledTime > now + 0.1) break;

      const buffer = item.data;
      const pcmData = new Float32Array(buffer.numberOfChannels * buffer.numberOfFrames);

      // Copy audio data to PCM
      for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
        const chData = new Float32Array(buffer.numberOfFrames);
        buffer.copyTo(chData, { planeIndex: ch });
        for (let i = 0; i < buffer.numberOfFrames; i++) {
          pcmData[ch + i * buffer.numberOfChannels] = chData[i];
        }
      }

      buffer.close();

      try {
        const audioBuffer = audioCtx.createBuffer(
          buffer.numberOfChannels,
          buffer.numberOfFrames,
          buffer.sampleRate,
        );
        for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
          const chData = audioBuffer.getChannelData(ch);
          for (let i = 0; i < buffer.numberOfFrames; i++) {
            chData[i] = pcmData[ch + i * buffer.numberOfChannels];
          }
        }

        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(gain);
        source.start(scheduledTime);
        // Schedule stop to ensure cleanup
        source.stop(scheduledTime + durSeconds + 0.05);
      } catch { /* skip problematic audio */ }

      queue.shift();
    }
  }, []);

  const flushPendingMedia = useCallback(() => {
    // Close all pending video frames
    for (const f of videoQueueRef.current) f.close();
    videoQueueRef.current = [];
    videoTimelineRef.current = [];
    // Close all pending audio
    for (const a of audioQueueRef.current) a.data.close();
    audioQueueRef.current = [];
  }, []);

  const initPlayer = useCallback(async () => {
    if (initDoneRef.current) return;
    stoppedRef.current = false;
    setError(null);
    setBuffering(true);
    flushPendingMedia();

    // Determine which video codec to use
    const videoCodec = capabilities.hevc ? "hev1.1.6.L93.B0" :
      capabilities.h264 ? "avc1.640028" :
      capabilities.av1 ? "av01.0.05M.08" : null;

    if (!videoCodec) {
      setError("No supported video codec");
      onError?.("No supported video codec");
      setBuffering(false);
      return;
    }

    // Determine audio codec
    const audioCodec = capabilities.aac ? "mp4a.40.2" :
      capabilities.opus ? "opus" : null;

    // Create audio context
    try {
      const audioCtx = new AudioContext();
      const gain = audioCtx.createGain();
      gain.gain.value = mutedRef.current ? 0 : volumeRef.current;
      gain.connect(audioCtx.destination);
      audioCtxRef.current = audioCtx;
      gainNodeRef.current = gain;
    } catch {
      // Audio context may fail, continue without audio
    }

    // Create VideoDecoder
    let vDecoder: VideoDecoder | null = null;
    if ("VideoDecoder" in window) {
      vDecoder = new VideoDecoder({
        output: (frame: VideoFrame) => {
          if (stoppedRef.current) { frame.close(); return; }
          const pts = frame.timestamp;
          const dur = frame.duration ?? 0;
          videoQueueRef.current.push(frame);
          if (videoTimelineRef.current.length > 0) {
            const prev = videoTimelineRef.current[videoTimelineRef.current.length - 1];
            videoTimelineRef.current.push({ pts, duration: dur });
          } else {
            videoTimelineRef.current.push({ pts, duration: dur });
          }
        },
        error: (error: DOMException) => {
          console.error("[WebCodecs] VideoDecoder error:", error.message);
        },
      });
      videoDecoderRef.current = vDecoder;
    }

    // Create AudioDecoder
    let aDecoder: AudioDecoder | null = null;
    if (audioCodec && "AudioDecoder" in window) {
      aDecoder = new AudioDecoder({
        output: (data: AudioData) => {
          if (stoppedRef.current) { data.close(); return; }
          audioQueueRef.current.push({
            data,
            pts: data.timestamp,
            duration: data.duration ?? 0,
          });
        },
        error: (error: DOMException) => {
          console.error("[WebCodecs] AudioDecoder error:", error.message);
        },
      });
      audioDecoderRef.current = aDecoder;
    }

    let configuredVideo = false;
    let configuredAudio = false;
    let configuredVideoFallback = false; // prevent re-entrant fallback
    let retryCount = 0;
    const MAX_RETRIES_FRAGMENTED = 5;

    const fetchSignal = new AbortController();
    demoRef.current = fetchSignal;

    const tryConfigureVideo = async (t: DemuxerTrack, codecStr: string): Promise<boolean> => {
      try {
        const supported = await VideoDecoder.isConfigSupported({
          codec: codecStr,
          codedWidth: t.video!.width,
          codedHeight: t.video!.height,
          description: t.description,
        });
        if (!supported.supported) {
          console.warn(`[WebCodecs] Video codec ${codecStr} not supported via isConfigSupported`);
          return false;
        }
      } catch { /* isConfigSupported threw, try configure anyway */ }

      try {
        const config: VideoDecoderConfig = {
          codec: codecStr,
          codedWidth: t.video!.width,
          codedHeight: t.video!.height,
          description: t.description,
        };
        vDecoder!.configure(config);
        return true;
      } catch {
        // configure() threw — browser rejected the config
        return false;
      }
    };

    await fetchAndDemux(src, {
      onEvent: async (evt) => {
        if (stoppedRef.current) return;

        if (evt.type === "ready") {
          if (stoppedRef.current) return;
          const tracks = evt.tracks;
          let maxDur = 0;

          for (const t of tracks) {
            const durSec = t.timescale > 0 ? t.duration / t.timescale : 0;
            if (durSec > maxDur) maxDur = durSec;

            if (t.video) {
              if (!configuredVideo && vDecoder) {
                videoTracksRef.current.push(t);
                const codecStr = videoCodec;
                const ok = await tryConfigureVideo(t, codecStr);
                if (ok) {
                  configuredVideo = true;
                } else if (!configuredVideoFallback) {
                  configuredVideoFallback = true;
                  // If this is a fragmented file, retry when more data arrives
                  if (evt.isFragmented && retryCount < MAX_RETRIES_FRAGMENTED) {
                    retryCount++;
                    console.warn(`[WebCodecs] VideoDecoder config failed (fragmented, retry ${retryCount}/${MAX_RETRIES_FRAGMENTED})`);
                    // The retry will happen when onSamples fires and we check again
                  } else {
                    // Give up — notify parent to fall back to transcoding
                    console.warn("[WebCodecs] VideoDecoder config failed, falling back to transcode");
                    setError("VideoDecoder configuration failed — falling back to transcoding");
                    fallbackRef.current?.();
                    return;
                  }
                }
              }
            }

            if (t.audio && aDecoder) {
              if (!configuredAudio) {
                audioTracksRef.current.push(t);
                try {
                  const codecStr = audioCodec ?? "mp4a.40.2";
                  const supported = await AudioDecoder.isConfigSupported({
                    codec: codecStr,
                    sampleRate: t.audio.sampleRate,
                    numberOfChannels: t.audio.channelCount,
                  });
                  if (!supported.supported) {
                    console.warn("[WebCodecs] Audio codec not supported, playing without audio");
                    aDecoder = null;
                    audioDecoderRef.current = null;
                    return;
                  }
                  aDecoder.configure({
                    codec: codecStr,
                    sampleRate: t.audio.sampleRate,
                    numberOfChannels: t.audio.channelCount,
                  });
                  configuredAudio = true;
                } catch {
                  console.warn("[WebCodecs] AudioDecoder config failed, playing without audio");
                  aDecoder = null;
                  audioDecoderRef.current = null;
                }
              }
            }
          }

          if (maxDur > 0) {
            setDuration(maxDur);
            durationRef.current = maxDur;
          }
          setBuffering(false);
        }

        if (evt.type === "samples") {
          if (stoppedRef.current) return;
          const samples = evt.samples;

          for (const s of samples) {
            if (stoppedRef.current) return;

            const trackInfo = videoTracksRef.current.find((t) => t.id === s.trackId)
              ?? audioTracksRef.current.find((t) => t.id === s.trackId);

            if (!trackInfo) continue;

            // Retry video decoder config if it failed on ready (fragmented files)
            if (trackInfo.video && vDecoder && !configuredVideo) {
              if (!configuredVideoFallback && retryCount < MAX_RETRIES_FRAGMENTED) {
                retryCount++;
                const codecStr = videoCodec;
                try {
                  const supported = await VideoDecoder.isConfigSupported({
                    codec: codecStr,
                    codedWidth: trackInfo.video.width,
                    codedHeight: trackInfo.video.height,
                    description: trackInfo.description,
                  });
                  if (supported.supported) {
                    try {
                      vDecoder.configure({
                        codec: codecStr,
                        codedWidth: trackInfo.video.width,
                        codedHeight: trackInfo.video.height,
                        description: trackInfo.description,
                      });
                      configuredVideo = true;
                      console.log(`[WebCodecs] VideoDecoder configured on retry ${retryCount}`);
                    } catch {
                      // still fails, continue retrying
                    }
                  }
                } catch { /* ignore */ }
              }
              if (!configuredVideo) continue; // skip sample until configured
            }

            if (trackInfo.video && vDecoder && configuredVideo) {
              const pts = Math.round((s.cts / trackInfo.timescale) * 1_000_000);
              const dur = Math.round((s.duration / trackInfo.timescale) * 1_000_000);

              const chunk = new EncodedVideoChunk({
                type: s.isRap ? "key" : "delta",
                timestamp: pts,
                duration: dur,
                data: s.data,
              });

              try {
                vDecoder.decode(chunk);
              } catch { /* ignore */ }
            }

            if (trackInfo.audio && aDecoder && configuredAudio) {
              const pts = Math.round((s.cts / trackInfo.timescale) * 1_000_000);
              const dur = Math.round((s.duration / trackInfo.timescale) * 1_000_000);

              const chunk = new EncodedAudioChunk({
                type: s.isRap ? "key" : "delta",
                timestamp: pts,
                duration: dur,
                data: s.data,
              });

              try {
                aDecoder.decode(chunk);
              } catch { /* ignore */ }
            }
          }
        }

        if (evt.type === "error") {
          setError(evt.message);
          onError?.(evt.message);
          setBuffering(false);
        }

        if (evt.type === "done") {
          if (audioDecoderRef.current) {
            await audioDecoderRef.current.flush();
          }
          if (videoDecoderRef.current) {
            await videoDecoderRef.current.flush();
          }
          setBuffering(false);
        }
      },
      onProgress: () => { /* progress tracking optional */ },
    }, fetchSignal.signal);

    if (!stoppedRef.current) {
      initDoneRef.current = true;
    }
  // NOTE: onFallback intentionally excluded to avoid re-init on callback identity change.
  // The ref-based design ensures initPlayer uses the latest reference internally.
  }, [src, capabilities, onError, flushPendingMedia]);

  // Start/stop render loop based on paused state
  useEffect(() => {
    if (!paused && !error) {
      if (audioCtxRef.current?.state === "suspended") {
        audioCtxRef.current.resume();
      }
      // Track time spent paused so we can offset sync
      if (pauseStartRef.current > 0) {
        pausedDurationRef.current += performance.now() - pauseStartRef.current;
        pauseStartRef.current = 0;
      }
      playStartTimeRef.current = (audioCtxRef.current?.currentTime ?? 0) - pausedDurationRef.current / 1000;
      mediaStartTimeRef.current = currentTime;
      // Schedule queued audio after resume
      scheduleAudio();
      renderRafRef.current = requestAnimationFrame(renderFrame);
    } else {
      if (audioCtxRef.current?.state === "running") {
        audioCtxRef.current.suspend();
      }
      if (pauseStartRef.current === 0) {
        pauseStartRef.current = performance.now();
      }
      if (renderRafRef.current) {
        cancelAnimationFrame(renderRafRef.current);
        renderRafRef.current = 0;
      }
    }

    return () => {
      if (renderRafRef.current) {
        cancelAnimationFrame(renderRafRef.current);
        renderRafRef.current = 0;
      }
    };
  }, [paused, error, renderFrame, currentTime]);

  // Initialize on mount
  useEffect(() => {
    stoppedRef.current = false;
    initDoneRef.current = false;

    // Start initialization
    initPlayer();

    return () => {
      stoppedRef.current = true;
      if (demoRef.current) {
        demoRef.current.abort();
        demoRef.current = null;
      }
      // Close decoders
      videoDecoderRef.current?.close();
      videoDecoderRef.current = null;
      audioDecoderRef.current?.close();
      audioDecoderRef.current = null;
      // Close audio context
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
      // Clean up frames
      flushPendingMedia();
      if (renderRafRef.current) {
        cancelAnimationFrame(renderRafRef.current);
        renderRafRef.current = 0;
      }
    };
  }, [src, initPlayer, flushPendingMedia]);

  // Update pausedRef
  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // Reset pause tracking on src change
  useEffect(() => {
    pausedDurationRef.current = 0;
    pauseStartRef.current = 0;
  }, [src]);

  const togglePlay = useCallback(() => {
    setPaused(!pausedRef.current);
  }, [setPaused]);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      setFullscreen(false);
    } else {
      await el.requestFullscreen();
      setFullscreen(true);
    }
  }, []);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const seek = useCallback((time: number) => {
    // WebCodecs doesn't support true seeking without re-demuxing
    // For now, just update the time display
    seekTargetRef.current = time;
    setCurrentTime(time);
  }, []);

  const getSeekRatio = (clientX: number): number => {
    const rect = progressBarRef.current?.getBoundingClientRect();
    if (!rect?.width) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const handleProgressDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!durationRef.current) return;
    e.preventDefault();
    const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
    const ratio = getSeekRatio(cx);
    seek(ratio * durationRef.current);

    const onMove = (me: MouseEvent | TouchEvent) => {
      const mc = "touches" in me ? me.changedTouches[0].clientX : me.clientX;
      const r = getSeekRatio(mc);
      seek(r * durationRef.current);
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove as EventListener);
      document.removeEventListener("mouseup", onUp as EventListener);
      document.removeEventListener("touchmove", onMove as EventListener);
      document.removeEventListener("touchend", onUp as EventListener);
    };
    document.addEventListener("mousemove", onMove as EventListener);
    document.addEventListener("mouseup", onUp as EventListener);
    document.addEventListener("touchmove", onMove as EventListener);
    document.addEventListener("touchend", onUp as EventListener);
  }, [seek]);

  if (error) {
    return (
      <div className="flex items-center justify-center w-full h-full bg-black">
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          <p className="text-sm text-ink-dim">{error}</p>
        </div>
      </div>
    );
  }

  const playedPct = durationRef.current > 0
    ? ((seekTargetRef.current ?? currentTime) / durationRef.current) * 100
    : 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-black overflow-hidden"
      onMouseMove={resetHideTimer}
      onTouchStart={resetHideTimer}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-pointer object-contain"
        onClick={togglePlay}
      />

      {buffering && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-8 w-8 rounded-full border-2 border-white/30 border-t-white animate-spin" />
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 transition-opacity duration-300",
          controlsVisible ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="px-3">
          <div
            className="group relative h-1 hover:h-2 transition-[height] cursor-pointer origin-bottom"
            onMouseDown={handleProgressDown}
            onTouchStart={handleProgressDown}
          >
            <div className="absolute inset-y-0 left-0 right-0 rounded-full bg-white/10" />
            <div className="absolute inset-y-0 left-0 rounded-full bg-brand-glow" style={{ width: `${playedPct}%` }} />
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity shadow"
              style={{ left: `${playedPct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center gap-0.5 px-2 py-2 bg-black/60 backdrop-blur">
          <button
            onClick={togglePlay}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-white/80 hover:text-white"
          >
            {paused ? (
              <svg className="h-5 w-5 ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            )}
          </button>

          <span className="ml-1 text-xs font-mono tabular-nums text-white/80 whitespace-nowrap select-none">
            {formatTime(seekTargetRef.current ?? currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          <span className="flex h-6 shrink-0 items-center gap-1 rounded-full bg-cyan/15 px-2 text-[10px] font-semibold text-cyan">
            WebCodecs
          </span>

          <button
            onClick={toggleFullscreen}
            className="flex h-11 w-11 items-center justify-center rounded-lg text-white/60 hover:text-white"
          >
            {fullscreen ? (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3" />
              </svg>
            ) : (
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
