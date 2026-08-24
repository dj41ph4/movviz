"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
// dashjs est importé dynamiquement côté navigateur uniquement (window au
// niveau module — pas SSR-safe) ; seul le TYPE est importé statiquement.
import type { MediaPlayerClass } from "dashjs";
import { cn, openPlexLink } from "@/lib/utils";
import { useI18n } from "@/i18n/provider";
import { findTrackForLocale } from "@/lib/library/detectLanguage";
import { usePreferredAudioLanguage } from "@/lib/settings/usePreferredAudioLanguage";
import {
  X, Maximize2, Minimize2, ExternalLink, AlertTriangle, Loader2, Check, RotateCcw,
  Play, Pause, Volume2, Volume1, VolumeX, Gauge, AudioLines, Captions,
  SkipBack, SkipForward, PictureInPicture2, Monitor,
} from "lucide-react";
import { detectCodecs, isVideoCodecSupported, isAudioCodecSupported, isAudioMseTransmuxable, shouldForceAudioTranscode, type CodecCapabilities } from "@/lib/player/webcodecs";
import { watchForSilentAudio } from "@/lib/player/silentAudioDetector";
import { AnimatedLogo } from "@/components/fx/AnimatedLogo";
import { orchestrate } from "@/lib/playback/orchestrator";
import { detectCapabilities } from "@/lib/playback/capabilities";
import { MSEPlaybackEngine, type MseDebugStats } from "@/lib/playback/mse/MSEPlaybackEngine";
import { FfmpegRemuxEngine, type FfmpegDebugStats } from "@/lib/playback/ffmpeg/FfmpegRemuxEngine";
import type { FfmpegQuality } from "@/lib/playback/ffmpeg/remuxSession";
import type { MediaInfo } from "@/lib/playback/types";
import { useBetaPlayer } from "@/lib/settings/useBetaPlayer";
import { PROGRESS_STORAGE_KEY } from "@/lib/player/watchProgress";
import { detectDesktopClientProfile } from "@/lib/playback/engine/clientProfile.detect";
import { getOrCreateDeviceId } from "@/lib/playback/engine/deviceId";

export interface VideoPlayerProps {
  ratingKey: string;
  /** Identité Movviz stable pour une lecture locale ; optionnel pour préserver les appels Plex. */
  movvizId?: string;
  /** Identifiant brut de la série — distinct de `movvizId` qui encode aussi
   * saison/épisode pour la progression. */
  seriesId?: string;
  /** Optional for a local Movviz source which Plex has not indexed yet. */
  plexUrl?: string | null;
  title: string;
  onClose: () => void;
  useTranscode?: boolean;
  /** Seconds to pre-buffer before starting playback (default 0 = play immediately). */
  prebufferSeconds?: number;
  /** True when rendered inside TheaterModePlayer, which owns positioning,
   *  sizing, and the backdrop — skips this component's own fixed/backdrop
   *  wrapper so it doesn't fight the parent's animated geometry. */
  embedded?: boolean;
  mediaType?: "movie" | "episode";
  seasonNumber?: number;
  episodeNumber?: number;
  tmdbId?: number;
  startFromBeginning?: boolean;
  /** A page-level resume CTA already chose its exact start point (seconds). */
  resumeFromSeconds?: number;
  /** Provided only for a series episode whose immediate successor is known. */
  onNextEpisode?: () => void;
}

interface StreamTrack {
  id: string;
  codec: string;
  language: string;
  channels?: number;
  toTextConvertible?: boolean;
  selected?: boolean;
}

interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

/**
 * Regex des lignes de timing WebVTT. ATTENTION : ffmpeg (muxer webvtt) écrit
 * `MM:SS.mmm` quand les heures valent 0 et `HH:MM:SS.mmm` sinon — les heures
 * sont donc optionnelles, sinon tous les cues d'un film de moins d'1h (et
 * tous ceux avant la 1ère heure) ne sont jamais parsés.
 */
const CUE_TIME_RE = /(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\.(\d{3})\s*-->\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\.(\d{3})/;
function toCueSeconds(h: number, m: number, s: number, ms: number): number {
  return h * 3600 + m * 60 + s + ms / 1000;
}
function getCueCtor(): (typeof VTTCue) | undefined {
  if (typeof window === "undefined") return undefined;
  return window.VTTCue ?? (window as unknown as { TextTrackCue?: typeof VTTCue }).TextTrackCue;
}

interface StreamInfo {
  videoCodec: string | null;
  audioCodec: string | null;
  container: string | null;
  audioStreams?: StreamTrack[];
  subtitleStreams?: StreamTrack[];
  height?: number | null;
  ffmpegAvailable?: boolean;
  durationMs?: number | null;
  markers?: { id: string; type: "intro" | "credits"; startMs: number; endMs: number; final?: boolean }[];
}

/**
 * Best fallback track when the default one (DTS/TrueHD/PCM) can't be decoded.
 * Prefers: same language as the original track → 5.1 (3-6 channels) → 2.0 → AAC.
 */
function scoreAudioTrack(t: StreamTrack, prefLang: string): number {
  const c = (t.codec ?? "").toLowerCase();
  let score = 0;
  if (prefLang && (t.language ?? "").toLowerCase() === prefLang) score += 4;
  const ch = t.channels ?? 0;
  if (ch >= 3 && ch <= 6) score += 2;
  else if (ch === 2) score += 1;
  if (c.includes("aac")) score += 1;
  return score;
}

const PROGRESS_KEY = PROGRESS_STORAGE_KEY;
const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

/**
 * Max seconds to pre-buffer before starting playback. The pre-buffer warms
 * the server-side stream cache so early seeks are instant — but it DELAYS
 * playback start by its own value, so it must stay small: wiring the old
 * streamCacheTtl default (300s) straight in as prebufferSeconds held every
 * movie on the "mise en cache…" screen for up to 5 minutes. 30s matches
 * hls.js's own maxBufferLength: a sane head start, not a loading wall.
 */
export const PREBUFFER_SECONDS = 30;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VideoPlayer({ ratingKey, movvizId, seriesId, plexUrl, title, onClose, useTranscode, prebufferSeconds, embedded, mediaType = "movie", seasonNumber, episodeNumber, tmdbId, startFromBeginning = false, resumeFromSeconds, onNextEpisode }: VideoPlayerProps) {
  const { t, locale } = useI18n();
  const tRef = useRef(t);
  tRef.current = t;
  // Langue audio préférée (Réglages → Plex) — distincte de la langue
  // d'interface, retombe dessus quand non définie ("auto").
  const { effective: preferredAudioLocale } = usePreferredAudioLanguage();
  const localeRef = useRef<string>(locale);
  localeRef.current = preferredAudioLocale;
  const beta = useBetaPlayer();
  const betaRef = useRef(beta);
  betaRef.current = beta;
  const playbackId = movvizId ?? ratingKey;
  const onNextEpisodeRef = useRef(onNextEpisode);
  onNextEpisodeRef.current = onNextEpisode;
  const inferredSeriesId = movvizId?.match(/^(.*):s\d+e\d+$/)?.[1] ?? null;
  // Episodes use the series identity plus season/episode coordinates.  Keep
  // this in one place so every local leg (direct playback and metadata probe)
  // resolves to the same endpoint; falling back to the movie route here used
  // to make Desktop episode playback report "not found" even though Android
  // and the library both knew the file was local.
  const episodeSeriesId = seriesId ?? inferredSeriesId;
  const localStreamPath = mediaType === "episode"
    ? episodeSeriesId && seasonNumber != null && episodeNumber != null
      ? `/api/stream/local/episode/${encodeURIComponent(episodeSeriesId)}/${encodeURIComponent(String(seasonNumber))}/${encodeURIComponent(String(episodeNumber))}`
      : null
    : movvizId
      ? `/api/stream/local/${encodeURIComponent(movvizId)}`
      : null;
  const localPlayback = Boolean(localStreamPath);
  // §44-46/49 (Plex is only a real fallback when it genuinely exists): for a
  // purely local title, TitleContent.tsx already falls back ratingKey to the
  // movviz id itself when there's no real plexRatingKey. Still gates
  // onLocalEngineFailure()'s decision below: falling back to the legacy
  // Plex/HLS leg is only ever attempted when a real Plex session actually
  // exists — otherwise it's a guaranteed, confusing failure (confirmed live).
  const hasRealPlexLink = ratingKey !== movvizId;

  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const dashRef = useRef<MediaPlayerClass | null>(null);
  const dashHeightRef = useRef<number | null>(null);
  const prebufferClearRef = useRef<(() => void) | null>(null);
  const fallbackGuardRef = useRef(false);
  const startHlsRef = useRef<((extraParams?: string, isCopyNetworkRetry?: boolean) => void) | null>(null);
  const stopSilentWatchRef = useRef<(() => void) | null>(null);
  // True only while startDirect()'s own watchForSilentAudio verdict is still
  // pending — gates the generic onPlaying/onCanPlay handlers below so the
  // "optimizing" cover isn't lifted by the throwaway direct-play attempt's
  // OWN playing event, before we actually know whether it'll be kept or
  // escalated away. Cleared by onConfirmedAudible (kept) or by abandoning
  // direct play (escalateSilentToFfmpeg / recoverFromDirect).
  const awaitingAudioConfirmationRef = useRef(false);
  // True only while ffmpegEngineRef holds the NEW engine-v2 (local, session-
  // based) instance rather than the legacy ffmpeg-remux one — both share the
  // same ref/ffmpegActive flag, but they speak completely different track-
  // reload protocols (see reloadLocalEngineTracks() vs reloadFfmpeg()).
  const isLocalEngineV2Ref = useRef(false);
  // The exact audio/subtitle track lists (ffprobe index — the real,
  // unambiguous identifier decidePlayback expects) from the LAST successful
  // /api/playback/prepare response for this engine-v2 session. Matched to
  // the classic audioStreams/subtitleStreams menus (a different, Plex-
  // derived numbering — see reloadLocalEngineTracks()) by ordinal position,
  // since both simply enumerate the same physical file's streams in order.
  const localEngineAudioTracksRef = useRef<{ index: number }[]>([]);
  const localEngineSubtitleTracksRef = useRef<{ index: number }[]>([]);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const playbackSessionRef = useRef<string | null>(null);
  const playbackSequenceRef = useRef(0);
  const infoRef = useRef<StreamInfo>({ videoCodec: null, audioCodec: null, container: null });
  const progressRef = useRef<HTMLDivElement>(null);
  const volumeTrackRef = useRef<HTMLDivElement>(null);
  const seekingRef = useRef(false);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const beginRef = useRef<((seekTo?: number) => Promise<void>) | null>(null);
  const startDirectRef = useRef<((seekTo?: number, expectAudio?: boolean) => void) | null>(null);
  const transcodeVideoRef = useRef(true);
  const transcodeAudioRef = useRef(true);
  // Loop-guard: once the HLS-leg's ta=0 (copy) attempt has been live-verified
  // silent and escalated to ta=1 once, never retry ta=0 again for this
  // playback session — prevents a silent-copy → escalate → silent-copy loop.
  const hlsCopyEscalatedRef = useRef(false);
  // A transient network error (e.g. a 503 on segment 0 during Plex's
  // transcode spin-up — confirmed to happen even on Plex's own client, see
  // the v1.13.40 investigation notes) is NOT evidence the copied audio track
  // doesn't work. One genuine do-over (fresh Hls instance, fresh Plex
  // session, still ta=0) is allowed before a repeat failure counts as real.
  const hlsCopyNetworkRetriedRef = useRef(false);
  const transcodeModeRef = useRef<"auto" | "audio" | "video" | "full">("auto");
  const codecCapsRef = useRef<CodecCapabilities | null>(null);
  const audioStreamIdRef = useRef<string | null>(null);
  const defaultAudioIdRef = useRef<string | null>(null);
  const mseEngineRef = useRef<MSEPlaybackEngine | null>(null);
  const mseSkippedRef = useRef(false);
  const ffmpegEngineRef = useRef<FfmpegRemuxEngine | null>(null);
  const ffmpegSkippedRef = useRef(false);
  const tryStartFfmpegRemuxRef = useRef<((info: StreamInfo, seekTo?: number) => Promise<boolean>) | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [buffering, setBuffering] = useState(false);
  // Explicit user request (2026-08-24): the direct→silent-detection→escalate
  // dance (startDirect's 800ms watchForSilentAudio) is real and needed (the
  // "old baseline method" this whole engine has to match), but it used to
  // play out IN FRONT of the user — a real frame (with wrong/missing audio)
  // visibly renders during the small transparent buffering spinner, then
  // visibly jumps when escalation swaps the source. `optimizing` is a
  // SEPARATE, fully opaque cover, tied to real engine-readiness signals
  // (the video element's own "playing"/"canplay" events — see onPlaying/
  // onCanPlay below) rather than a fixed timer, so it always tracks
  // whichever leg actually ends up live: cleared the moment real audio is
  // confirmed on a kept direct attempt (onConfirmedAudible), or the moment
  // an escalated/transcoded engine genuinely starts producing frames.
  const [optimizing, setOptimizing] = useState(true);
  const [mseActive, setMseActive] = useState(false);
  const [mseStats, setMseStats] = useState<MseDebugStats | null>(null);
  const [ffmpegActive, setFfmpegActive] = useState(false);
  const ffmpegActiveRef = useRef(false);
  ffmpegActiveRef.current = ffmpegActive;
  const [ffmpegStats, setFfmpegStats] = useState<FfmpegDebugStats | null>(null);
  const [audioStreams, setAudioStreams] = useState<StreamTrack[]>([]);
  const [subtitleStreams, setSubtitleStreams] = useState<StreamTrack[]>([]);
  const [currentAudio, setCurrentAudio] = useState<string | null>(null);
  const [currentSubtitle, setCurrentSubtitle] = useState<string | null>(null);
  // Leg ffmpeg : cues WebVTT (temps absolus du fichier) + TextTrack natif
  // actif. La position du <video> repart de 0 à chaque seek/reload, donc le
  // track est (re)construit à chaque changement de seekBase avec des cues
  // décalés (start - base).
  const subtitleCuesRef = useRef<SubtitleCue[]>([]);
  const subtitleTrackRef = useRef<{ track: TextTrack; base: number } | null>(null);
  // Annulation du streaming WebVTT en cours (changement de piste, off,
  // unmount) — sans ça un abort serait pris pour une erreur d'extraction
  // et déclencherait un repli HLS non voulu.
  const subtitleAbortRef = useRef<AbortController | null>(null);
  const [currentLevel, setCurrentLevel] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState<null | "audio" | "subtitle" | "speed" | "quality" | "playback">(null);
  const [directMode, setDirectMode] = useState(false);
  const qualityMaxWidthRef = useRef<number | null>(null);
  // Profil de compression ffmpeg local (leg ffmpeg uniquement — la leg HLS
  // garde maxWidth, la leg directe est toujours bit-exacte). "original" =
  // copie vidéo bit-exacte, comportement actuel inchangé.
  const qualityRef = useRef<FfmpegQuality>("original");

  const [playing, setPlaying] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [bufferedPct, setBufferedPct] = useState(0);
  const [showVolume, setShowVolume] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [seekPreview, setSeekPreview] = useState<number | null>(null);
  // Toast de feedback des skips ±10s — key={n} remonte l'animation à chaque
  // skip (une animation déjà terminée ne repart pas sans remontage).
  const [skipToast, setSkipToast] = useState<{ n: number; delta: number } | null>(null);
  const [pipSupported, setPipSupported] = useState(false);
  const [showResume, setShowResume] = useState(false);
  const [markers, setMarkers] = useState<NonNullable<StreamInfo["markers"]>>([]);
  const [activeMarker, setActiveMarker] = useState<NonNullable<StreamInfo["markers"]>[number] | null>(null);
  const [savedPos, setSavedPos] = useState(0);
  const [cacheProgress, setCacheProgress] = useState<{ current: number; target: number } | null>(null);
  // Hard cap: no caller can reintroduce a multi-minute loading wall by
  // passing a huge prebuffer (the old streamCacheTtl wiring did exactly that
  // — see PREBUFFER_SECONDS).
  const prebufferRef = useRef(Math.min(prebufferSeconds ?? 0, PREBUFFER_SECONDS));
  prebufferRef.current = Math.min(prebufferSeconds ?? 0, PREBUFFER_SECONDS);

  // HLS (Plex transcode) is never the preferred start path: Auto tries
  // direct/MSE/FFmpeg first. It *is* the mandatory final fallback when those
  // legs genuinely fail, otherwise a temporary FFmpeg issue degenerates into
  // the misleading “HLS disabled” message instead of preserving playback.
  // `allowFailureFallback` is deliberately explicit so merely opening Auto
  // cannot silently start a Plex transcode.
  const maybeStartHls = (subtitleId?: string | null, allowFailureFallback = false) => {
    const b = betaRef.current;
    if (allowFailureFallback || hlsRef.current || dashRef.current || b.playbackEngine === "hls" || b.playbackEngine === "native") {
      startHlsRef.current?.(subtitleId ? `subtitleStreamID=${subtitleId}` : undefined);
      return;
    }
    setError(tRef.current("player.betaHlsDisabled"));
  };

  useEffect(() => {
    setPipSupported(
      typeof document !== "undefined" &&
      "pictureInPictureEnabled" in document &&
      document.pictureInPictureEnabled
    );
  }, []);

  const reloadHls = (audioId: string | null, subtitleId: string | null) => {
    const mode = transcodeModeRef.current;
    const tv = mode === "auto" ? (transcodeVideoRef.current ? "1" : "0") : mode === "video" || mode === "full" ? "1" : "0";
    let ta: string;
    if (mode === "auto") {
      // Re-evaluate the target track's codec — E-AC3/DTS/TrueHD tracks must
      // transcode audio (hls.js can't transmux them from TS), never copy
      const track = audioStreams.find((s) => s.id === audioId);
      const trackCodec = track?.codec ?? infoRef.current?.audioCodec;
      const forceAudioTranscode = trackCodec
        ? (codecCapsRef.current ? shouldForceAudioTranscode(trackCodec, codecCapsRef.current) : !isAudioMseTransmuxable(trackCodec))
        : false;
      if (forceAudioTranscode) {
        ta = "1";
      } else {
        ta = transcodeAudioRef.current ? "1" : "0";
      }
    } else {
      ta = mode === "audio" || mode === "full" ? "1" : "0";
    }
    // Keep refs in sync — the badge and handleReturnToHls read them
    setCurrentAudio(audioId);
    setCurrentSubtitle(subtitleId);
    audioStreamIdRef.current = audioId;
    if (mode === "auto") transcodeAudioRef.current = ta === "1";
    // DASH gate: same rule as the leg dispatcher — any transcode session or
    // HEVC/AV1 source plays via DASH (the only path where MDE honors the
    // video copy). Fresh engine + fresh Plex session (in-place dash.js reload
    // across leg-param changes is brittle). The dispatcher inside startHls
    // handles the dash.js availability check and the HLS fallback.
    const srcVideo = (infoRef.current?.videoCodec ?? "").toLowerCase();
    const needDash = tv === "1" || ta === "1" || /hevc|h265|hev1|hvc1|av1|av01|vp9/.test(srcVideo);
    if (needDash) {
      fallbackGuardRef.current = false;
      maybeStartHls(undefined, true);
      return;
    }
    const hls = hlsRef.current;
    if (!hls) return;
    let url = `/api/stream/${ratingKey}/transcode`;
    const params = new URLSearchParams();
    params.set("tv", tv);
    params.set("ta", ta);
    if (qualityMaxWidthRef.current) params.set("maxWidth", String(qualityMaxWidthRef.current));
    if (audioId) params.set("audioStreamID", audioId);
    if (subtitleId) params.set("subtitleStreamID", subtitleId);
    const qs = params.toString();
    if (qs) url += `?${qs}`;
    hls.loadSource(url);
  };

  /**
   * Recharge le moteur ffmpeg local avec une autre piste audio ET/OU un autre
   * profil de compression (changement de langue ou de qualité sans quitter
   * la leg ffmpeg), position conservée via seekTo. Le DELETE explicite AVANT
   * le load suit la même règle que FfmpegRemuxEngine.seek() : tuer la
   * session serveur d'abord, sinon un DELETE fire-and-forget arriverait
   * après le nouveau GET et stopAllForRatingKey tuerait la session
   * fraîchement créée (le serveur répondrait même 409 duplicate si la clé
   * était identique).
   */
  const reloadFfmpeg = async (audioId: string | null, quality: FfmpegQuality) => {
    setCurrentAudio(audioId);
    audioStreamIdRef.current = audioId;
    setMenuOpen(null);
    const engine = ffmpegEngineRef.current;
    if (!engine) {
      // Pas de moteur actif (état incohérent) — retombe sur la leg HLS.
      maybeStartHls(undefined, true);
      return;
    }
    // Leg ffmpeg : el.currentTime est relatif au flux (qui part de seekBase)
    // — la position réelle du film est seekBase + el.currentTime, sinon le
    // reload audio repartirait du début relatif (0) au lieu de la position.
    const pos = (videoRef.current?.currentTime ?? 0) + engine.seekBase;
    try {
      setBuffering(true);
      await fetch(`/api/playback-ffmpeg/${ratingKey}`, { method: "DELETE", keepalive: true }).catch(() => void 0);
      await engine.load(ratingKey, {
        audioStreamId: audioId ? Number(audioId) : null,
        seekTo: pos,
        quality,
        debug: betaRef.current.debug,
      });
    } catch {
      // Filet de sécurité — le moteur déclenche déjà onError → fallback HLS
      // pour tout échec de lecture (piste invalide, 502, 429...).
      maybeStartHls(undefined, true);
    }
  };

  const reloadFfmpegAudio = (audioId: string) => void reloadFfmpeg(audioId, qualityRef.current);

  /**
   * Audio/subtitle switch for the NEW engine-v2 (local, session-based)
   * leg — completely separate protocol from reloadFfmpeg() above (which is
   * the LEGACY leg's own reload, hard-coded to ratingKey + audioStreamID).
   * engine-v2 has no live "swap track on the current session" call: the
   * track selection is baked into the session at /api/playback/prepare
   * time, so switching means asking prepare for a brand new session with
   * the desired selection, then pointing the SAME engine instance at it
   * (mirrors tryStartLocalEngine's own initial call one-for-one).
   *
   * The classic audioStreams/subtitleStreams menus carry Plex-derived ids
   * (see getLocalStreamInfo) — a DIFFERENT numbering from the ffprobe
   * `index` decidePlayback/prepare actually expects (localEngineAudioTracksRef
   * /localEngineSubtitleTracksRef, captured from prepare's own `tracks`
   * response). Both lists simply enumerate the same physical file's streams
   * in order, so the clicked menu entry's ordinal POSITION — not its id —
   * is what reliably carries over between the two numbering schemes, even
   * on a file with mislabeled language tags (confirmed live: "8 Mile" 's
   * first "Français" entry is actually English audio — position-matching
   * is unaffected by that kind of label bug, an id/language match would not be).
   */
  const reloadLocalEngineTracks = async (nextAudioId: string | null, nextSubtitleId: string | null) => {
    const engine = ffmpegEngineRef.current;
    if (!engine || !movvizId) {
      maybeStartHls(undefined, true);
      return;
    }
    setMenuOpen(null);
    const toIndex = (id: string | null, streams: StreamTrack[], tracks: { index: number }[]): number | undefined => {
      if (id === null) return undefined;
      const position = streams.findIndex((s) => s.id === id);
      return position >= 0 ? tracks[position]?.index : undefined;
    };
    const audioTrack = toIndex(nextAudioId, audioStreams, localEngineAudioTracksRef.current);
    const subtitleTrack = nextSubtitleId === null ? null : toIndex(nextSubtitleId, subtitleStreams, localEngineSubtitleTracksRef.current);
    if (nextAudioId !== null && audioTrack === undefined) {
      // Couldn't resolve the requested track to a real ffprobe index —
      // an inconsistent-state case (see reloadFfmpeg's own comment), not
      // a genuine engine failure worth crashing the whole leg over.
      maybeStartHls(undefined, true);
      return;
    }
    setCurrentAudio(nextAudioId);
    audioStreamIdRef.current = nextAudioId;
    if (nextSubtitleId !== undefined) setCurrentSubtitle(nextSubtitleId);
    const pos = (videoRef.current?.currentTime ?? 0) + engine.seekBase;
    try {
      setBuffering(true);
      const clientProfile = await detectDesktopClientProfile(getOrCreateDeviceId(), "1.0");
      const prepRes = await fetch("/api/playback/prepare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mediaId: movvizId, clientProfile, audioTrack, subtitleTrack }),
      });
      if (!prepRes.ok) throw new Error("prepare_failed");
      const prep = (await prepRes.json()) as { sessionId: string; tracks?: { audio?: { index: number }[]; subtitle?: { index: number }[] } };
      localEngineAudioTracksRef.current = prep.tracks?.audio ?? localEngineAudioTracksRef.current;
      localEngineSubtitleTracksRef.current = prep.tracks?.subtitle ?? localEngineSubtitleTracksRef.current;
      await engine.load(prep.sessionId, { seekTo: pos, debug: betaRef.current.debug });
    } catch {
      // Same safety net as reloadFfmpeg — the engine already fires onError
      // → fallback for a genuine playback failure; this only covers the
      // prepare call itself failing (network, invalid state...).
      maybeStartHls(undefined, true);
    }
  };

  /**
   * Bascule ffmpeg → HLS (Plex) quand un sous-titre est demandé : le remux
   * local ne grave aucun sous-titre (orchestrator refuse ffmpeg dès que
   * subtitleActive). Détruit le moteur, puis démarre la leg HLS avec
   * subtitleStreamID en extraParams — startHls/runHlsLeg n'injectent
   * audioStreamID/maxWidth que depuis les refs, pas de ref sous-titre.
   */
  const switchFfmpegToHls = (subtitleId: string | null) => {
    setCurrentSubtitle(subtitleId);
    clearFfmpegSubtitle();
    if (ffmpegEngineRef.current) {
      const engine = ffmpegEngineRef.current;
      ffmpegEngineRef.current = null;
      void engine.destroy().catch(() => void 0);
    }
    ffmpegSkippedRef.current = true;
    setFfmpegActive(false);
    setFfmpegStats(null);
    fallbackGuardRef.current = false;
    setUsingFallback(false);
    setDirectMode(false);
    setBuffering(true);
    maybeStartHls(subtitleId, true);
  };

  // --- Sous-titres leg ffmpeg (100% local, sans Plex) ---
  // La piste est extraite en WebVTT par ffmpeg (temps absolus du fichier).
  // Le <video> ffmpeg repartant de 0 à chaque seek/reload, les cues sont
  // appliqués avec un décalage `start - base` où base = seekBase du moteur.

  const applyFfmpegSubtitleOffset = useCallback((base: number) => {
    const el = videoRef.current;
    if (subtitleTrackRef.current) {
      subtitleTrackRef.current.track.mode = "disabled";
      subtitleTrackRef.current = null;
    }
    if (!el || subtitleCuesRef.current.length === 0) return;
    const CueCtor = getCueCtor();
    if (!CueCtor) return;
    try {
      const track = el.addTextTrack("subtitles", "Sous-titres");
      for (const cue of subtitleCuesRef.current) {
        if (cue.end <= base) continue;
        const start = Math.max(0, cue.start - base);
        try {
          track.addCue(new CueCtor(start, Math.max(start + 0.05, cue.end - base), cue.text));
        } catch { /* cue invalide — ignoré */ }
      }
      track.mode = "showing";
      subtitleTrackRef.current = { track, base };
    } catch { /* addTextTrack peut échouer — sous-titres ignorés */ }
  }, []);

  const clearFfmpegSubtitle = useCallback(() => {
    subtitleAbortRef.current?.abort();
    subtitleAbortRef.current = null;
    subtitleCuesRef.current = [];
    if (subtitleTrackRef.current) {
      subtitleTrackRef.current.track.mode = "disabled";
      subtitleTrackRef.current = null;
    }
  }, []);

  const loadFfmpegSubtitle = useCallback(async (subtitleId: string) => {
    setCurrentSubtitle(subtitleId);
    setMenuOpen(null);
    const engine = ffmpegEngineRef.current;
    if (!engine) return;
    // Annule une extraction précédente encore en vol (changement de piste).
    // ATTENTION : ce reset ne doit PAS toucher le nouveau controller créé
    // juste après — clearFfmpegSubtitle() abortait le fetch fraîchement
    // lancé (silencieux : catch sur ac.signal.aborted), donc les
    // sous-titres ne chargeaient JAMAIS en mode ffmpeg. Confirmé en direct.
    subtitleAbortRef.current?.abort();
    subtitleAbortRef.current = null;
    subtitleCuesRef.current = [];
    if (subtitleTrackRef.current) {
      subtitleTrackRef.current.track.mode = "disabled";
      subtitleTrackRef.current = null;
    }
    const ac = new AbortController();
    subtitleAbortRef.current = ac;
    // Track neuf construit IMMÉDIATEMENT (la piste change toujours ici —
    // purge des cues de l'ancienne piste). Le stream WebVTT est le fichier
    // live écrit par le remux en sortie secondaire : les cues s'ajoutent au
    // fil de l'arrivée des paquets (quelques secondes, pas 1 minute) et le
    // tail bascule seul de session en session au seek/changement de qualité.
    const CueCtor = getCueCtor();
    const el = videoRef.current;
    if (el && CueCtor) {
      try {
        const track = el.addTextTrack("subtitles", "Sous-titres");
        track.mode = "showing";
        subtitleTrackRef.current = { track, base: engine.seekBase };
      } catch { /* addTextTrack peut échouer — sous-titres ignorés */ }
    }
    try {
      const res = await fetch(
        `/api/playback-ffmpeg/${ratingKey}/subtitle?subtitleStreamID=${encodeURIComponent(subtitleId)}`,
        { cache: "no-store", signal: ac.signal }
      );
      if (!res.ok) throw new Error(`subtitle ${res.status}`);
      const reader = res.body?.getReader();
      if (!reader) throw new Error("no body");
      const decoder = new TextDecoder();
      // Parse incrémental : ffmpeg streame le VTT au fil de sa lecture du
      // fichier — les cues arrivent par paquets, on les ajoute au track au
      // fur et à mesure (temps absolus décalés de la base courante).
      let pending: { start: number; end: number; lines: string[] } | null = null;
      const addCue = (start: number, end: number, text: string) => {
        subtitleCuesRef.current.push({ start, end, text });
        const ts = subtitleTrackRef.current;
        if (!ts || !CueCtor) return;
        if (end <= ts.base) return;
        const cueStart = Math.max(0, start - ts.base);
        try {
          ts.track.addCue(new CueCtor(cueStart, Math.max(cueStart + 0.05, end - ts.base), text));
        } catch { /* cue invalide — ignoré */ }
      };
      const flushCue = () => {
        if (pending && pending.lines.length > 0) {
          addCue(pending.start, pending.end, pending.lines.join("\n"));
        }
        pending = null;
      };
      const onLine = (line: string) => {
        const trimmed = line.trim();
        if (!trimmed) { flushCue(); return; }
        const m = CUE_TIME_RE.exec(trimmed);
        if (m) {
          flushCue();
          pending = {
            start: toCueSeconds(m[1] ? +m[1] : 0, +m[2], +m[3], +m[4]),
            end: toCueSeconds(m[5] ? +m[5] : 0, +m[6], +m[7], +m[8]),
            lines: [],
          };
          return;
        }
        if (pending) pending.lines.push(line);
      };
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) onLine(line);
      }
      flushCue();
      if (ffmpegEngineRef.current && engine === ffmpegEngineRef.current && !subtitleTrackRef.current && subtitleCuesRef.current.length > 0) {
        // Track jamais construit (stream terminé avant un timeupdate) — pose
        // le track sur la base courante.
        applyFfmpegSubtitleOffset(ffmpegEngineRef.current.seekBase);
      }
    } catch {
      // Annulation volontaire (changement de piste / off / unmount) — pas
      // une erreur d'extraction, aucun repli HLS.
      if (ac.signal.aborted) return;
      // Extraction impossible (piste image, erreur serveur...) — repli HLS.
      if (ffmpegEngineRef.current && engine === ffmpegEngineRef.current) {
        switchFfmpegToHls(subtitleId);
      }
    }
  }, [ratingKey, applyFfmpegSubtitleOffset, clearFfmpegSubtitle]);

  // Handlers des menus audio/sous-titres — 3 protocoles distincts selon la
  // leg active : engine-v2 (reloadLocalEngineTracks, nouvelle session via
  // /api/playback/prepare), ffmpeg legacy (reload sur la même session
  // ratingKey), HLS (reloadHls, chemin existant inchangé).
  const handleAudioSelect = (id: string) => {
    if (isLocalEngineV2Ref.current) {
      void reloadLocalEngineTracks(id, currentSubtitle);
    } else if (ffmpegActive) {
      void reloadFfmpegAudio(id);
    } else {
      reloadHls(id, currentSubtitle);
      setMenuOpen(null);
    }
  };

  const handleSubtitleSelect = (id: string) => {
    setMenuOpen(null);
    if (isLocalEngineV2Ref.current) {
      void reloadLocalEngineTracks(currentAudio, id);
    } else if (ffmpegActive) {
      // Leg ffmpeg : piste TEXTE → extraite en WebVTT localement (aucun
      // Plex) et rendue via <track> natif décalé par seekBase. Piste IMAGE
      // (pgs/vobsub, non convertible en texte) → repli HLS comme avant.
      const track = subtitleStreams.find((s) => s.id === id);
      const toText = track?.toTextConvertible ?? ["srt", "subrip", "ass", "ssa", "webvtt", "vtt", "mov_text", "text", "ttml", "subtext"].includes((track?.codec ?? "").toLowerCase());
      if (toText) {
        void loadFfmpegSubtitle(id);
      } else {
        switchFfmpegToHls(id);
      }
    } else {
      reloadHls(currentAudio, id);
    }
  };

  const handleSubtitleOff = () => {
    setMenuOpen(null);
    if (isLocalEngineV2Ref.current) {
      void reloadLocalEngineTracks(currentAudio, null);
    } else if (ffmpegActive) {
      // Leg ffmpeg : on retire le track local, on reste sur le moteur.
      clearFfmpegSubtitle();
      setCurrentSubtitle(null);
    } else {
      reloadHls(currentAudio, null);
    }
  };

  useEffect(() => {
    if (!videoRef.current) return;

    const hlsUrl = `/api/stream/${ratingKey}/transcode`;
    const directUrl = localStreamPath ?? `/api/stream/${ratingKey}`;

    // --- Prébuffer partagé (legs HLS + DASH) ---
    const armPrebuffer = () => {
      prebufferClearRef.current?.();
      const elv = videoRef.current;
      if (!elv) return;
      const prebufSecs = prebufferRef.current;
      if (prebufSecs <= 0 || !elv.duration || elv.duration <= prebufSecs) {
        setBuffering(false);
        void elv.play().catch(() => void 0);
        return;
      }
      setBuffering(true);
      setCacheProgress({ current: 0, target: prebufSecs });
      const iv = setInterval(() => {
        if (elv.buffered.length > 0) {
          const bufferedSecs = elv.buffered.end(0) - elv.currentTime;
          const clamped = Math.min(bufferedSecs, prebufSecs);
          setCacheProgress({ current: clamped, target: prebufSecs });
          if (bufferedSecs >= prebufSecs || bufferedSecs >= elv.duration - elv.currentTime) {
            clearInterval(iv);
            setCacheProgress(null);
            setBuffering(false);
            void elv.play().catch(() => void 0);
          }
        }
      }, 300);
      prebufferClearRef.current = () => clearInterval(iv);
    };

    // Shared by every copy leg (HLS, DASH, direct, MSE, ffmpeg remux): only
    // forces a real ta=1 transcode — never touched by a transient network
    // hiccup, only by a genuine live-silence verdict or by a second,
    // independent copy attempt also failing at the network level (see the
    // NETWORK_ERROR branch in the HLS leg). from="mse"/"ffmpeg" additionally
    // tears that engine down first — both are "copy to browser" attempts
    // like the others, and a silence verdict there means the codec can't be
    // rendered at all, so the whole copy family is done and a real
    // transcode is the only way left.
    const escalateSilentToTranscode = (from: "mse" | "ffmpeg" | false) => {
      if (hlsCopyEscalatedRef.current) return;
      hlsCopyEscalatedRef.current = true;
      transcodeAudioRef.current = true;
      if (from === "mse") {
        try { mseEngineRef.current?.destroy(); } catch { /* ignore */ }
        mseEngineRef.current = null;
        mseSkippedRef.current = true;
        setMseActive(false);
        setMseStats(null);
      }
      if (from === "ffmpeg") {
        try { void ffmpegEngineRef.current?.destroy(); } catch { /* ignore */ }
        ffmpegEngineRef.current = null;
        ffmpegSkippedRef.current = true;
        setFfmpegActive(false);
        setFfmpegStats(null);
      }
      fallbackGuardRef.current = false;
      maybeStartHls(undefined, true);
    };

    // Escalade de la leg directe uniquement : le verdict de silence (fenêtre
    // sub-seconde) signifie que le navigateur ne peut pas rendre la piste
    // audio courante. Contrairement à escalateSilentToTranscode (qui saute
    // droit vers HLS), on tente d'abord le remux ffmpeg local — transcode du
    // son vers AAC, vidéo copiée — et HLS seulement si ffmpeg est
    // indisponible ou inapplicable.
    const escalateSilentToFfmpeg = () => {
      if (hlsCopyEscalatedRef.current) return;
      hlsCopyEscalatedRef.current = true;
      transcodeAudioRef.current = true;
      awaitingAudioConfirmationRef.current = false;
      setOptimizing(true);
      stopSilentWatchRef.current?.();
      stopSilentWatchRef.current = null;
      if (mseEngineRef.current) {
        try { mseEngineRef.current.destroy(); } catch { /* ignore */ }
        mseEngineRef.current = null;
        mseSkippedRef.current = true;
        setMseActive(false);
        setMseStats(null);
      }
      if (ffmpegEngineRef.current) {
        try { void ffmpegEngineRef.current.destroy(); } catch { /* ignore */ }
        ffmpegEngineRef.current = null;
        ffmpegSkippedRef.current = true;
        setFfmpegActive(false);
        setFfmpegStats(null);
      }
      fallbackGuardRef.current = false;
      setDirectMode(false);
      setUsingFallback(false);
      setBuffering(true);
      // Remux ffmpeg d'abord (transcode du son), HLS en dernier recours —
      // sauf moteur engine-v2 (ou "auto" sur du contenu local, voir
      // tryStartLocalEngine), qui remplace entièrement cette leg.
      void (async () => {
        const b = betaRef.current;
        if (b.playbackEngine === "engine-v2" || (b.playbackEngine === "auto" && localPlayback)) {
          if (!(await tryStartLocalEngine())) maybeStartHls(undefined, true);
          return;
        }
        if (!(await tryStartFfmpegRemux(infoRef.current))) maybeStartHls(undefined, true);
      })();
    };

    // --- Leg DASH (dash.js) ---
    // Plex Web lit exclusivement en DASH, et c'est le SEUL protocole où MDE
    // honore videoCodec=copy pour les sources HEVC dans une session transcode
    // (prouvé en live : HLS ré-encode chaque fichier HEVC en libx264 — John
    // Carter, Tomb Raider — alors que Plex Web copie le bitstream HEVC en
    // DASH, 6× temps réel). Toute leg qui transcode la vidéo ou l'audio, ou
    // dont la vidéo source est HEVC/AV1, passe par DASH.
    // dash.js est chargé dynamiquement : pas SSR-safe (window au niveau
    // module), ce qui poussait son évaluation dans le graphe des pages
    // statiques pendant le prerender (ReferenceError: window is not defined).
    let dashPromise: Promise<typeof import("dashjs")> | null = null;
    const ensureDashjs = () => (dashPromise ??= import("dashjs"));
    const startDash = (djs: typeof import("dashjs"), tv: string, ta: string, extraParams?: string, isCopyNetworkRetry?: boolean) => {
      const elv = videoRef.current;
      if (!elv) return;
      prebufferClearRef.current?.();
      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch { /* ignore */ }
        hlsRef.current = null;
      }
      if (dashRef.current) {
        try { dashRef.current.reset(); } catch { /* ignore */ }
        dashRef.current = null;
      }

      let url = `${hlsUrl}?tv=${tv}&ta=${ta}&fmt=dash`;
      if (audioStreamIdRef.current) url += `&audioStreamID=${audioStreamIdRef.current}`;
      if (qualityMaxWidthRef.current) url += `&maxWidth=${qualityMaxWidthRef.current}`;
      if (extraParams) url += `&${extraParams}`;

      const mode = transcodeModeRef.current;
      // Les legs DASH en copie audio (AC3/AAC/EAC3 en fMP4) reçoivent la même
      // veille de silence que les legs HLS : un codec que le navigateur ne
      // peut pas décoder joue en silence et doit escalader en vrai transcode.
      const attemptingDashAudioCopy = mode === "auto" && ta === "0" && !hlsCopyEscalatedRef.current;
      if (attemptingDashAudioCopy && !isCopyNetworkRetry) {
        stopSilentWatchRef.current?.();
        stopSilentWatchRef.current = watchForSilentAudio(elv, () => escalateSilentToTranscode(false));
      }

      const player = djs.MediaPlayer().create();
      dashRef.current = player;
      player.updateSettings({
        streaming: {
          buffer: { fastSwitchEnabled: true, bufferToKeep: 30 },
          // Le cold-start Plex peut 404/503 les premiers segments — retries
          // internes généreux, miroir du backoff de la leg HLS.
          retryAttempts: {
            MPD: 6,
            MediaSegment: 8,
            InitializationSegment: 8,
            FragmentInfoSegment: 8,
            other: 8,
          },
          retryIntervals: { MPD: 1200, MediaSegment: 800, InitializationSegment: 800, other: 800 },
        },
      });
      player.initialize(elv, url, false);

      player.on(djs.MediaPlayer.events.MANIFEST_LOADED, () => {
        armPrebuffer();
      });
      player.on(djs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, () => {
        // dash.js v5 n'expose plus la liste des bitrates — la hauteur
        // réellement décodée (videoHeight intrinsèque) est plus vraie de toute
        // façon : c'est ce que le badge qualité doit afficher.
        if (elv.videoHeight) dashHeightRef.current = elv.videoHeight;
      });
      player.on(djs.MediaPlayer.events.PLAYBACK_STARTED, () => {
        if (elv.videoHeight) dashHeightRef.current = elv.videoHeight;
      });
      player.on(djs.MediaPlayer.events.ERROR, (e: { error?: { code?: number } }) => {
        const code = (e as { error?: { code?: number } })?.error?.code ?? 0;
        console.error("[VideoPlayer] DASH error", code, e);
        // Les échecs réseau sont ré-essayés en interne (retryAttempts
        // ci-dessus) ; si ERROR se déclenche quand même, une leg copie a
        // droit à une escalade, tout le reste est une erreur fatale.
        if (attemptingDashAudioCopy && !hlsCopyEscalatedRef.current) {
          escalateSilentToTranscode(false);
          return;
        }
        if (code !== 0) {
          setError(tRef.current("player.betaError"));
          try { player.reset(); } catch { /* ignore */ }
          if (dashRef.current === player) dashRef.current = null;
        }
      });
    };

    const startHls = (extraParams?: string, isCopyNetworkRetry?: boolean) => {
      startHlsRef.current = startHls;
      const el = videoRef.current;
      if (!el) {
        // Element not mounted yet — schedule retry
        requestAnimationFrame(() => startHls(extraParams, isCopyNetworkRetry));
        return;
      }
      if (fallbackGuardRef.current) return;
      fallbackGuardRef.current = true;
      setUsingFallback(true);
      setDirectMode(false);

      const mode = transcodeModeRef.current;
      const tv = mode === "auto" ? (transcodeVideoRef.current ? "1" : "0") : mode === "video" || mode === "full" ? "1" : "0";
      const ta = mode === "auto" ? (transcodeAudioRef.current ? "1" : "0") : mode === "audio" || mode === "full" ? "1" : "0";
      const srcVideo = (infoRef.current?.videoCodec ?? "").toLowerCase();
      // DASH gate : les sessions transcode (tv=1/ta=1) et les sources
      // HEVC/AV1 jouent en DASH — HLS ne honore jamais le copy HEVC sur ce
      // serveur (prouvé via /decision + Job running : toute source HEVC est
      // ré-encodé en libx264 en HLS, Plex Web copie le bitstream en DASH).
      // dash.js se charge en diffé ré ; s'il est indisponible (vieux Safari
      // sans MSE), on retombe sur la leg HLS (hls.js utilise alors le HLS
      // natif du navigateur).
      const wantDash = tv === "1" || ta === "1" || /hevc|h265|hev1|hvc1|av1|av01|vp9/.test(srcVideo);
      if (wantDash && typeof window !== "undefined") {
        void ensureDashjs().then((djs) => {
          if (djs.supportsMediaSource()) {
            startDash(djs, tv, ta, extraParams, isCopyNetworkRetry);
            return;
          }
          runHlsLeg(tv, ta, extraParams, isCopyNetworkRetry);
        });
        return;
      }
      runHlsLeg(tv, ta, extraParams, isCopyNetworkRetry);
    };
    // The manual playback-mode picker must be able to enter Plex/HLS even
    // when the automatic path started in direct mode and has never called
    // startHls before.
    startHlsRef.current = startHls;

    const runHlsLeg = (tv: string, ta: string, extraParams?: string, isCopyNetworkRetry?: boolean) => {
      const mode = transcodeModeRef.current;
      let url = `${hlsUrl}?tv=${tv}&ta=${ta}`;
      if (audioStreamIdRef.current) url += `&audioStreamID=${audioStreamIdRef.current}`;
      if (qualityMaxWidthRef.current) url += `&maxWidth=${qualityMaxWidthRef.current}`;
      if (extraParams) url += `&${extraParams}`;
      // Tear down any previous instance before creating a new one
      if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch { /* ignore */ }
        hlsRef.current = null;
      }

      // ta=0 here means Plex is asked to remux (repackage the container,
      // e.g. MKV → MPEG-TS) without touching the audio bitstream — the same
      // "copy" Plex's own client gets, cheap for the NAS. Whether hls.js/the
      // browser actually renders it is unknown until real audio is playing,
      // so watch decoded energy exactly like the direct-play leg and
      // escalate to a real ta=1 transcode only on a genuine, live silence —
      // never a second guess baked into the request itself.
      const attemptingHlsAudioCopy = mode === "auto" && ta === "0" && !hlsCopyEscalatedRef.current;
      // A network-error retry (isCopyNetworkRetry) reuses the SAME live-audio
      // watch already running from the original attempt instead of installing
      // a second one on the same <video> element — Web Audio only allows one
      // MediaElementAudioSourceNode capture per element for its whole
      // lifetime (see silentAudioDetector.ts), so a second install here would
      // silently no-op anyway. Letting the original watch keep ticking means
      // the retry still gets genuinely live-verified, just on whatever time
      // remains of the original 6s window rather than a fresh one.
      if (attemptingHlsAudioCopy && !isCopyNetworkRetry) {
        stopSilentWatchRef.current?.();
        stopSilentWatchRef.current = watchForSilentAudio(el, () => escalateSilentToTranscode(false));
      }

      if (Hls.isSupported()) {
        let networkRetries = 0;
        const hls = new Hls({
          capLevelToPlayerSize: true,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          enableWorker: true,
          lowLatencyMode: false,
          backBufferLength: 30,
          // Plex segments can take a moment on first request (transcode spin-up)
          fragLoadingTimeOut: 30000,
          manifestLoadingTimeOut: 20000,
          levelLoadingTimeOut: 20000,
          xhrSetup: (xhr) => {
            // Same-origin cookies for /api/stream auth
            xhr.withCredentials = true;
          },
        });
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(el);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          networkRetries = 0;
          armPrebuffer();
        });
        hls.on(Hls.Events.DESTROYING, () => {
          prebufferClearRef.current?.();
          prebufferClearRef.current = null;
        });

        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (!data.fatal) return;
          console.error("[VideoPlayer] HLS fatal", data.type, data.details, data.response);
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR: {
              networkRetries += 1;
              if (networkRetries > 5) {
                // hls.js's own in-place retry budget (startLoad() below) is
                // exhausted — but for a ta=0 copy attempt that's still just
                // "the network had a bad few seconds" (confirmed: transient
                // 503s on segment 0 happen even on Plex's own client's
                // sessions), not "this audio track doesn't work". Give the
                // exact same request ONE genuine do-over — a brand new Hls
                // instance and a brand new Plex transcode session — before
                // treating a repeat failure as real signal. Only a SECOND
                // independent failure, or a live-silence verdict from the
                // still-running watch, escalates to a real ta=1 transcode.
                if (attemptingHlsAudioCopy && !hlsCopyNetworkRetriedRef.current) {
                  hlsCopyNetworkRetriedRef.current = true;
                  hls.destroy();
                  hlsRef.current = null;
                  fallbackGuardRef.current = false;
                  startHls(extraParams, true);
                  break;
                }
                if (attemptingHlsAudioCopy && !hlsCopyEscalatedRef.current) {
                  escalateSilentToTranscode(false);
                  break;
                }
                setError(tRef.current("player.betaError"));
                hls.destroy();
                hlsRef.current = null;
                break;
              }
              // Brief backoff then retry — covers Plex cold-start 503s
              setTimeout(() => {
                try { hls.startLoad(); } catch { /* destroyed */ }
              }, 400 * networkRetries);
              break;
            }
            case Hls.ErrorTypes.MEDIA_ERROR:
              try { hls.recoverMediaError(); } catch {
                setError(tRef.current("player.betaError"));
                hls.destroy();
                hlsRef.current = null;
              }
              break;
            default:
              setError(tRef.current("player.betaError"));
              hls.destroy();
              hlsRef.current = null;
              break;
          }
        });

        hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => setCurrentLevel(data.level));
      } else if (el.canPlayType("application/vnd.apple.mpegurl")) {
        el.src = url;
        void el.play().catch(() => void 0);
      } else {
        setError(tRef.current("player.betaError"));
      }
    };

    const startDirect = (seekTo?: number, expectAudio?: boolean) => {
      if (seekTo && seekTo > 0) {
        el.addEventListener(
          "loadedmetadata",
          () => {
            if (el.duration && seekTo < el.duration) el.currentTime = seekTo;
          },
          { once: true }
        );
      }
      // Setting `src` to a value it already holds — the exact case when the
      // "Test direct" button retries while direct play is already the
      // active engine — is a no-op per the HTML spec: no reload, no
      // request, nothing. `load()` forces a genuine re-fetch regardless of
      // whether the URL string actually changed.
      el.src = directUrl;
      el.load();
      void el.play().catch(() => void 0);

      // Recovery chain is strictly direct → MSE → HLS: a failed direct play
      // (real `error` event) still gets a shot at the bitstream-copy MSE
      // engine (proven, no server transcode) before falling all the way back
      // to a real Plex transcode. tryStartMse() itself no-ops for anything it
      // can't handle (wrong container, active subtitles, seek-resume...) and
      // returns false, which cascades straight to HLS — same contract as the
      // strategy==="transcode" branch in begin() already uses.
      let directRecoveryStarted = false;
      const recoverFromDirect = async () => {
        if (directRecoveryStarted || fallbackGuardRef.current || hlsRef.current || mseEngineRef.current || ffmpegEngineRef.current) return;
        directRecoveryStarted = true;
        awaitingAudioConfirmationRef.current = false;
        setOptimizing(true);
        {
          const b = betaRef.current;
          if (b.playbackEngine === "engine-v2" || (b.playbackEngine === "auto" && localPlayback)) {
            if (!(await tryStartLocalEngine(seekTo))) maybeStartHls(undefined, true);
            return;
          }
        }
        if (!(await tryStartMse(infoRef.current, seekTo)) && !(await tryStartFfmpegRemux(infoRef.current, seekTo))) maybeStartHls(undefined, true);
      };

      // Direct play can now be (re)started more than once per mount — the
      // manual retry button reuses this same function — so a stale listener
      // from a previous attempt must be removed first, or it stacks up and
      // double-fires recovery.
      const prevErr = (el as unknown as { __vpOnError?: () => void }).__vpOnError;
      if (prevErr) el.removeEventListener("error", prevErr);
      const onError = () => { void recoverFromDirect(); };
      el.addEventListener("error", onError);
      (el as unknown as { __vpOnError?: () => void }).__vpOnError = onError;

      // Safety net: the codec checks that greenlit direct play are all
      // static pre-playback probes (see webcodecs.ts) — none of them are
      // re-verified once actually playing, and an unroutable/unsupported
      // audio track does not fire the `error` event above, it just plays
      // silently. Watch real decoded audio energy with a sub-second window
      // (800ms) so a dead track escalates almost instantly; requireStarted
      // holds the verdict until decoding actually began (readyState >= 2 &&
      // currentTime > 0) so a cold-starting direct play isn't misread as
      // silence. A genuine silence verdict escalates to the local ffmpeg
      // remux first (audio transcoded to AAC, video untouched) — HLS is
      // only the last resort if ffmpeg is unavailable or inapplicable.
      // Metadata is not reliable enough to decide whether a title has audio:
      // some local and Plex files omit the aggregate codec and stream list.
      // Every direct movie/episode is therefore live-verified. A genuinely
      // silent title is rare; a browser silently failing an AC-3/DTS/TrueHD
      // track is not, and must always trigger the audio-only fallback.
      stopSilentWatchRef.current?.();
      awaitingAudioConfirmationRef.current = true;
      stopSilentWatchRef.current = watchForSilentAudio(el, () => escalateSilentToFfmpeg(), {
        windowMs: 800,
        requireStarted: true,
        onConfirmedAudible: () => {
          awaitingAudioConfirmationRef.current = false;
          setOptimizing(false);
        },
      });
    };
    startDirectRef.current = startDirect;

    const begin = async (seekTo?: number) => {
      setBuffering(true);
      setOptimizing(true);
      hlsCopyEscalatedRef.current = false;
      hlsCopyNetworkRetriedRef.current = false;
      // Reset the engine badge — begin() can re-run (resume-with-seek) and
      // the previous run's engine may differ from this one.
      setDirectMode(false);

      // useTranscode = beta player mode: try direct/WebCodecs first,
      // fall back to HLS transcode if the browser can't handle the codec.
      let info: StreamInfo = { videoCodec: null, audioCodec: null, container: null };
      // Calculée ici pour être réutilisée par la détection de stratégie
      // ci-dessous (même piste, jamais recalculée différemment).
      let localePreferredAudio: StreamTrack | undefined;
      try {
        const res = await fetch(localPlayback
          ? `${localStreamPath}/info`
          : `/api/stream/${ratingKey}/info`, { cache: "no-store" });
        if (res.ok) {
          info = (await res.json()) as StreamInfo;
          info.container = (info as any).container ?? null;
          infoRef.current = info;
          setMarkers(info.markers ?? []);
          const audioTracks = Array.isArray(info.audioStreams) ? info.audioStreams : [];
          const subTracks = Array.isArray(info.subtitleStreams) ? info.subtitleStreams : [];
          setAudioStreams(audioTracks);
          setSubtitleStreams(subTracks);

          // Piste audio par défaut : la langue de l'UI Movviz d'abord (même
          // règle que le badge, voir findAudioStreamForLocale) — repli sur la
          // piste marquée "selected" par Plex si aucune ne correspond.
          const localeAudio = findTrackForLocale(audioTracks, localeRef.current);
          localePreferredAudio = localeAudio ?? audioTracks.find((s) => s.selected) ?? audioTracks[0];
          if (localePreferredAudio) setCurrentAudio(localePreferredAudio.id);

          // Sous-titres : jamais forcés quand l'audio choisi correspond déjà
          // à la langue de l'UI — seulement quand aucune piste audio dans
          // cette langue n'existe, pour retrouver le réflexe "audio étranger
          // → sous-titres dans ma langue" des autres lecteurs.
          const localeSub = localeAudio ? null : findTrackForLocale(subTracks, localeRef.current);
          const selSub = localeSub ?? subTracks.find((s) => s.selected);
          if (selSub) setCurrentSubtitle(selSub.id);

          // The playback session opens before the stream metadata arrives so
          // the resume decision remains responsive. Correct its duration as
          // soon as Plex tells us the real one; otherwise a fragmented MP4
          // can leave progress logic using a guessed 16-minute duration.
          const sessionId = playbackSessionRef.current;
          const durationMs = Number(info.durationMs);
          if (sessionId && Number.isFinite(durationMs) && durationMs > 0) {
            void fetch(`/api/playback/sessions/${encodeURIComponent(sessionId)}/metadata`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ durationMs }),
              keepalive: true,
            }).catch(() => void 0);
          }
        }
      } catch { /* ignore */ }

      let strategy: "direct" | "transcode";
      let effectiveAudioCodec: string | null | undefined;
      try {
        // Detect browser codec capabilities once
        const caps = await detectCodecs();
        codecCapsRef.current = caps;

        // --- Bypass codecs audio: auto-switch to a compatible track ---
        // DTS/TrueHD/PCM can't be decoded by ANY browser. Most Blu-ray remuxes
        // carry a second track (AC3/EAC3/AAC...) — pick it so audio is copied
        // (ta=0) instead of transcoded, with zero audible quality loss.
        // CRITICAL: direct play plays the file's DEFAULT track — it cannot
        // select a track. So a switch forces the HLS path, which can via
        // audioStreamID. Otherwise the browser plays the DTS track and the
        // video is silently muted.
        const audioTracks = Array.isArray(info.audioStreams) ? info.audioStreams : [];
        // Réutilise le choix déjà fait plus haut (langue UI d'abord) — ne
        // jamais recalculer une seconde règle qui pourrait diverger.
        const selAudio = localePreferredAudio ?? audioTracks.find((s) => s.selected) ?? audioTracks[0];
        defaultAudioIdRef.current = selAudio?.id ?? null;
        effectiveAudioCodec = selAudio?.codec ?? info.audioCodec;
        audioStreamIdRef.current = selAudio?.id ?? null;
        let audioSwitched = false;
        if (effectiveAudioCodec && !isAudioCodecSupported(effectiveAudioCodec, caps)) {
          const prefLang = selAudio?.language ?? "";
          const fallback = audioTracks
            .filter(
              (t) =>
                t.id !== selAudio?.id &&
                !!t.codec &&
                // Le même codec que la piste déjà rejetée ne peut rien
                // résoudre — confirmé en direct (Jurassic Park 499959,
                // deux pistes AC-3 FR/EN) : sans ce garde, le bypass
                // "réussissait" en basculant vers l'AUTRE piste AC-3
                // (anglaise) simplement parce qu'elle n'était pas exclue,
                // écrasant silencieusement la piste française déjà
                // correctement choisie (locale ET défaut Plex) sans
                // apporter la moindre compatibilité supplémentaire.
                t.codec.toLowerCase() !== (selAudio?.codec ?? "").toLowerCase() &&
                isAudioMseTransmuxable(t.codec)
            )
            .sort((a, b) => scoreAudioTrack(b, prefLang) - scoreAudioTrack(a, prefLang))[0];
          if (fallback?.codec) {
            setCurrentAudio(fallback.id);
            audioStreamIdRef.current = fallback.id;
            effectiveAudioCodec = fallback.codec;
            audioSwitched = true;
            console.log(`[player] audio bypass: ${selAudio?.codec ?? info.audioCodec} → ${fallback.codec} (piste ${fallback.id})`);
          }
        }

        // Always compute individual codec flags (feeds the fallback leg's
        // transcode-mode badges/menu regardless of how it was reached).
        transcodeVideoRef.current = info.videoCodec ? !isVideoCodecSupported(info.videoCodec, caps) : false;
        // HLS gate: ta=0 (copy) for any codec hls.js's TS demuxer structurally
        // supports (AAC/MP3/AC-3) — a fixed library fact, not a browser probe.
        // E-AC3/DTS/TrueHD/FLAC/Opus in HLS → transcode to AAC, never copy.
        // Whether the browser actually renders the copied track is verified
        // live by startHls's silent-audio watch below, same as direct play.
        transcodeAudioRef.current = effectiveAudioCodec ? shouldForceAudioTranscode(effectiveAudioCodec, caps) : false;

        // Direct play is now the unconditional first attempt — the manual
        // "lightning bolt" button and this automatic path are the same
        // function (startDirect), sharing the same error/silent-audio
        // recovery net. No more static canPlayType/MediaSource probing to
        // pre-decide "direct" vs "webcodecs" vs "transcode": confirmed live
        // that those probes lie for common cases (AC-3/E-AC-3 canPlayType on
        // Chrome/Edge, DTS/TrueHD on native <video> for non-MP4 containers)
        // and routed away from direct play that would have actually worked
        // fine. Only two structural gates remain, because both are facts,
        // not probabilistic probes:
        //  - audioSwitched: direct play cannot select a non-default audio
        //    track, so if the bypass logic above had to switch tracks,
        //    direct is impossible, not just risky.
        //  - video codec truly undecodable: skip a doomed direct attempt.
        // Everything else — silent/broken default audio, a codec probe that
        // would have said "should be fine" but isn't — is caught live by
        // startDirect's error listener + watchForSilentAudio, exactly as it
        // already was for the subset of files that used to reach "direct".
        // Moteur ffmpeg : interdiction absolue de lecture directe — tout
        // passe par le remux ffmpeg (Réglages → Plex).
        strategy = betaRef.current.playbackEngine === "ffmpeg" || audioSwitched || (info.videoCodec && !isVideoCodecSupported(info.videoCodec, caps))
          ? "transcode"
          : "direct";
      } catch {
        strategy = "transcode";
        transcodeVideoRef.current = true;
        transcodeAudioRef.current = true;
      }

      if (strategy === "transcode") {
        if (betaRef.current.playbackEngine === "engine-v2" || (betaRef.current.playbackEngine === "auto" && localPlayback)) {
          if (!(await tryStartLocalEngine(seekTo))) maybeStartHls(undefined, true);
          return;
        }
        if (betaRef.current.playbackEngine === "ffmpeg") {
          // La leg MSE ne renverra jamais "mse" avec engine "ffmpeg"
          // (orchestrate exige "mse" ou "auto") — remux directement, HLS
          // en dernier recours.
          if (!(await tryStartFfmpegRemux(info, seekTo))) maybeStartHls(undefined, true);
          return;
        }
        if (!(await tryStartMse(info, seekTo)) && !(await tryStartFfmpegRemux(info, seekTo))) maybeStartHls(undefined, true);
        return;
      }

      setDirectMode(true);
      startDirect(seekTo, !!effectiveAudioCodec);
    };

    beginRef.current = begin;

    const destroyMse = () => {
      if (mseEngineRef.current) {
        try { mseEngineRef.current.destroy(); } catch { /* ignore */ }
        mseEngineRef.current = null;
      }
      setMseActive(false);
      setMseStats(null);
    };

    const fallbackFromMse = () => {
      destroyMse();
      mseSkippedRef.current = true;
      setBuffering(true);
      fallbackGuardRef.current = false;
      maybeStartHls(undefined, true);
    };

    // MSE leg: replaces the HLS-transcode leg for MP4 files whose codecs are
    // provably MSE-copyable. Deterministic — every failure falls back to HLS.
    const tryStartMse = async (info: StreamInfo, seekTo?: number): Promise<boolean> => {
      const video = videoRef.current;
      if (!video) return false;
      const b = betaRef.current;
      if (!b.enabled || mseSkippedRef.current || b.playbackEngine === "native") return false;
      if (seekTo && seekTo > 0) return false; // resume path stays on proven engines
      const media: MediaInfo = {
        ratingKey,
        container: info.container,
        videoCodec: info.videoCodec,
        audioCodec: info.audioCodec,
      };
      try {
        const caps = await detectCapabilities();
        const decision = await orchestrate({
          media,
          capabilities: caps,
          engine: b.playbackEngine,
          subtitleActive: !!currentSubtitle,
          directPossible: false,
          webcodecsPossible: false,
        });
        if (decision.engine !== "mse" || !decision.mse) return false;

        const engine = new MSEPlaybackEngine({
          onBuffering: (buffering) => setBuffering(buffering),
          onError: (_msg, fatal) => {
            if (!fatal) return;
            if (!mseEngineRef.current) return;
            fallbackFromMse();
          },
          onDebug: (stats) => setMseStats(stats),
        });
        mseEngineRef.current = engine;
        setMseActive(true);
        setDirectMode(false);
        setBuffering(true);
        engine.attach(video);
        try {
          await engine.load(ratingKey, {
            videoMime: decision.mse.videoMime,
            audioMime: decision.mse.audioMime,
            debug: b.debug,
          });
        } catch {
          fallbackFromMse();
          return false;
        }
        // The MSE leg is a bitstream-copy leg like direct/HLS/DASH: a codec
        // the browser can't actually render plays silently with no `error`
        // event. Arm the same live-energy watch — on a genuine silence
        // verdict the whole copy family is done, so it escalates to a real
        // ta=1 transcode (destroying this engine first). No-op if the
        // element's AudioContext source node is already taken by an earlier
        // direct-leg watch (that verdict already covered this case).
        stopSilentWatchRef.current?.();
        stopSilentWatchRef.current = watchForSilentAudio(video, () => escalateSilentToTranscode("mse"));
        return true;
      } catch {
        return false;
      }
    };

    const destroyFfmpeg = () => {
      if (ffmpegEngineRef.current) {
        const engine = ffmpegEngineRef.current;
        ffmpegEngineRef.current = null;
        void engine.destroy().catch(() => void 0);
      }
      // Les évènements media peuvent arriver avant le prochain rendu React.
      // Le ref doit donc refléter immédiatement l'arrêt du moteur, sinon ils
      // additionnent à tort un ancien seekBase à une leg native suivante.
      ffmpegActiveRef.current = false;
      setFfmpegActive(false);
      setFfmpegStats(null);
    };

    const fallbackFromFfmpeg = () => {
      destroyFfmpeg();
      ffmpegSkippedRef.current = true;
      setBuffering(true);
      fallbackGuardRef.current = false;
      maybeStartHls(undefined, true);
    };

    // FFmpeg remux leg: takes over exactly where the JS-only MSE parser
    // gives up (non-MP4-progressive containers — MKV in particular, the
    // vast majority of this library). Movviz pulls the raw file straight
    // from Plex and remuxes it itself (-c:v copy, -c:a copy|aac), bypassing
    // Plex's own transcoder entirely — see the plan's "Contexte" section for
    // why: Plex MDE's refusal to bitstream-copy HEVC for some files is a
    // confirmed, unfixable-from-outside black box. Deterministic — every
    // failure falls back to HLS, same contract as tryStartMse.
    const tryStartFfmpegRemux = async (info: StreamInfo, seekTo?: number): Promise<boolean> => {
      const video = videoRef.current;
      if (!video) return false;
      const b = betaRef.current;
      if (!b.enabled || ffmpegSkippedRef.current || b.playbackEngine === "native") return false;
      // Unlike MSE, the local remux endpoint natively accepts `seekTo` and
      // restarts FFmpeg with `-ss`. Refusing that path sent every resume to
      // the now-manual HLS leg, producing the “HLS disabled” screen even
      // though FFmpeg was available and built for this exact operation.
      const media: MediaInfo = {
        ratingKey,
        container: info.container,
        videoCodec: info.videoCodec,
        audioCodec: info.audioCodec,
      };
      try {
        const caps = await detectCapabilities();
        const decision = await orchestrate({
          media,
          capabilities: caps,
          engine: b.playbackEngine,
          subtitleActive: !!currentSubtitle,
          directPossible: false,
          webcodecsPossible: false,
          ffmpegAvailable: info.ffmpegAvailable === true,
        });
        if (decision.engine !== "ffmpeg") return false;

        const engine = new FfmpegRemuxEngine({
          onBuffering: (buffering) => setBuffering(buffering),
          onError: (_msg, fatal) => {
            if (!fatal) return;
            if (!ffmpegEngineRef.current) return;
            fallbackFromFfmpeg();
          },
          onDebug: (stats) => setFfmpegStats(stats),
        });
        ffmpegEngineRef.current = engine;
        isLocalEngineV2Ref.current = false;
        // Idem au démarrage : `loadeddata` d'un fMP4 peut être émis avant le
        // rendu qui propage `ffmpegActive` dans son ref. La durée Plex doit
        // déjà être utilisée à ce tout premier évènement.
        ffmpegActiveRef.current = true;
        setFfmpegActive(true);
        setDirectMode(false);
        setBuffering(true);
        engine.attach(video);
        try {
          await engine.load(ratingKey, {
            audioStreamId: audioStreamIdRef.current ? Number(audioStreamIdRef.current) : null,
            seekTo,
            quality: qualityRef.current,
            debug: b.debug,
          });
        } catch {
          fallbackFromFfmpeg();
          return false;
        }
        // Contrairement à MSE (où le navigateur doit lui-même décoder un
        // codec dont le support n'est que probé, jamais garanti), l'audio
        // ffmpeg est soit une copie bit-exacte d'une piste déjà whitelistée
        // décodable (`COPY_SAFE_AUDIO`), soit transcodé en AAC — aucune
        // incertitude à couvrir. Confirmé en direct (Ace Ventura 500751) :
        // la veille de silence se déclenchait ~6s (sa fenêtre par défaut)
        // après le démarrage d'un flux ffmpeg qui jouait normalement,
        // détruisant le moteur et coupant la connexion — ce qui déclenchait
        // à son tour le crash serveur du double-destroy corrigé plus haut.
        return true;
      } catch {
        return false;
      }
    };
    tryStartFfmpegRemuxRef.current = tryStartFfmpegRemux;

    // Nouveau moteur de décision (Phases 9-16, PLAN_REFONTE_MOTEUR_LECTURE_MOVVIZ.md)
    // — s'engage quand betaRef.current.playbackEngine === "engine-v2" est
    // explicitement sélectionné dans Réglages → Plex, OU quand le moteur est
    // sur "auto" ET que le contenu est local (Phase 16 : "auto" n'a
    // aujourd'hui AUCUN filet de secours qui fonctionne pour un fichier
    // local nécessitant un remux/transcode — confirmé en direct, la leg
    // ffmpeg-remux et la leg HLS échouent toutes les deux car aucune vraie
    // clé Plex n'existe pour ce contenu — donc câbler ce moteur dans "auto"
    // pour ce cas précis ne peut que corriger un cas déjà cassé, jamais
    // remplacer un chemin qui fonctionnait). Les choix manuels autres que
    // "auto"/"engine-v2" (mse/ffmpeg/native/hls) ne déclenchent jamais cette
    // leg — un choix explicite de dépannage reste intact. Dans tous les cas,
    // seulement pour du contenu local (movvizId présent, pas de dépendance à
    // Plex). Réutilise
    // FfmpegRemuxEngine tel quel côté client (même pipe fMP4/MSE-less déjà
    // éprouvé) — seul le préfixe d'URL change, vers la nouvelle route de
    // session du moteur (/api/playback/session/{id}/stream) au lieu de
    // /api/playback-ffmpeg/{ratingKey}.
    const tryStartLocalEngine = async (seekTo?: number): Promise<boolean> => {
      const video = videoRef.current;
      if (!video) return false;
      const b = betaRef.current;
      // Phase 16 — reachable from "auto" too, not just the explicit
      // "engine-v2" manual choice: for local (non-Plex) content that needs
      // a remux/transcode, "auto" today has NO working fallback at all
      // (confirmed live — the ffmpeg-remux leg needs a real Plex ratingKey,
      // the HLS leg needs a real Plex transcode session; a local-only movie
      // has neither, so both fail every time). Wiring this engine into
      // "auto" for exactly that gap can only fix a case that was always
      // broken — it never displaces a path that used to work, and manual
      // selections other than "auto"/"engine-v2" (mse/ffmpeg/native/hls)
      // are left completely alone, respecting an explicit troubleshooting
      // choice.
      const engineSelected = b.playbackEngine === "engine-v2" || b.playbackEngine === "auto";
      if (!b.enabled || !engineSelected || !localPlayback || !movvizId) return false;
      try {
        const clientProfile = await detectDesktopClientProfile(getOrCreateDeviceId(), "1.0");
        const prepRes = await fetch("/api/playback/prepare", {
          method: "POST",
          headers: { "content-type": "application/json" },
          // Piste audio/sous-titres non transmises volontairement dans cette
          // première intégration : decidePlayback() choisit déjà une piste
          // par défaut sensée (langue préférée si connue, sinon défaut du
          // fichier) — brancher la sélection manuelle de piste sur ce moteur
          // est un raffinement séparé, pas un pré-requis pour la capacité
          // de base (remux/transcode/burn-in local).
          body: JSON.stringify({ mediaId: movvizId, clientProfile }),
        });
        if (!prepRes.ok) return false;
        const prep = (await prepRes.json()) as {
          sessionId: string;
          plan: { mode: string };
          stream: { url: string };
          media: { durationMs?: number };
          tracks?: { audio?: { index: number }[]; subtitle?: { index: number }[] };
        };
        // DIRECT_PLAY et PLEX_FALLBACK/UNSUPPORTED ne concernent pas cette
        // leg : le premier est déjà couvert par startDirect, les seconds
        // n'ont rien qu'un remux/transcode local puisse résoudre.
        if (prep.plan.mode !== "REMUX" && prep.plan.mode !== "DIRECT_STREAM" && prep.plan.mode !== "TRANSCODE") return false;

        // Même raison que la leg ffmpeg existante (onLoadedData plus bas) :
        // un MP4 fragmenté empty_moov n'a pas de durée totale connue côté
        // <video> natif — infoRef.current.durationMs est la seule source
        // fiable pour l'affichage ET la barre de buffer. La durée réelle
        // vient ici directement du MediaDescriptor ffprobe (Phase 2), plus
        // fiable encore que la durée Plex utilisée par l'ancienne leg.
        if (prep.media.durationMs) {
          infoRef.current = { ...infoRef.current, durationMs: prep.media.durationMs };
          const sessionId = playbackSessionRef.current;
          if (sessionId) {
            void fetch(`/api/playback/sessions/${encodeURIComponent(sessionId)}/metadata`, {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ durationMs: prep.media.durationMs }),
              keepalive: true,
            }).catch(() => void 0);
          }
        }

        // §44-46/49 (Plex n'est un filet de secours QUE s'il existe
        // vraiment) : pour un titre purement local, `ratingKey` n'est PAS
        // une vraie clé Plex — TitleContent.tsx retombe sur l'id Movviz
        // lui-même quand plexRatingKey est absent (playbackRatingKey =
        // libraryMatch?.plexRatingKey ?? libraryMatch?.id). Router un échec
        // vers la leg Plex/DASH dans ce cas produirait une boucle de 502
        // garantie (§49) plutôt qu'un vrai filet de secours — mieux vaut un
        // échec honnête que ça. (hasRealPlexLink is computed once at
        // component scope — see its own comment there.)
        const onLocalEngineFailure = () => {
          destroyFfmpeg();
          ffmpegSkippedRef.current = true;
          if (hasRealPlexLink) {
            setBuffering(true);
            fallbackGuardRef.current = false;
            maybeStartHls(undefined, true);
          } else {
            setError(tRef.current("player.betaError"));
          }
        };

        const engine = new FfmpegRemuxEngine(
          {
            onBuffering: (buffering) => setBuffering(buffering),
            onError: (_msg, fatal) => {
              if (!fatal) return;
              if (!ffmpegEngineRef.current) return;
              onLocalEngineFailure();
            },
            onDebug: (stats) => setFfmpegStats(stats),
          },
          "/api/playback/session",
          "/stream"
        );
        ffmpegEngineRef.current = engine;
        ffmpegActiveRef.current = true;
        isLocalEngineV2Ref.current = true;
        localEngineAudioTracksRef.current = prep.tracks?.audio ?? [];
        localEngineSubtitleTracksRef.current = prep.tracks?.subtitle ?? [];
        setFfmpegActive(true);
        setDirectMode(false);
        setBuffering(true);
        engine.attach(video);
        try {
          await engine.load(prep.sessionId, { seekTo, debug: b.debug });
        } catch {
          // Ownership was already taken above (ffmpegEngineRef/setFfmpegActive)
          // and onLocalEngineFailure() already ran its own fallback/error —
          // return true, not false, so the caller (recoverFromDirect /
          // begin() / escalateSilentToFfmpeg) never ALSO triggers a second,
          // redundant fallback on top of the one just handled internally.
          onLocalEngineFailure();
          return true;
        }
        return true;
      } catch {
        return false;
      }
    };

    let sessionReady = false;
    void fetch("/api/playback/sessions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ratingKey, mediaId: movvizId, mediaType, durationMs: Math.max(1, Math.round((infoRef.current.durationMs ?? 0) || 1_000_000)), tmdbId, seasonNumber, episodeNumber, title }),
    }).then((r) => r.ok ? r.json() : null).then((data: { sessionId?: string; resumeOffsetMs?: number | null; watched?: boolean } | null) => {
      if (!data?.sessionId) return begin();
      sessionReady = true;
      playbackSessionRef.current = data.sessionId;
      const saved = Number(data.resumeOffsetMs);
      const explicitResume = Number(resumeFromSeconds);
      if (Number.isFinite(explicitResume) && explicitResume > 0) {
        // The page CTA already explicitly chose this resume point. Session
        // offsets are milliseconds; begin() accepts seconds.
        void begin(explicitResume);
      } else if (!startFromBeginning && !data.watched && saved > 0 && Number.isFinite(saved)) {
        // API contract is resumeOffsetMs. Treating it as seconds produced
        // prompts such as 162:55:11 for a real 9:46 position.
        setSavedPos(saved / 1000);
        setShowResume(true);
      } else {
        void begin();
      }
    }).catch(() => { if (!sessionReady) void begin(); });

    const el = videoRef.current;
    if (!el) return;

    const onWaiting = () => setBuffering(true);
    // Universal "a real frame is now flowing" signal — fires regardless of
    // which engine feeds this same <video> element (direct src, MSE,
    // ffmpeg-remuxed HLS/progressive). Gated on awaitingAudioConfirmationRef
    // so it can't prematurely lift the "optimizing" cover for a throwaway
    // direct-play attempt whose own audio verdict (silent → escalate) is
    // still pending — see startDirect()/escalateSilentToFfmpeg() above.
    const clearOptimizingIfSettled = () => {
      if (!awaitingAudioConfirmationRef.current) setOptimizing(false);
    };
    const onPlaying = () => { setBuffering(false); clearOptimizingIfSettled(); };
    const onCanPlay = () => { setBuffering(false); clearOptimizingIfSettled(); };
    el.addEventListener("waiting", onWaiting);
    el.addEventListener("playing", onPlaying);
    el.addEventListener("canplay", onCanPlay);

    const saveProgress = () => {
      const ve = videoRef.current;
      if (!ve || !ve.duration || Number.isNaN(ve.duration)) return;
      // Leg ffmpeg : la position navigateur repart de 0 à chaque reload
      // (fMP4 fragmenté sans index) — la position réelle est
      // seekBase + el.currentTime, voir FfmpegRemuxEngine.seekBase.
      const base = ffmpegEngineRef.current?.seekBase ?? 0;
      const displayTime = (ffmpegActiveRef.current ? base + ve.currentTime : ve.currentTime);
      const offset = Math.floor(displayTime * 1000);
      localStorage.setItem(PROGRESS_KEY(playbackId), String(displayTime));
      const sessionId = playbackSessionRef.current;
      if (sessionId) {
        void fetch(`/api/playback/sessions/${sessionId}/heartbeat`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sequence: ++playbackSequenceRef.current, positionMs: Math.round(displayTime * 1000), isPlaying: !ve.paused, playbackRate: ve.playbackRate }),
          keepalive: true,
        }).catch(() => void 0);
      }
      if (!localPlayback) void fetch(`/api/stream/${ratingKey}/progress`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ offset }),
        keepalive: true,
      }).catch(() => void 0);
    };
    progressTimerRef.current = setInterval(saveProgress, 10000);

    return () => {
      try {
        const base = ffmpegEngineRef.current?.seekBase ?? 0;
        const offset = Math.floor((ffmpegActiveRef.current ? base + el.currentTime : el.currentTime) * 1000);
        void fetch(`/api/stream/${ratingKey}/progress`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ offset, state: "stopped" }),
          keepalive: true,
        }).catch(() => void 0);
        void fetch(`/api/stream/${ratingKey}/stop`, {
          method: "POST",
          keepalive: true,
        }).catch(() => void 0);
        const sessionId = playbackSessionRef.current;
        if (sessionId) void fetch(`/api/playback/sessions/${sessionId}/stop`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ positionMs: Math.round((ffmpegActiveRef.current ? base + el.currentTime : el.currentTime) * 1000) }), keepalive: true }).catch(() => void 0);
      } catch { /* ignore */ }
      if (mseEngineRef.current) {
        try { mseEngineRef.current.destroy(); } catch { /* ignore */ }
        mseEngineRef.current = null;
      }
      if (ffmpegEngineRef.current) {
        const engine = ffmpegEngineRef.current;
        ffmpegEngineRef.current = null;
        void engine.destroy().catch(() => void 0);
      }
      stopSilentWatchRef.current?.();
      stopSilentWatchRef.current = null;
      clearFfmpegSubtitle();

      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
        progressTimerRef.current = null;
      }

      el.removeEventListener("waiting", onWaiting);
      el.removeEventListener("playing", onPlaying);
      el.removeEventListener("canplay", onCanPlay);
      const storedErr = (el as unknown as { __vpOnError?: () => void }).__vpOnError;
      if (storedErr) el.removeEventListener("error", storedErr);

    if (hlsRef.current) {
        try { hlsRef.current.destroy(); } catch { /* ignore */ }
        hlsRef.current = null;
      }
      if (dashRef.current) {
        try { dashRef.current.reset(); } catch { /* ignore */ }
        dashRef.current = null;
      }
      prebufferClearRef.current?.();
      prebufferClearRef.current = null;
    };
  }, [ratingKey, useTranscode, localStreamPath]);

  useEffect(() => {
    setActiveMarker(markers.find((m) => currentTime * 1000 >= m.startMs && currentTime * 1000 < m.endMs) ?? null);
  }, [markers, currentTime]);

  // Point d'entrée unique pour tout seek programmatique (barre de
  // progression, boutons ±10s, raccourcis clavier) — la leg ffmpeg n'a pas
  // de plage seekable côté navigateur (fMP4 fragmenté sans index) et doit
  // toujours passer par le moteur plutôt que par `.currentTime` direct.
  const seekTo = useCallback((time: number) => {
    const el = videoRef.current;
    if (!el) return;
    if (ffmpegActiveRef.current && ffmpegEngineRef.current) {
      void ffmpegEngineRef.current.seek(time);
      setCurrentTime(time);
    } else {
      el.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const skip = useCallback((seconds: number) => {
    const el = videoRef.current;
    if (!el) return;
    // Leg ffmpeg : el.currentTime est relatif au flux (qui part de seekBase,
    // pas de 0) — la position réelle est seekBase + el.currentTime, sinon
    // un skip(10) après un seek à 45min repartirait à 10s du film.
    const base = ffmpegEngineRef.current?.seekBase ?? 0;
    const cur = ffmpegActiveRef.current ? base + el.currentTime : el.currentTime;
    const target = Math.max(0, Math.min(duration || el.duration || 0, cur + seconds));
    seekTo(target);
    setSkipToast((prev) => ({ n: (prev?.n ?? 0) + 1, delta: seconds }));
    try {
      navigator.vibrate?.(8);
    } catch {
      /* noop */
    }
  }, [duration, seekTo]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const onTimeUpdate = () => {
      if (seekingRef.current) return;
      // Leg ffmpeg : le `<video>` repart de 0 à chaque reload/seek (fMP4
      // fragmenté sans index) — la position réelle est
      // seekBase + el.currentTime, pas el.currentTime brut.
      const base = ffmpegEngineRef.current?.seekBase ?? 0;
      if (ffmpegActiveRef.current) {
        setCurrentTime(base + el.currentTime);
        // Sous-titres WebVTT : le track local est calé sur la base courante
        // (cues décalés de `base`) — un seek/reload change seekBase, il faut
        // reconstruire le track avec le nouveau décalage.
        const trackState = subtitleTrackRef.current;
        if (trackState && Math.abs(trackState.base - base) > 0.1) {
          applyFfmpegSubtitleOffset(base);
        }
      } else {
        setCurrentTime(el.currentTime);
      }
    };
    const onLoadedData = () => {
      // Leg ffmpeg : `<video>` natif lit un MP4 fragmenté à `empty_moov`
      // (durée totale inconnue par construction, pas un vrai live) — sa
      // `.duration` reste figée sur la portion déjà reçue ("0:02" observé
      // en direct) plutôt que de refléter la durée réelle du film. La durée
      // Plex connue à l'avance est toujours la bonne source pour cette leg.
      const known = infoRef.current?.durationMs;
      const isFfmpegStream = ffmpegEngineRef.current !== null;
      setDuration(isFfmpegStream && known ? known / 1000 : el.duration);
      setVolume(el.volume);
      setMuted(el.muted);
    };
    const onProgress = () => {
      if (el.buffered.length > 0) {
        // Leg ffmpeg : el.buffered est relatif au flux (qui part de seekBase,
        // pas de 0) et el.duration est figée sur la portion reçue — la barre
        // de buffer doit être décalée de seekBase et rapportée à la durée
        // réelle connue, sinon elle repart de 00:00 après un seek.
        const end = el.buffered.end(el.buffered.length - 1);
        const base = ffmpegEngineRef.current?.seekBase ?? 0;
        const known = infoRef.current?.durationMs;
        const isFfmpegStream = ffmpegEngineRef.current !== null;
        const total = isFfmpegStream && known ? known / 1000 : el.duration;
        if (total > 0) {
          const bufferedEnd = isFfmpegStream ? base + end : end;
          setBufferedPct((bufferedEnd / total) * 100);
        }
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onVolumeChange = () => {
      setVolume(el.volume);
      setMuted(el.muted);
    };
    const onRateChange = () => setPlaybackRate(el.playbackRate);
    const onEnded = () => {
      const sessionId = playbackSessionRef.current;
      if (sessionId) void fetch(`/api/playback/sessions/${sessionId}/ended`, { method: "POST", keepalive: true }).catch(() => void 0);
      localStorage.removeItem(PROGRESS_KEY(ratingKey));
      onNextEpisodeRef.current?.();
    };

    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("loadeddata", onLoadedData);
    el.addEventListener("progress", onProgress);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("volumechange", onVolumeChange);
    el.addEventListener("ratechange", onRateChange);
    el.addEventListener("ended", onEnded);

    return () => {
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("loadeddata", onLoadedData);
      el.removeEventListener("progress", onProgress);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("volumechange", onVolumeChange);
      el.removeEventListener("ratechange", onRateChange);
      el.removeEventListener("ended", onEnded);
    };
  }, []);

  const toggleFullscreen = async () => {
    // Le plein écran s'applique au CONTENEUR du player, jamais au <video> :
    // en fullscreen natif du video, le navigateur impose ses propres
    // contrôles, qui affichent le temps du FLUX (repart de 0, relatif au
    // seekBase) au lieu de la position réelle du film (seekBase +
    // currentTime), et son seek natif ne recharge pas la session serveur —
    // exactement « on voit le temps du buffer, on sait pas avancer ».
    // Avec le conteneur en fullscreen, nos overlays (barre, menus, header,
    // gestes double-tap) restent affichés et tout passe par notre pipeline.
    const el = playerRef.current ?? videoRef.current;
    if (!el) return;
    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitFullscreenEnabled?: boolean;
    };
    try {
      if (doc.fullscreenElement || doc.webkitFullscreenElement) {
        await document.exitFullscreen?.();
        setFullscreen(false);
      } else if (document.fullscreenEnabled || doc.webkitFullscreenEnabled) {
        // `navigationUI: "hide"` asks Chromium/Edge to hide browser chrome
        // as well: this is the platform fullscreen API, not a CSS-only
        // enlargement inside the browser tab. The player container stays the
        // fullscreen element so Movviz keeps its own identical controls.
        await el.requestFullscreen({ navigationUI: "hide" });
        setFullscreen(true);
      } else {
        // iPhone : pas de Fullscreen API sur un <div> — seul le <video>
        // supporte le plein écran natif (UI navigateur imposée, inévitable).
        (videoRef.current as HTMLVideoElement & { webkitEnterFullscreen?: () => void }).webkitEnterFullscreen?.();
      }
    } catch {
      // A browser can refuse fullscreen only when the user gesture expired.
      // Keep the player usable in-page rather than showing a false state.
      setFullscreen(false);
    }
  };

  useEffect(() => {
    const doc = document as Document & { webkitFullscreenElement?: Element | null };
    const onFsChange = () => setFullscreen(!!(doc.fullscreenElement || doc.webkitFullscreenElement));
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange);
    };
  }, []);

  const qualityLabel = (): string | null => {
    let h = 0;
    if (dashRef.current) {
      h = dashHeightRef.current ?? 0;
    } else {
      const hls = hlsRef.current;
      if (hls && currentLevel !== null) {
        const level = hls.levels[currentLevel];
        if (level) h = level.height || 0;
      }
    }
    if (h >= 2000) return "4K";
    if (h >= 1440) return "1440p";
    if (h >= 1000) return "1080p";
    if (h >= 700) return "720p";
    if (h > 0) return `${h}p`;
    return null;
  };

  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!seekingRef.current && playing && !buffering && !menuOpen) {
        setControlsVisible(false);
      }
    }, 3000);
  }, [playing, buffering, menuOpen]);

  // Un film qui démarre ne doit pas laisser le lecteur posé à l'écran.
  // Après une très courte fenêtre d'orientation, l'overlay revient seulement
  // au mouvement de souris, au clic, à la pause ou à l'ouverture d'un menu.
  useEffect(() => {
    if (!playing || buffering || menuOpen || showResume) {
      setControlsVisible(true);
      return;
    }
    const timer = setTimeout(() => {
      if (!seekingRef.current) setControlsVisible(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [playing, buffering, menuOpen, showResume]);

  // Sortie du pointeur hors de la vidéo → les contrôles se replient vite
  // (800ms au lieu de 3s, comportement Plex/Netflix).
  const quickHideControls = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (!seekingRef.current && playing && !buffering) {
        setControlsVisible(false);
      }
    }, 800);
  };

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  };

  // Netflix smartphone : double-tap = seek ±10s, tap simple = contrôles
  // (jamais de pause surprise). Desktop garde le click play/pause.
  const lastTapRef = useRef<{ time: number; double: boolean }>({ time: 0, double: false });
  const handleVideoTouchEnd = (e: React.TouchEvent<HTMLVideoElement>) => {
    const now = Date.now();
    const prev = lastTapRef.current;
    if (now - prev.time < 300) {
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.changedTouches[0].clientX - rect.left;
      skip(x < rect.width / 2 ? -10 : 10);
      lastTapRef.current = { time: now, double: true };
    } else {
      lastTapRef.current = { time: now, double: false };
    }
  };
  const handleVideoClick = () => {
    if (lastTapRef.current.double && Date.now() - lastTapRef.current.time < 400) return;
    if (typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches) {
      resetHideTimer();
      return;
    }
    togglePlay();
  };

  const toggleMute = () => {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !el.muted;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      switch (e.key) {
        case " ":
        case "k":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          skip(-10);
          resetHideTimer();
          break;
        case "ArrowRight":
          e.preventDefault();
          skip(10);
          resetHideTimer();
          break;
        case "j":
        case "J":
          e.preventDefault();
          skip(-10);
          resetHideTimer();
          break;
        case "l":
        case "L":
          e.preventDefault();
          skip(10);
          resetHideTimer();
          break;
        case "ArrowUp": {
          e.preventDefault();
          const el = videoRef.current;
          if (el) {
            el.volume = Math.min(1, el.volume + 0.1);
            el.muted = false;
          }
          resetHideTimer();
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          const el = videoRef.current;
          if (el) el.volume = Math.max(0, el.volume - 0.1);
          resetHideTimer();
          break;
        }
        case "f":
        case "F":
          e.preventDefault();
          void toggleFullscreen();
          break;
        case "m":
        case "M":
          e.preventDefault();
          toggleMute();
          break;
        case "Escape":
          // First dismiss an open menu, like the native TV/streaming
          // players. Only a second Escape closes the player itself.
          if (menuOpen) setMenuOpen(null);
          else onClose();
          break;
        case "0": case "1": case "2": case "3": case "4":
        case "5": case "6": case "7": case "8": case "9":
          // Convention YouTube/Netflix : saute au X0% de la durée totale.
          if (duration > 0) {
            e.preventDefault();
            seekTo((Number(e.key) / 10) * duration);
            resetHideTimer();
          }
          break;
        default:
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, skip, seekTo, resetHideTimer, duration, menuOpen]);

  const togglePiP = async () => {
    const el = videoRef.current;
    if (!el) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await el.requestPictureInPicture();
      }
    } catch { /* PiP not supported or denied */ }
  };

  const getSeekRatio = (clientX: number): number => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const getSeekTime = (clientX: number): number => {
    if (!duration) return 0;
    return getSeekRatio(clientX) * duration;
  };

  // Vignette de survol — proxy des index BIF que Plex génère déjà pour son
  // propre lecteur (voir scrub-thumb/route.ts). Granularité 1s (largement
  // suffisant pour un aperçu), résultats mis en cache en mémoire (Blob URL)
  // pour ne jamais re-fetcher la même seconde en scrubant sur place, et
  // débattus (150ms) pour ne pas spammer le serveur à chaque pixel de
  // mouvement de souris.
  const scrubCacheRef = useRef<Map<number, string>>(new Map());
  const scrubAbortRef = useRef<AbortController | null>(null);
  const scrubDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [scrubPreview, setScrubPreview] = useState<{ time: number; ratio: number; url: string | null } | null>(null);

  useEffect(() => () => {
    scrubCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
    scrubCacheRef.current.clear();
  }, []);

  const requestScrubThumb = useCallback((time: number, ratio: number) => {
    const key = Math.floor(time);
    const cached = scrubCacheRef.current.get(key);
    setScrubPreview({ time, ratio, url: cached ?? null });
    if (cached) return;
    if (scrubDebounceRef.current) clearTimeout(scrubDebounceRef.current);
    scrubDebounceRef.current = setTimeout(() => {
      scrubAbortRef.current?.abort();
      const ac = new AbortController();
      scrubAbortRef.current = ac;
      fetch(`/api/stream/${ratingKey}/scrub-thumb?t=${key * 1000}`, { signal: ac.signal })
        .then((res) => (res.ok ? res.blob() : null))
        .then((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          scrubCacheRef.current.set(key, url);
          setScrubPreview((cur) => (cur && Math.floor(cur.time) === key ? { ...cur, url } : cur));
        })
        .catch(() => void 0);
    }, 150);
  }, [ratingKey]);

  const handleProgressDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (!duration) return;
    e.preventDefault();
    seekingRef.current = true;

    const cx = "touches" in e ? e.touches[0].clientX : e.clientX;
    setSeekPreview(getSeekTime(cx));
    requestScrubThumb(getSeekTime(cx), getSeekRatio(cx));

    const onMove = (me: MouseEvent | TouchEvent) => {
      const mc = "touches" in me ? me.touches[0].clientX : me.clientX;
      setSeekPreview(getSeekTime(mc));
      requestScrubThumb(getSeekTime(mc), getSeekRatio(mc));
    };
    const onUp = (me: MouseEvent | TouchEvent) => {
      seekingRef.current = false;
      const uc = "changedTouches" in me ? me.changedTouches[0].clientX : me.clientX;
      const time = getSeekTime(uc);
      seekTo(time);
      setSeekPreview(null);
      setScrubPreview(null);
      document.removeEventListener("mousemove", onMove as EventListener);
      document.removeEventListener("mouseup", onUp as EventListener);
      document.removeEventListener("touchmove", onMove as EventListener);
      document.removeEventListener("touchend", onUp as EventListener);
    };

    document.addEventListener("mousemove", onMove as EventListener);
    document.addEventListener("mouseup", onUp as EventListener);
    document.addEventListener("touchmove", onMove as EventListener);
    document.addEventListener("touchend", onUp as EventListener);
  };

  // Survol seul (sans clic) — même aperçu que pendant un drag, pour pouvoir
  // repérer un moment avant de s'engager sur un clic.
  const handleProgressHover = (e: React.MouseEvent) => {
    if (!duration || seekingRef.current) return;
    requestScrubThumb(getSeekTime(e.clientX), getSeekRatio(e.clientX));
  };
  const handleProgressLeave = () => {
    if (!seekingRef.current) setScrubPreview(null);
  };

  const getVolumeFromEvent = (clientX: number): number => {
    const rect = volumeTrackRef.current?.getBoundingClientRect();
    if (!rect || !rect.width) return 1;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };

  const handleVolumeDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const apply = (clientX: number) => {
      const v = getVolumeFromEvent(clientX);
      if (videoRef.current) {
        videoRef.current.volume = v;
        videoRef.current.muted = false;
      }
    };
    apply(e.clientX);

    const onMove = (me: MouseEvent) => apply(me.clientX);
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const setSpeed = (speed: number) => {
    const el = videoRef.current;
    if (el) el.playbackRate = speed;
    setPlaybackRate(speed);
    setMenuOpen(null);
  };

  const toggleMenu = (menu: "audio" | "subtitle" | "speed" | "quality" | "playback") => {
    setMenuOpen((prev) => (prev === menu ? null : menu));
  };

  const handleResume = () => {
    setShowResume(false);
    void beginRef.current?.(savedPos);
  };

  const handleStartOver = () => {
    setShowResume(false);
    void beginRef.current?.(0);
  };

  const handleSkipMarker = () => {
    const marker = activeMarker;
    if (!marker) return;
    const sessionId = playbackSessionRef.current;
    if (sessionId) void fetch(`/api/playback/sessions/${sessionId}/seek`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ fromMs: Math.round(currentTime * 1000), toMs: marker.endMs, reason: "skip_marker", markerType: marker.type }), keepalive: true }).catch(() => void 0);
    seekTo(marker.endMs / 1000);
  };

  const currentPlaybackPosition = () => {
    const el = videoRef.current;
    if (!el) return 0;
    return Math.max(0, el.currentTime + (ffmpegEngineRef.current?.seekBase ?? 0));
  };

  const tearDownActiveLegs = () => {
    stopSilentWatchRef.current?.();
    stopSilentWatchRef.current = null;
    if (mseEngineRef.current) {
      try { mseEngineRef.current.destroy(); } catch { /* ignore */ }
      mseEngineRef.current = null;
      mseSkippedRef.current = true;
      setMseActive(false);
      setMseStats(null);
    }
    if (ffmpegEngineRef.current) {
      const engine = ffmpegEngineRef.current;
      ffmpegEngineRef.current = null;
      ffmpegSkippedRef.current = true;
      setFfmpegActive(false);
      setFfmpegStats(null);
      void engine.destroy().catch(() => void 0);
    }
    if (hlsRef.current) {
      try { hlsRef.current.destroy(); } catch { /* ignore */ }
      hlsRef.current = null;
    }
    if (dashRef.current) {
      try { dashRef.current.reset(); } catch { /* ignore */ }
      dashRef.current = null;
    }
  };

  const handleReturnToHls = () => {
    setDirectMode(false);
    setUsingFallback(false);
    fallbackGuardRef.current = false;
    setBuffering(true);
    if (mseEngineRef.current) {
      try { mseEngineRef.current.destroy(); } catch { /* ignore */ }
      mseEngineRef.current = null;
      mseSkippedRef.current = true;
      setMseActive(false);
      setMseStats(null);
    }
    if (ffmpegEngineRef.current) {
      const engine = ffmpegEngineRef.current;
      ffmpegEngineRef.current = null;
      ffmpegSkippedRef.current = true;
      setFfmpegActive(false);
      setFfmpegStats(null);
      void engine.destroy().catch(() => void 0);
    }
    maybeStartHls(undefined, true);
  };

  const QUALITY_PRESETS = [
    { label: t("player.betaQualityOriginal"), maxWidth: null, quality: "original" as FfmpegQuality },
    { label: "4K", maxWidth: 3840, quality: "4k" as FfmpegQuality },
    { label: "2K", maxWidth: 2560, quality: "2k" as FfmpegQuality },
    { label: "FHD", maxWidth: 1920, quality: "fhd" as FfmpegQuality },
    { label: "HD", maxWidth: 1280, quality: "hd" as FfmpegQuality },
  ] as const;

  const handleQualityChange = (mw: number | null) => {
    const preset = QUALITY_PRESETS.find((p) => p.maxWidth === mw) ?? QUALITY_PRESETS[0];
    qualityMaxWidthRef.current = mw;
    qualityRef.current = preset.quality;
    setMenuOpen(null);
    if (ffmpegEngineRef.current) {
      // Leg ffmpeg : reload local avec le nouveau profil, position conservée.
      void reloadFfmpeg(currentAudio, preset.quality);
      return;
    }
    if (hlsRef.current) {
      // Leg HLS (option manuelle) : le transcode Plex reçoit maxWidth.
      reloadHls(currentAudio, currentSubtitle);
      return;
    }
    // Legs copy (direct/MSE) : un downscale exige un encode — on bascule sur
    // le transcode ffmpeg LOCAL (plus jamais HLS par défaut), position
    // conservée via un seek après chargement. "original" repart en leg copy.
    if (mseEngineRef.current || directMode) {
      if (mseEngineRef.current) {
        try { mseEngineRef.current.destroy(); } catch { /* ignore */ }
        mseEngineRef.current = null;
        mseSkippedRef.current = true;
        setMseActive(false);
        setMseStats(null);
      }
      fallbackGuardRef.current = false;
      setUsingFallback(false);
      setDirectMode(false);
      setBuffering(true);
      const el = videoRef.current;
      const pos = el && el.currentTime > 0 ? el.currentTime : undefined;
      void (async () => {
        if (await tryStartFfmpegRemuxRef.current?.(infoRef.current, undefined)) {
          if (pos && pos > 0) await ffmpegEngineRef.current?.seek(pos);
        } else {
          maybeStartHls(undefined, true);
        }
      })();
      return;
    }
    maybeStartHls(undefined, true);
  };

  const playedPct = ((seekPreview ?? currentTime) / (duration || 1)) * 100;
  // The playback engine deliberately stays independent from this visual
  // system.  These shared surfaces give the desktop player one calm,
  // cinematic vocabulary instead of a collection of unrelated dark buttons.
  const iconButtonClass = "flex h-11 w-11 items-center justify-center rounded-full text-white/80 transition-all duration-200 hover:bg-white/14 hover:text-white hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80";
  const menuPanelClass = "absolute right-0 bottom-full mb-4 rounded-[20px] border border-white/12 bg-[#111218]/95 p-2 shadow-[0_24px_80px_rgba(0,0,0,0.62)] backdrop-blur-2xl max-w-[calc(100vw-2rem)]";
  const menuItemClass = "flex w-full items-center rounded-xl px-3.5 py-3 text-left text-[13px] text-white/75 transition-all duration-150 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow/70";

  return (
    <div className={cn(!embedded && "fixed inset-0 z-[100] flex items-center justify-center bg-[#030407] backdrop-blur-sm", embedded && "h-full w-full overscroll-none")}>
      <div
        ref={playerRef}
        className={cn(
          "relative isolate flex flex-col overflow-hidden bg-[#030407] shadow-[0_32px_120px_rgba(0,0,0,0.7)]",
          // `fullscreen:*` isn't a registered Tailwind variant in this
          // project (no @custom-variant for :fullscreen) — those classes
          // were always dead CSS. Driven from the real `fullscreen` state
          // instead: true browser fullscreen always gets a solid black,
          // unrounded, unconstrained box regardless of embedded/panel mode.
          fullscreen ? "fixed inset-0 h-[100dvh] w-[100dvw] rounded-none max-w-none bg-black" : embedded ? "h-full w-full rounded-none bg-transparent" : "bg-surface",
          !controlsVisible && playing && !buffering && !menuOpen ? "cursor-none" : undefined,
          !fullscreen && !embedded ? "rounded-2xl h-[80vh] w-[90vw] max-w-5xl" : undefined
        )}
      >
        <div
          aria-hidden={embedded && !controlsVisible && playing && !buffering ? true : undefined}
          className={cn(
            "pointer-events-none absolute inset-x-0 top-0 z-40 flex items-start justify-between gap-4 bg-gradient-to-b from-black/85 via-black/45 to-transparent px-5 pt-[max(env(safe-area-inset-top),1rem)] pb-20 pl-[max(env(safe-area-inset-left),1.25rem)] pr-[max(env(safe-area-inset-right),1.25rem)] transition-opacity duration-300",
            controlsVisible || !playing || buffering || menuOpen ? "opacity-100" : "opacity-0 [&>*]:pointer-events-none"
          )}
        >
          <div className="pointer-events-auto flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex h-9 w-1 shrink-0 rounded-full bg-[linear-gradient(180deg,var(--color-brand-glow),var(--color-brand))] shadow-[0_0_18px_color-mix(in_oklab,var(--color-brand-glow)_65%,transparent)]" />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">{title}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {usingFallback && (
                  <span className="flex h-6 items-center gap-1.5 rounded-full border border-white/10 bg-black/45 px-2.5 text-[10px] font-semibold text-white/85 backdrop-blur-xl">
                    <span className={cn("h-1.5 w-1.5 rounded-full shadow-[0_0_8px_currentColor]", transcodeVideoRef.current || transcodeAudioRef.current ? "bg-amber text-amber" : "bg-ok text-ok")} />
                    {transcodeVideoRef.current && transcodeAudioRef.current
                      ? t("player.betaTranscoded")
                      : transcodeVideoRef.current
                        ? t("player.betaTranscodedVideo")
                        : transcodeAudioRef.current
                          ? t("player.betaTranscodedAudio")
                          : t("player.betaDirectStream")}
                  </span>
                )}
                {directMode && (
                  <span className="flex h-6 items-center gap-1.5 rounded-full border border-white/10 bg-black/45 px-2.5 text-[10px] font-semibold text-white/85 backdrop-blur-xl">
                    <span className="h-1.5 w-1.5 rounded-full bg-ok text-ok shadow-[0_0_8px_currentColor]" />
                    {t("player.betaDirectActive")}
                  </span>
                )}
                {mseActive && (
                  <span className="flex h-6 items-center gap-1.5 rounded-full border border-white/10 bg-black/45 px-2.5 text-[10px] font-semibold text-white/85 backdrop-blur-xl">
                    <span className="h-1.5 w-1.5 rounded-full bg-cyan text-cyan shadow-[0_0_8px_currentColor]" />
                    {t("player.betaMseStream")}
                  </span>
                )}
                {ffmpegActive && (
                  <span className="flex h-6 items-center gap-1.5 rounded-full border border-white/10 bg-black/45 px-2.5 text-[10px] font-semibold text-white/85 backdrop-blur-xl">
                    <span className="h-1.5 w-1.5 rounded-full bg-purple text-purple shadow-[0_0_8px_currentColor]" />
                    {t("player.betaFfmpegLocal")}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="pointer-events-auto flex shrink-0 items-center gap-1 rounded-full border border-white/12 bg-black/45 p-1 shadow-lg backdrop-blur-2xl">
            {plexUrl && (
              <a
                href={plexUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => openPlexLink(e, plexUrl)}
                className={iconButtonClass}
                title={t("library.watchOnPlex")}
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            <button
              onClick={onClose}
              className={iconButtonClass}
              aria-label={t("player.betaClose")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div
          tabIndex={0}
          role="application"
          aria-label={title}
          className={cn(
            "relative flex flex-1 items-center justify-center",
            embedded ? "bg-transparent" : "bg-black",
            controlsVisible || !playing || buffering ? "" : "cursor-none"
          )}
          onMouseMove={resetHideTimer}
          onMouseEnter={resetHideTimer}
          onTouchStart={resetHideTimer}
          onMouseLeave={quickHideControls}
        >
          {error ? (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60">
              <div className="flex w-[calc(100vw-2rem)] max-w-sm flex-col items-center gap-4 rounded-2xl glass-strong p-8 text-center shadow-2xl animate-overlay-pop">
                <AlertTriangle className="h-6 w-6 text-down/70" />
                <p className="text-sm leading-relaxed text-ink-soft">{error}</p>
                {plexUrl && (
                  <a
                    href={plexUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => openPlexLink(e, plexUrl)}
                    className="flex h-11 items-center gap-2 rounded-xl glass px-5 text-sm font-semibold text-ink transition-all duration-150 hover:text-white active:scale-95"
                  >
                    <ExternalLink className="h-4 w-4" />
                    {t("library.watchOnPlex")}
                  </a>
                )}
              </div>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                // Preserve the source aspect ratio in fullscreen. On an
                // ultrawide monitor this deliberately produces side bars:
                // filling the width would crop the lower part of a 16:9
                // movie and hide player controls/content.
                className="h-full w-full cursor-pointer touch-manipulation object-contain bg-black"
                autoPlay
                playsInline
                onClick={handleVideoClick}
                onTouchEnd={handleVideoTouchEnd}
              />

              {optimizing ? (
                <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center bg-black">
                  <div className="flex flex-col items-center gap-4">
                    <AnimatedLogo size="lg" />
                    <span className="text-xs font-medium text-white/60">{t("player.betaOptimizing")}</span>
                  </div>
                </div>
              ) : (
                buffering && !mseActive && (
                  <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="h-14 w-14 animate-spin rounded-full border-2 border-white/15 border-t-brand-glow" />
                      <span className="text-xs font-medium text-white/60">{t("player.betaLoading")}</span>
                    </div>
                  </div>
                )
              )}

              {skipToast && (
                <div
                  key={skipToast.n}
                  className="pointer-events-none absolute left-1/2 top-[38%] z-50 -translate-x-1/2 animate-toast-pop rounded-full border border-white/10 bg-black/70 px-4 py-2 text-sm font-semibold text-white backdrop-blur-md tabular-nums"
                >
                  {skipToast.delta > 0 ? "+" : "−"}{Math.abs(skipToast.delta)} s
                </div>
              )}

              {!playing && !error && (
                <button
                  onClick={() => { togglePlay(); resetHideTimer(); }}
                  aria-label={t("player.betaPlay")}
                  className="absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 animate-player-pop flex h-24 w-24 items-center justify-center rounded-full glass-strong shadow-[0_0_60px_-10px_color-mix(in_oklab,var(--color-brand-glow)_55%,transparent)] ring-1 ring-white/15 transition-transform duration-150 hover:scale-105 active:scale-95"
                >
                  <span className="flex h-16 w-16 items-center justify-center rounded-full brand-gradient shadow-[0_0_24px_-4px_color-mix(in_oklab,var(--color-brand-glow)_70%,transparent)]">
                    <Play className="ml-0.5 h-8 w-8 fill-white text-white" />
                  </span>
                </button>
              )}

              {mseActive && mseStats && beta.debug && (
                <div className="pointer-events-none absolute bottom-16 left-3 z-30 rounded-lg bg-black/70 px-3 py-2 font-mono text-[10px] leading-relaxed text-white/80">
                  <div>MSE {mseStats.state} · buf {mseStats.bufferedSec.toFixed(1)}s</div>
                  <div>{mseStats.networkMbps.toFixed(1)} Mbps · seg {mseStats.segmentMs.toFixed(0)}ms</div>
                  <div>rebuffer {mseStats.rebufferCount} · errors {mseStats.errors} · start {(mseStats.startupMs / 1000).toFixed(1)}s</div>
                  <div>{(mseStats.fetchedBytes / 1048576).toFixed(1)} MB fetched</div>
                </div>
              )}

              {ffmpegActive && ffmpegStats && beta.debug && (
                <div className="pointer-events-none absolute bottom-16 left-3 z-30 rounded-lg bg-black/70 px-3 py-2 font-mono text-[10px] leading-relaxed text-white/80">
                  <div>FFmpeg remux · actif {ffmpegStats.active ? "oui" : "non"}</div>
                  <div className="truncate max-w-[220px]">{ffmpegStats.src}</div>
                </div>
              )}

              {cacheProgress && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/70">
                  <div className="w-[calc(100vw-2rem)] max-w-xs rounded-2xl glass-strong p-6 text-center shadow-2xl animate-overlay-pop">
                    <p className="text-sm font-semibold text-ink">{t("player.betaCacheFill")}</p>
                    <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full brand-gradient animate-shimmer-progress transition-all duration-300"
                        style={{ width: `${(cacheProgress.current / cacheProgress.target) * 100}%` }}
                      />
                    </div>
                    <p className="mt-3 text-xs tabular-nums text-ink-dim">
                      {cacheProgress.current.toFixed(0)}s / {cacheProgress.target}s
                    </p>
                  </div>
                </div>
              )}

              {activeMarker && !showResume && (
                <button
                  onClick={handleSkipMarker}
                  className="pointer-events-auto absolute bottom-36 right-7 z-50 flex items-center gap-2 rounded-full border border-white/20 bg-[#14131b]/90 px-5 py-3 text-sm font-bold text-white shadow-[0_18px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition hover:scale-[1.03] hover:border-brand-glow/70 hover:bg-[#1b1924] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow/70"
                >
                  {activeMarker.type === "intro" ? "Passer l’intro" : "Passer le générique"}
                </button>
              )}

              {onNextEpisode && mediaType === "episode" && duration > 0 && currentTime >= Math.max(0, duration - 30) && !showResume && (
                <button
                  onClick={onNextEpisode}
                  className="pointer-events-auto absolute bottom-36 right-7 z-50 flex items-center gap-2 rounded-full border border-white/20 bg-[#14131b]/90 px-5 py-3 text-sm font-bold text-white shadow-[0_18px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition hover:scale-[1.03] hover:border-brand-glow/70 hover:bg-[#1b1924] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow/70"
                >
                  <SkipForward className="h-4 w-4" />
                  {t("player.betaNextEpisode")}
                </button>
              )}

              {showResume && (
                <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
                  <div className="w-[calc(100vw-2rem)] max-w-md rounded-[28px] border border-white/12 bg-[#12121a]/92 p-7 text-center shadow-[0_32px_100px_rgba(0,0,0,0.65)] backdrop-blur-2xl animate-overlay-pop">
                    <div className="mx-auto mb-5 h-1.5 w-12 rounded-full brand-gradient shadow-[0_0_18px_color-mix(in_oklab,var(--color-brand-glow)_55%,transparent)]" />
                    <p className="text-lg font-semibold tracking-[-0.02em] text-white">
                      {t("player.betaResumeFrom")} {formatTime(savedPos)}
                    </p>
                    <div className="mt-5 flex items-center justify-center gap-3 flex-wrap">
                      <button
                        onClick={handleResume}
                        className="flex h-12 items-center gap-2 rounded-full brand-gradient px-7 text-sm font-bold text-white shadow-[0_12px_30px_color-mix(in_oklab,var(--color-brand)_28%,transparent)] transition-all duration-150 hover:brightness-110 hover:scale-[1.02] active:scale-[0.97]"
                      >
                        <Play className="h-4 w-4" />
                        {t("player.betaResume")}
                      </button>
                      <button
                        onClick={handleStartOver}
                        className="flex h-12 items-center gap-2 rounded-full border border-white/14 bg-white/8 px-7 text-sm font-semibold text-white transition-all duration-150 hover:border-white/25 hover:bg-white/13 active:scale-[0.97]"
                      >
                        <RotateCcw className="h-4 w-4" />
                        {t("player.betaStartOver")}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {!error && (
                <div
                  aria-hidden={undefined}
                  className={cn(
                    "pointer-events-none absolute inset-x-0 bottom-0 z-40 bg-gradient-to-t from-black/95 via-black/72 to-transparent pt-24 pb-[max(env(safe-area-inset-bottom),0.75rem)] transition-opacity duration-300",
                    controlsVisible || !playing || buffering || menuOpen || showResume ? "opacity-100" : "opacity-0 [&>*]:pointer-events-none"
                  )}
                >
                  <div className="pointer-events-auto mx-auto max-w-[1600px] px-4 sm:px-6">
                    <div className="relative group rounded-[22px] border border-white/10 bg-[#0d0e14]/72 px-4 pt-3 pb-1.5 shadow-[0_12px_40px_rgba(0,0,0,0.28)] backdrop-blur-2xl sm:px-5">
                    <div className="mb-1.5 flex items-center justify-between gap-4 text-[11px] font-medium tabular-nums text-white/72">
                      <span>{formatTime(seekPreview ?? currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                    {scrubPreview && (
                      <div
                        className="pointer-events-none absolute bottom-full mb-3 -translate-x-1/2 flex flex-col items-center"
                        style={{ left: `${Math.min(94, Math.max(6, scrubPreview.ratio * 100))}%` }}
                      >
                        <div className="flex h-[90px] w-[160px] items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/80 shadow-2xl ring-1 ring-black/40 scale-90 transition-transform duration-200 ease-out group-hover:scale-100">
                          {scrubPreview.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={scrubPreview.url} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <Loader2 className="h-4 w-4 animate-spin text-white/50" />
                          )}
                        </div>
                        <span className="mt-1.5 rounded-full border border-white/10 bg-black/70 px-2.5 py-1 text-[11px] font-semibold tabular-nums text-white/90 backdrop-blur-md">
                          {formatTime(scrubPreview.time)}
                        </span>
                      </div>
                    )}
                    <div
                      ref={progressRef}
                      role="slider"
                      aria-label={t("player.betaProgress")}
                      aria-valuemin={0}
                      aria-valuemax={Math.round(duration)}
                      aria-valuenow={Math.round(seekPreview ?? currentTime)}
                      aria-valuetext={formatTime(seekPreview ?? currentTime)}
                      className="group relative h-9 cursor-pointer select-none touch-none"
                      onMouseDown={handleProgressDown}
                      onTouchStart={handleProgressDown}
                      onMouseMove={handleProgressHover}
                      onMouseLeave={handleProgressLeave}
                    >
                      <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 origin-center scale-y-100 rounded-full bg-white/14 shadow-inner transition-transform duration-150 ease-out">
                        <div
                          className="absolute inset-y-0 rounded-full bg-white/20 transition-[width] duration-300 ease-out"
                          style={{ left: `${playedPct}%`, width: `${Math.max(0, bufferedPct - playedPct)}%` }}
                        />
                        <div
                          className="absolute inset-y-0 left-0 origin-left rounded-full bg-[linear-gradient(90deg,var(--color-brand),var(--color-brand-glow))] shadow-[0_0_10px_-2px_color-mix(in_oklab,var(--color-brand-glow)_65%,transparent)]"
                          style={{ transform: `scaleX(${Math.min(100, Math.max(0, playedPct)) / 100})` }}
                        />
                        <div
                          className={cn(
                            "absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#13131b] bg-white shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-brand-glow)_36%,transparent)] transition-transform duration-150",
                            seekPreview !== null || "group-hover:scale-125"
                          )}
                          style={{ left: `${playedPct}%` }}
                        />
                      </div>
                    </div>
                    </div>

                  <div className="pointer-events-auto mt-2 flex flex-wrap items-center gap-1 rounded-[24px] border border-white/10 bg-[#0d0e14]/82 px-2 py-1.5 shadow-[0_18px_50px_rgba(0,0,0,0.42)] backdrop-blur-2xl">
                    <button
                      onClick={togglePlay}
                      className="flex h-11 w-11 items-center justify-center rounded-full brand-gradient text-white shadow-[0_6px_18px_color-mix(in_oklab,var(--color-brand)_30%,transparent)] transition-all duration-200 hover:brightness-110 hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                      aria-label={playing ? t("player.betaPause") : t("player.betaPlay")}
                    >
                      {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                    </button>

                    <button
                      onClick={() => { skip(-10); resetHideTimer(); }}
                      className={iconButtonClass}
                      aria-label={t("player.betaSkipBack")}
                    >
                      <SkipBack className="h-4 w-4" />
                    </button>

                    <button
                      onClick={() => { skip(10); resetHideTimer(); }}
                      className={iconButtonClass}
                      aria-label={t("player.betaSkipForward")}
                    >
                      <SkipForward className="h-4 w-4" />
                    </button>

                    <span className="mx-1 hidden h-5 w-px bg-white/12 sm:block" aria-hidden="true" />

                    <div
                      className="flex items-center"
                      onMouseEnter={() => setShowVolume(true)}
                      onMouseLeave={() => setShowVolume(false)}
                    >
                      <button
                        onClick={toggleMute}
                        className={iconButtonClass}
                        aria-label={muted ? t("player.betaUnmute") : t("player.betaMute")}
                      >
                        {muted || volume === 0
                          ? <VolumeX className="h-5 w-5" />
                          : volume < 0.5
                            ? <Volume1 className="h-5 w-5" />
                            : <Volume2 className="h-5 w-5" />
                        }
                      </button>
                      <div className={cn(
                        "overflow-hidden transition-all duration-200 ease-out max-sm:hidden",
                        showVolume ? "w-24 opacity-100 ml-1" : "w-0 opacity-0"
                      )}>
                        <div
                          ref={volumeTrackRef}
                          className="relative h-1 w-24 cursor-pointer rounded-full bg-white/20"
                          onMouseDown={handleVolumeDown}
                        >
                          <div className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,var(--color-brand),var(--color-brand-glow))]" style={{ width: `${muted ? 0 : volume * 100}%` }} />
                          <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_2px_color-mix(in_oklab,var(--color-brand-glow)_40%,transparent)]" style={{ left: `${muted ? 0 : volume * 100}%` }} />
                        </div>
                      </div>
                    </div>

                    <span className="ml-1 hidden rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] tabular-nums text-white/80 whitespace-nowrap select-none lg:inline">
                      {formatTime(seekPreview ?? currentTime)} / {formatTime(duration)}
                    </span>

                    <div className="flex-1" />

                    {usingFallback && qualityLabel() && (
                      <span className="hidden sm:inline-flex h-6 items-center rounded-full border border-white/10 bg-white/6 px-2.5 text-[10px] font-semibold text-white/75">{qualityLabel()}</span>
                    )}

                    <span className="mx-1 hidden h-5 w-px bg-white/12 md:block" aria-hidden="true" />

                    <div className="relative">
                      <button
                        onClick={() => toggleMenu("quality")}
                        className={iconButtonClass}
                        aria-label={t("player.betaQuality")}
                      >
                        <Monitor className="h-5 w-5" />
                      </button>
                      {menuOpen === "quality" && (
                        <div className={cn(menuPanelClass, "w-max min-w-[10.5rem] animate-menu-pop")}>
                          {QUALITY_PRESETS.map((preset) => (
                            <button
                              key={preset.label}
                              onClick={() => handleQualityChange(preset.maxWidth)}
                              className={cn(
                                "flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left text-[13px] transition-colors duration-150 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow/70",
                                qualityMaxWidthRef.current === preset.maxWidth ? "font-semibold text-brand-glow" : "text-white/75"
                              )}
                            >
                              <span>{preset.label}</span>
                              {qualityMaxWidthRef.current === preset.maxWidth && <Check className="h-3.5 w-3.5 text-brand-glow" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="relative">
                      <button
                        onClick={() => toggleMenu("speed")}
                        className={iconButtonClass}
                        aria-label={t("player.betaSpeed")}
                      >
                        <Gauge className="h-5 w-5" />
                      </button>
                      {menuOpen === "speed" && (
                        <div className={cn(menuPanelClass, "w-28 animate-menu-pop")}>
                          {SPEEDS.map((s) => (
                            <button
                              key={s}
                              onClick={() => setSpeed(s)}
                              className={cn(
                                "flex w-full items-center justify-between gap-2 rounded-xl px-3.5 py-3 text-[13px] transition-colors duration-150 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow/70",
                                playbackRate === s ? "font-semibold text-brand-glow" : "text-white/75"
                              )}
                            >
                              <span>{s}x</span>
                              {playbackRate === s && <Check className="h-3.5 w-3.5 text-brand-glow" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {(usingFallback || ffmpegActive) && (
                      <div className="relative flex items-center gap-1">
                        <button
                          onClick={() => toggleMenu("audio")}
                          disabled={audioStreams.length === 0}
                          className={cn(iconButtonClass, "disabled:opacity-40 disabled:hover:scale-100 disabled:hover:bg-transparent")}
                          title={t("player.betaAudio")}
                          aria-label={t("player.betaAudio")}
                        >
                          <AudioLines className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => toggleMenu("subtitle")}
                          disabled={subtitleStreams.length === 0 && !currentSubtitle}
                          className={cn(iconButtonClass, "disabled:opacity-40 disabled:hover:scale-100 disabled:hover:bg-transparent")}
                          title={t("player.betaSubtitle")}
                          aria-label={t("player.betaSubtitle")}
                        >
                          <Captions className="h-5 w-5" />
                        </button>
                        {menuOpen && (menuOpen === "audio" || menuOpen === "subtitle") && (
                          <div className={cn(menuPanelClass, "max-h-[50vh] w-60 overflow-y-auto animate-menu-pop")}>
                            {menuOpen === "audio" && (
                              <>
                                {audioStreams.map((s) => (
                                  <button
                                    key={s.id}
                                    onClick={() => handleAudioSelect(s.id)}
                                    className={cn(
                                      "flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-left text-[13px] transition-colors duration-150 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow/70",
                                      currentAudio === s.id ? "font-semibold text-brand-glow" : "text-white/75"
                                    )}
                                  >
                                    <span className="truncate">{s.language || s.codec || s.id}</span>
                                    {s.channels ? <span className="text-[10px] opacity-60">{s.channels > 2 ? `${s.channels}.1` : `${s.channels}.0`}</span> : null}
                                  </button>
                                ))}
                              </>
                            )}
                            {menuOpen === "subtitle" && (
                              <>
                                <button
                                  onClick={handleSubtitleOff}
                                  className={cn(
                                      "flex w-full items-center rounded-xl px-3.5 py-3 text-left text-[13px] transition-colors duration-150 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow/70",
                                      !currentSubtitle ? "font-semibold text-brand-glow" : "text-white/75"
                                  )}
                                >
                                  {t("player.betaOff")}
                                </button>
                                {subtitleStreams.map((s) => (
                                  <button
                                    key={s.id}
                                    onClick={() => handleSubtitleSelect(s.id)}
                                    className={cn(
                                      "flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-left text-[13px] transition-colors duration-150 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow/70",
                                      currentSubtitle === s.id ? "font-semibold text-brand-glow" : "text-white/75"
                                    )}
                                  >
                                    <span className="truncate">{s.language || s.codec || s.id}</span>
                                  </button>
                                ))}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {directMode && (
                      <button
                        onClick={handleReturnToHls}
                        className={cn(iconButtonClass, "hover:text-amber")}
                        title={t("player.betaReturnHls")}
                        aria-label={t("player.betaReturnHls")}
                      >
                        <AlertTriangle className="h-5 w-5" />
                      </button>
                    )}

                    {pipSupported && (
                      <button
                        onClick={togglePiP}
                        className={iconButtonClass}
                        aria-label={t("player.betaPiP")}
                      >
                        <PictureInPicture2 className="h-5 w-5" />
                      </button>
                    )}

                    <button
                      onClick={toggleFullscreen}
                      className={iconButtonClass}
                      aria-label={fullscreen ? t("player.betaExitFullscreen") : t("player.betaFullscreen")}
                    >
                      {fullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                    </button>
                  </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
