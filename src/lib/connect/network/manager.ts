import { createHash } from "node:crypto";
import { eventBus } from "@/lib/events/EventBus";
import { resolveConnectPlay } from "@/lib/connect/resolve";
import { castProfileFor, contentTypeFor, createCastMedia } from "@/lib/connect/castMedia";
import { resolveEpisodePlayback, resolveMoviePlayback } from "@/lib/playback/sourceResolver";
import { getOrProbeMediaDescriptor } from "@/lib/playback/engine/mediaProbeCache";
import { applyHeartbeat, openPlaybackSession, stopPlayback } from "@/lib/playback/progressStore";
import type { ConnectCommand, ConnectDevice, ReceiverState } from "@/lib/connect/types";
import { searchDlnaRenderers, type DlnaRenderer } from "./ssdp";
import { searchCastReceivers, type CastReceiverInfo } from "./mdns";
import { dlnaLoad, dlnaPause, dlnaPlay, dlnaSeek, dlnaStatus, dlnaStop } from "./dlna";
import { CastSession, type CastMediaStatus } from "./castv2";

/**
 * Écrans du réseau local trouvés par le serveur : Chromecast / Google Cast
 * (mDNS) et téléviseurs DLNA (SSDP). Ils lisent une URL de lecture signée,
 * pilotée ensuite depuis l'icône Caster comme une app Movviz.
 *
 * Le serveur doit être sur le même réseau que ces écrans (Docker : mode réseau
 * « host », sinon les annonces multicast ne lui parviennent pas).
 */

type Target =
  | { via: "chromecast"; id: string; name: string; info: CastReceiverInfo }
  | { via: "dlna"; id: string; name: string; info: DlnaRenderer };

interface NetSession {
  userId: string;
  target: Target;
  title: string;
  mediaType: "movie" | "series";
  tmdbId: number;
  season?: number;
  episode?: number;
  /** Chromecast (remux non navigable) : position du début du flux en cours. */
  offset: number;
  mediaUrl: string;
  remux: boolean;
  durationSec: number;
  state: ReceiverState;
  cast: CastSession | null;
  poll: ReturnType<typeof setInterval> | null;
  progress: { sessionId: string; sequence: number; lastAt: number } | null;
  ended: boolean;
}

const holder = globalThis as typeof globalThis & {
  __movvizNetDevices?: { targets: Map<string, Target>; scannedAt: number; scanning: Promise<void> | null };
  __movvizNetSessions?: Map<string, NetSession>;
};
const net = (holder.__movvizNetDevices ??= { targets: new Map(), scannedAt: 0, scanning: null });
const sessions = (holder.__movvizNetSessions ??= new Map<string, NetSession>());

const RESCAN_MS = 60_000;
export const NETWORK_ID_RE = /^(cast|dlna)_[0-9a-f]{24}$/;

export function discoveryEnabled(): boolean {
  return process.env.MOVVIZ_CONNECT_DISCOVERY !== "0";
}

const idFor = (prefix: "cast" | "dlna", key: string) => `${prefix}_${createHash("sha1").update(key).digest("hex").slice(0, 24)}`;

async function scan(): Promise<void> {
  const [casts, dlnas] = await Promise.all([
    searchCastReceivers().catch(() => [] as CastReceiverInfo[]),
    searchDlnaRenderers().catch(() => [] as DlnaRenderer[]),
  ]);
  const next = new Map<string, Target>();
  for (const c of casts) {
    if (!c.video) continue;
    const id = idFor("cast", c.id);
    next.set(id, { via: "chromecast", id, name: c.name, info: c });
  }
  for (const d of dlnas) {
    const id = idFor("dlna", d.udn);
    // Un téléviseur à la fois Google Cast et DLNA : une seule ligne, la voie Cast (pilotage plus fiable).
    if ([...next.values()].some((t) => t.name.toLowerCase() === d.name.toLowerCase())) continue;
    next.set(id, { via: "dlna", id, name: d.name, info: d });
  }
  // Un écran en cours d'utilisation reste listé même s'il n'a pas répondu à ce passage.
  for (const s of sessions.values()) if (!next.has(s.target.id)) next.set(s.target.id, s.target);
  net.targets = next;
  net.scannedAt = Date.now();
}

/** Relance la recherche si elle date ; attend au plus `waitMs` la première. */
async function fresh(waitMs: number): Promise<void> {
  if (!discoveryEnabled()) return;
  if (Date.now() - net.scannedAt > RESCAN_MS && !net.scanning) {
    net.scanning = scan().finally(() => { net.scanning = null; });
  }
  if (net.scannedAt === 0 && net.scanning) {
    await Promise.race([net.scanning, new Promise((r) => setTimeout(r, waitMs))]);
  }
}

export async function listNetworkDevices(userId: string): Promise<ConnectDevice[]> {
  await fresh(3000);
  return [...net.targets.values()].map((t) => {
    const s = sessions.get(t.id);
    // L'état n'est montré qu'à celui qui a lancé la lecture.
    const state = s && s.userId === userId ? s.state : null;
    return { id: t.id, name: t.name, kind: "network" as const, via: t.via, receiver: true, online: true, state };
  });
}

export function isNetworkDevice(id: string): boolean {
  return NETWORK_ID_RE.test(id);
}

function publish(s: NetSession, patch: Partial<ReceiverState>) {
  s.state = { ...s.state, ...patch, updatedAt: Date.now() };
  eventBus.emit({ type: "connect_state", userId: s.userId, deviceId: s.target.id, state: s.state });
  trackProgress(s);
}

/** Avancement et « Vu » comme pour une lecture Movviz : la règle reste décidée par le serveur. */
function trackProgress(s: NetSession) {
  if (!s.progress) return;
  const now = Date.now();
  const playing = s.state.status === "playing";
  if (now - s.progress.lastAt < 10_000 && s.state.status !== "idle") return;
  s.progress.lastAt = now;
  try {
    applyHeartbeat(s.progress.sessionId, { sequence: ++s.progress.sequence, positionMs: Math.round(s.state.position * 1000), isPlaying: playing });
  } catch { /* session de progression expirée */ }
}

function endSession(s: NetSession, finished: boolean) {
  if (s.ended) return;
  s.ended = true;
  if (s.poll) clearInterval(s.poll);
  s.poll = null;
  if (s.progress) {
    try { stopPlayback(s.progress.sessionId, Math.round((finished ? s.durationSec || s.state.position : s.state.position) * 1000)); } catch { /* déjà close */ }
  }
  s.cast?.close();
  sessions.delete(s.target.id);
  eventBus.emit({ type: "connect_state", userId: s.userId, deviceId: s.target.id, state: { status: "idle", position: 0, duration: 0, updatedAt: Date.now() } });
}

function onCastStatus(s: NetSession, status: CastMediaStatus) {
  const state = status.playerState;
  if (state === "IDLE") {
    // « Terminé » ne compte que près de la vraie fin : un écran qui ne décode pas le flux saute aussi à « FINISHED ».
    const position = s.offset + status.currentTime;
    const reallyFinished = status.idleReason === "FINISHED" && s.durationSec > 0 && position >= s.durationSec - 120;
    if (status.idleReason === "FINISHED" || status.idleReason === "CLOSED" || status.idleReason === "ERROR" || status.idleReason === "CANCELLED") endSession(s, reallyFinished);
    return;
  }
  publish(s, {
    status: state === "PLAYING" ? "playing" : state === "PAUSED" ? "paused" : "buffering",
    position: Math.round((s.offset + status.currentTime) * 10) / 10,
    duration: s.durationSec || (status.duration ? s.offset + status.duration : 0),
  });
}

async function castLoad(s: NetSession, startSec: number) {
  const info = s.target.info as CastReceiverInfo;
  const cast = s.cast ?? new CastSession(info.host, info.port);
  if (!s.cast) {
    s.cast = cast;
    cast.on("status", (status: CastMediaStatus) => onCastStatus(s, status));
    cast.on("close", () => { if (!s.ended && s.cast === cast) endSession(s, false); });
  }
  s.offset = startSec;
  const url = startSec > 0 ? `${s.mediaUrl}?t=${Math.floor(startSec)}` : s.mediaUrl;
  await cast.load(url, { title: s.title, posterUrl: null, contentType: "video/mp4", durationSec: s.durationSec ? Math.max(0, s.durationSec - startSec) : null });
}

export interface NetworkPlayResult { ok: true }

/** « Lire » sur un écran réseau : fichier local, URL signée, chargement, suivi de l'état. */
export async function networkPlay(userId: string, deviceId: string, command: Extract<ConnectCommand, { kind: "play" }>, publicBase: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await fresh(3000);
  const target = net.targets.get(deviceId);
  if (!target) return { ok: false, error: "device_offline" };
  const resolved = resolveConnectPlay(userId, command);
  if (!resolved) return { ok: false, error: "not_playable" };
  const item = resolved.queue[resolved.startIndex];
  const t = resolved.target;
  const source = t.type === "movie" ? resolveMoviePlayback(t.movvizId) : resolveEpisodePlayback(t.seriesId ?? "", t.seasonNumber ?? 0, t.episodeNumber ?? 0);
  const path = source.ok && source.value.source === "movviz" ? source.value.path : null;
  // Les écrans réseau lisent le fichier Movviz ; une copie seulement sur Plex n'est pas servie ainsi.
  if (!path || !item) return { ok: false, error: "local_file_required" };

  const previous = sessions.get(deviceId);
  if (previous) endSession(previous, false);

  const descriptor = await getOrProbeMediaDescriptor(t.movvizId, path).catch(() => null);
  const durationSec = descriptor?.durationMs ? descriptor.durationMs / 1000 : 0;
  const remux = target.via === "chromecast";
  const profile = castProfileFor(target.via === "chromecast" ? target.info.model : null, {
    videoCodec: descriptor?.video.codec, bitDepth: descriptor?.video.bitDepth, width: descriptor?.video.width,
    hdr: !!descriptor?.video.hdr, audioCodec: descriptor?.audioTracks[0]?.codec,
  });
  const label = t.seasonNumber != null ? `${t.title} — S${t.seasonNumber} E${t.episodeNumber}${t.episodeTitle ? ` · ${t.episodeTitle}` : ""}` : t.title;
  const token = createCastMedia({ userId, path, mode: remux ? "remux" : "direct", title: label, transcodeAudio: remux && profile.transcodeAudio, video: remux ? profile.video : null, durationSec: durationSec || null });
  const mediaUrl = `${publicBase.replace(/\/$/, "")}/api/connect/media/${token}`;
  const start = resolved.resumeSeconds ?? 0;

  const s: NetSession = {
    userId, target, title: label, mediaType: t.type, tmdbId: t.tmdbId,
    ...(t.seasonNumber != null ? { season: t.seasonNumber, episode: t.episodeNumber } : {}),
    offset: 0, mediaUrl, remux, durationSec,
    state: { status: "loading", title: t.title, mediaType: t.type, tmdbId: t.tmdbId, ...(t.seasonNumber != null ? { season: t.seasonNumber, episode: t.episodeNumber } : {}), position: start, duration: durationSec, updatedAt: Date.now() },
    cast: null, poll: null, progress: null, ended: false,
  };
  sessions.set(deviceId, s);
  publish(s, {});
  try {
    const opened = openPlaybackSession(userId, {
      ratingKey: item.ratingKey, mediaId: t.movvizId, mediaType: t.type === "movie" ? "movie" : "episode",
      durationMs: Math.round(durationSec * 1000), tmdbId: t.tmdbId, seasonNumber: t.seasonNumber, episodeNumber: t.episodeNumber, title: t.title,
    });
    s.progress = { sessionId: opened.session.id, sequence: 0, lastAt: 0 };
  } catch { /* le suivi d'avancement est un plus, jamais un blocage */ }

  try {
    if (target.via === "chromecast") {
      await castLoad(s, start);
      s.poll = setInterval(() => { void s.cast?.refresh().catch(() => {}); }, 2000);
    } else {
      const r = target.info;
      await dlnaLoad(r, mediaUrl, label, contentTypeFor(path), null);
      if (start > 0) setTimeout(() => { void dlnaSeek(r, start).catch(() => {}); }, 2500);
      s.poll = setInterval(() => {
        void dlnaStatus(r).then((st) => {
          if (st.state === "idle" && s.state.status !== "loading") { endSession(s, s.durationSec > 0 && s.state.position >= s.durationSec - 30); return; }
          if (st.state === "idle") return;
          publish(s, { status: st.state, position: st.position, duration: st.duration || s.durationSec });
        }).catch(() => {});
      }, 2000);
    }
    return { ok: true };
  } catch (error) {
    endSession(s, false);
    return { ok: false, error: error instanceof Error && /^cast_|^dlna_/.test(error.message) ? error.message : "device_refused" };
  }
}

/** Pause, reprendre, aller à, arrêter sur un écran réseau. */
export async function networkControl(userId: string, deviceId: string, command: Exclude<ConnectCommand, { kind: "play" }>): Promise<boolean> {
  const s = sessions.get(deviceId);
  if (!s || s.userId !== userId) return false;
  try {
    if (s.target.via === "chromecast") {
      if (command.kind === "pause") await s.cast?.pause();
      else if (command.kind === "resume") await s.cast?.play();
      else if (command.kind === "stop") { await s.cast?.stop(); endSession(s, false); }
      // Flux remux non navigable : le Chromecast recharge à la nouvelle position.
      else if (command.kind === "seek") { publish(s, { status: "buffering", position: command.seconds }); await castLoad(s, command.seconds); }
    } else {
      const r = s.target.info;
      if (command.kind === "pause") { await dlnaPause(r); publish(s, { status: "paused" }); }
      else if (command.kind === "resume") { await dlnaPlay(r); publish(s, { status: "playing" }); }
      else if (command.kind === "stop") { await dlnaStop(r).catch(() => {}); endSession(s, false); }
      else if (command.kind === "seek") { await dlnaSeek(r, command.seconds); publish(s, { position: command.seconds }); }
    }
    return true;
  } catch {
    return false;
  }
}
