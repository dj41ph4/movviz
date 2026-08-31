/**
 * Phase 7 of the playback engine rewrite (see PLAN_REFONTE_MOTEUR_LECTURE_MOVVIZ.md
 * §35-36). Tracks one live PlaybackSession per active playback of the NEW
 * engine — entirely separate from the CURRENT production session store
 * (src/lib/playback/progressStore.ts, /api/playback/sessions/*), which stays
 * untouched until a later migration phase actually switches the live player
 * over. CONFIRMED LIVE: /api/playback/prepare (Phase 8) calls createSession()
 * on every real playback start from src/components/player/VideoPlayer.tsx —
 * this module is in active use, not just its own tests.
 *
 * In-memory only, on globalThis (same reasoning as src/lib/jobs/queue.ts —
 * Next.js bundles modules per route, so cross-route shared state has to live
 * there or two requests would each see their own empty Map). A session is
 * inherently ephemeral (it only matters while something is actually
 * playing), so unlike the JSON stores elsewhere in this app there is
 * deliberately no disk persistence — losing sessions on a server restart is
 * correct, not a bug: playback itself doesn't survive a restart either.
 */

import type { ClientType } from "./clientProfile";
import type { PlaybackMode, PlaybackPlan, SubtitleAction, TrackAction } from "./playbackPlan";

export type PlaybackSessionSource =
  | { type: "local"; uri: string; localPath: string; sourceKey: string }
  | { type: "plex_raw"; uri: string; headers: Record<string, string>; ratingKey: string; sourceKey: string };

export interface PlaybackSession {
  sessionId: string;
  userId: string;
  deviceId: string;
  clientType: ClientType;
  mediaId: string;
  source: PlaybackSessionSource;

  mode: PlaybackMode;
  selectedAudio: number | null;
  selectedSubtitle: number | null;
  videoAction: TrackAction;
  audioAction: TrackAction;
  subtitleAction: SubtitleAction;
  /**
   * The full plan decidePlayback() produced — the decomposed fields above
   * mirror its top-level shape for convenience (debug overlay, §52) but
   * don't carry targetVideoCodec/videoEncoderImpl/encoderPreset/
   * targetAudioCodec. A later route (the actual stream endpoint, Phase 9-13)
   * needs those exact values to execute the plan without re-deciding — and
   * re-deciding isn't even possible there without also persisting the
   * client's full declared capabilities, which this session intentionally
   * does not store (§56: the server already resolved everything it needs,
   * nothing beyond mediaId should have to round-trip again).
   */
  plan: PlaybackPlan;

  createdAt: number;
  lastActivity: number;
  /** Last known playback position, milliseconds — updated via touchSession(). */
  position: number;
  /** Set once a real transcode process backs this session (Phase 12+) — null until then. */
  transcoderPid: number | null;
  /** How many times this exact session recalculated its plan after a failed attempt (§43). */
  fallbackCount: number;
}

export interface CreateSessionInput {
  userId: string;
  deviceId: string;
  clientType: ClientType;
  mediaId: string;
  source?: PlaybackSessionSource;
  mode: PlaybackMode;
  selectedAudio?: number | null;
  selectedSubtitle?: number | null;
  videoAction: TrackAction;
  audioAction: TrackAction;
  subtitleAction: SubtitleAction;
  plan: PlaybackPlan;
}

// §36 — "aucune activité depuis 5 minutes" — configurable per that section's
// own requirement, same MOVVIZ_* env-var convention as the ffmpeg path/probe
// settings elsewhere in this engine.
const DEFAULT_TTL_MS = 5 * 60 * 1000;
function sessionTtlMs(): number {
  const raw = process.env.MOVVIZ_PLAYBACK_SESSION_TTL_MS;
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTL_MS;
}

type CleanupHook = (session: PlaybackSession) => void;

interface SessionState {
  sessions: Map<string, PlaybackSession>;
  /** Registered by a later phase (real transcoder — Phase 12) to kill a
   *  process / delete temp files when a session expires. Injected rather
   *  than imported directly so this file never has to know a transcoder
   *  exists — matches "aucune couche ne doit connaître plus que nécessaire" (§3). */
  cleanupHooks: CleanupHook[];
  cleanupTimer: ReturnType<typeof setInterval> | null;
}

// Deliberately NOT __movvizPlaybackSessions — progressStore.ts (the CURRENT
// production session store, unrelated PlaybackSession shape) already owns
// that exact key as a bare Map. Confirmed live: the collision made this
// module's `??=` bind to the OTHER store's Map (already set first, since
// the old system's session opens on every player mount before this new
// engine ever runs), so `state.sessions` was undefined at runtime — a real
// crash caught during Phase 9-13 browser verification, not a hypothetical.
const g = globalThis as typeof globalThis & { __movvizPlaybackEngineSessions?: SessionState };
const state: SessionState = (g.__movvizPlaybackEngineSessions ??= { sessions: new Map(), cleanupHooks: [], cleanupTimer: null });

function nextSessionId(): string {
  return `pbs_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export function createSession(input: CreateSessionInput): PlaybackSession {
  const now = Date.now();
  const session: PlaybackSession = {
    sessionId: nextSessionId(),
    userId: input.userId,
    deviceId: input.deviceId,
    clientType: input.clientType,
    mediaId: input.mediaId,
    source: input.source ?? { type: "local", uri: input.mediaId, localPath: input.mediaId, sourceKey: "local" },
    mode: input.mode,
    selectedAudio: input.selectedAudio ?? null,
    selectedSubtitle: input.selectedSubtitle ?? null,
    videoAction: input.videoAction,
    audioAction: input.audioAction,
    subtitleAction: input.subtitleAction,
    plan: input.plan,
    createdAt: now,
    lastActivity: now,
    position: 0,
    transcoderPid: null,
    fallbackCount: 0,
  };
  state.sessions.set(session.sessionId, session);
  ensureCleanupTimer();
  return session;
}

export function getSession(sessionId: string): PlaybackSession | null {
  return state.sessions.get(sessionId) ?? null;
}

/** Heartbeat + position update in one call — every real client call site
 *  (seek, progress ping, track switch) needs both together. */
export function touchSession(sessionId: string, positionMs?: number): PlaybackSession | null {
  const session = state.sessions.get(sessionId);
  if (!session) return null;
  session.lastActivity = Date.now();
  if (positionMs !== undefined) session.position = positionMs;
  return session;
}

/** §43 — the plan recalculated after a failed attempt on this same session, one step down the cascade. */
export function recordFallbackAttempt(sessionId: string, nextMode: PlaybackMode): PlaybackSession | null {
  const session = state.sessions.get(sessionId);
  if (!session) return null;
  session.fallbackCount++;
  session.mode = nextMode;
  session.lastActivity = Date.now();
  return session;
}

export function setTranscoderPid(sessionId: string, pid: number | null): PlaybackSession | null {
  const session = state.sessions.get(sessionId);
  if (!session) return null;
  session.transcoderPid = pid;
  return session;
}

/** Registers a cleanup hook (e.g. "kill this session's transcoder, delete its
 *  temp segments") — called for every session removed, whether by explicit
 *  endSession() or by TTL expiry, so a later phase only has to implement it once. */
export function onSessionCleanup(hook: CleanupHook): void {
  state.cleanupHooks.push(hook);
}

function removeSession(session: PlaybackSession): void {
  state.sessions.delete(session.sessionId);
  for (const hook of state.cleanupHooks) {
    try {
      hook(session);
    } catch (err) {
      console.error(`[playback-session] cleanup hook a échoué pour ${session.sessionId}:`, err);
    }
  }
}

export function endSession(sessionId: string): boolean {
  const session = state.sessions.get(sessionId);
  if (!session) return false;
  removeSession(session);
  return true;
}

/** §36 — purge automatique. Exported directly (not just via the timer) so
 *  tests can assert the sweep itself without waiting on a real interval. */
export function sweepExpiredSessions(now: number = Date.now()): number {
  const ttl = sessionTtlMs();
  let purged = 0;
  for (const session of [...state.sessions.values()]) {
    if (now - session.lastActivity > ttl) {
      removeSession(session);
      purged++;
    }
  }
  return purged;
}

function ensureCleanupTimer(): void {
  if (state.cleanupTimer) return;
  // Sweep on a fraction of the TTL so an expired session never lingers much
  // longer than the TTL itself — unref'd so this timer never keeps the
  // process alive on its own (matches how dev-server hot reload expects
  // background timers to behave).
  const timer = setInterval(() => sweepExpiredSessions(), Math.min(sessionTtlMs(), 60_000));
  timer.unref?.();
  state.cleanupTimer = timer;
}

/** Every session currently tracked. Originally test/diagnostic only, now also
 *  read by the admin "Sessions actives" widget's native-Movviz panel (see
 *  src/app/api/movviz/activity/route.ts) to enrich progressStore's heartbeat
 *  sessions with device/mode info this store alone has (see that module's
 *  own top comment — confirmed live via /api/playback/prepare). */
export function listSessions(): PlaybackSession[] {
  return [...state.sessions.values()];
}
