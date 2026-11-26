"use client";

import type { ReceiverState } from "@/lib/connect/types";
import type { CastPayload } from "@/lib/connect/ConnectProvider";
import type { CastStage } from "@/lib/connect/castProgress";

/**
 * Google Cast vu par le NAVIGATEUR (SDK officiel « Web Sender » de Chrome) : les
 * écrans sont ceux du réseau où se trouve l'utilisateur, pas celui du serveur.
 * Chez un ami, à l'hôtel, en 4G partagée : Chrome trouve le Chromecast, le
 * serveur fournit un lien public signé (/api/connect/link) et l'écran va
 * chercher la vidéo lui-même. Le flux est un remux non navigable : un saut
 * recharge à la nouvelle position (`?t=`).
 */

const SDK_URL = "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";

interface Link {
  url: string;
  contentType: string;
  title: string;
  subtitle: string | null;
  posterUrl: string | null;
  durationSec: number;
  startSec: number;
  progressSessionId: string | null;
}

export interface GoogleCastSnapshot {
  /** SDK chargé et au moins un écran visible sur ce réseau (ou une session en cours). */
  available: boolean;
  connected: boolean;
  deviceName: string | null;
  state: ReceiverState | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- SDK chargé dynamiquement, sans types publiés ici. */
type Win = Window & { cast?: any; chrome?: any; __onGCastApiAvailable?: (ok: boolean) => void };

let snapshot: GoogleCastSnapshot = { available: false, connected: false, deviceName: null, state: null };
const listeners = new Set<() => void>();
let loading = false;
let ready = false;
let current: { link: Link; payload: CastPayload; offset: number; sequence: number; lastBeat: number; started: boolean } | null = null;
let player: any = null;
let controller: any = null;

function emit(patch: Partial<GoogleCastSnapshot>) {
  snapshot = { ...snapshot, ...patch };
  for (const fn of listeners) fn();
}

export function subscribeGoogleCast(fn: () => void): () => void {
  listeners.add(fn);
  ensureLoaded();
  return () => listeners.delete(fn);
}
export const getGoogleCast = () => snapshot;
const SERVER_SNAPSHOT: GoogleCastSnapshot = { available: false, connected: false, deviceName: null, state: null };
export const getGoogleCastServer = () => SERVER_SNAPSHOT;

/** Chrome / Edge (Chromium) en contexte sécurisé : seuls navigateurs où le SDK fonctionne. */
function supported(): boolean {
  if (typeof window === "undefined" || !window.isSecureContext) return false;
  const w = window as Win;
  // Chromium (Chrome, Edge…) sur ordinateur ou Android ; le SDK confirme lui-même ensuite.
  return !!w.chrome && !/CriOS|FxiOS|Firefox\//.test(navigator.userAgent);
}

function ensureLoaded() {
  if (loading || ready || !supported()) return;
  loading = true;
  const w = window as Win;
  w.__onGCastApiAvailable = (ok: boolean) => {
    if (!ok || !w.cast?.framework) return;
    void setup().then(() => { ready = true; });
  };
  const script = document.createElement("script");
  script.src = SDK_URL;
  script.async = true;
  script.onerror = () => { loading = false; };
  document.head.appendChild(script);
}

/** Récepteur aux couleurs de Movviz s'il est configuré (MOVVIZ_CAST_APP_ID), sinon celui de Google. */
async function receiverAppId(fallback: string): Promise<string> {
  try {
    // Délai borné : un serveur lent ne doit jamais laisser le bouton Cast inutilisable.
    const res = await fetch("/api/connect/cast-config", { cache: "no-store", signal: AbortSignal.timeout(3000) });
    const body = (await res.json()) as { appId?: string | null };
    return typeof body.appId === "string" && /^[0-9A-F]{8}$/.test(body.appId) ? body.appId : fallback;
  } catch {
    return fallback;
  }
}

async function setup() {
  const w = window as Win;
  const fw = w.cast.framework;
  const ctx = fw.CastContext.getInstance();
  ctx.setOptions({
    receiverApplicationId: await receiverAppId(w.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID),
    autoJoinPolicy: w.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
  });
  const syncCastState = () => {
    const state = ctx.getCastState();
    const session = ctx.getCurrentSession();
    emit({
      available: state !== fw.CastState.NO_DEVICES_AVAILABLE,
      connected: state === fw.CastState.CONNECTED,
      deviceName: session?.getCastDevice()?.friendlyName ?? null,
    });
    if (state !== fw.CastState.CONNECTED && current) finish(false);
  };
  ctx.addEventListener(fw.CastContextEventType.CAST_STATE_CHANGED, syncCastState);
  syncCastState();

  player = new fw.RemotePlayer();
  controller = new fw.RemotePlayerController(player);
  controller.addEventListener(fw.RemotePlayerEventType.ANY_CHANGE, () => publish());
}

function publish() {
  if (!player || !snapshot.connected) return;
  const w = window as Win;
  const ps = w.chrome?.cast?.media?.PlayerState;
  const media = player.mediaInfo;
  if (!current || !media) {
    emit({ state: current ? { status: "loading", title: current.payload.title, position: current.offset, duration: current.link.durationSec, updatedAt: Date.now() } : null });
    return;
  }
  const raw = player.playerState;
  const status: ReceiverState["status"] = raw === ps?.PLAYING ? "playing" : raw === ps?.PAUSED ? "paused" : raw === ps?.BUFFERING ? "buffering" : raw === ps?.IDLE ? "idle" : "loading";
  const position = current.offset + (Number(player.currentTime) || 0);
  if (status === "playing" || status === "paused") current.started = true;
  if (status === "idle" && current.started) {
    // Fin du film ou arrêt depuis l'écran lui-même.
    finish(current.link.durationSec > 0 && position >= current.link.durationSec - 30);
    return;
  }
  const p = current.payload;
  emit({
    state: {
      status, title: p.title, mediaType: p.mediaType, tmdbId: p.tmdbId,
      ...(p.season != null && p.episode != null ? { season: p.season, episode: p.episode } : {}),
      position, duration: current.link.durationSec || current.offset + (Number(player.duration) || 0), updatedAt: Date.now(),
    },
  });
  heartbeat(position, status === "playing");
}

function heartbeat(position: number, playing: boolean) {
  const c = current;
  if (!c?.link.progressSessionId) return;
  const now = Date.now();
  if (now - c.lastBeat < 10_000) return;
  c.lastBeat = now;
  void fetch(`/api/playback/sessions/${c.link.progressSessionId}/heartbeat`, {
    method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
    body: JSON.stringify({ sequence: ++c.sequence, positionMs: Math.round(position * 1000), isPlaying: playing, mode: "google-cast" }),
  }).catch(() => {});
}

function finish(completed: boolean) {
  const c = current;
  current = null;
  emit({ state: null });
  if (!c?.link.progressSessionId) return;
  const position = completed ? c.link.durationSec : snapshot.state?.position ?? c.offset;
  void fetch(`/api/playback/sessions/${c.link.progressSessionId}/stop`, {
    method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
    body: JSON.stringify({ positionMs: Math.round(position * 1000) }),
  }).catch(() => {});
}

async function load(startSec: number) {
  const w = window as Win;
  const c = current;
  const session = w.cast?.framework.CastContext.getInstance().getCurrentSession();
  if (!c || !session) throw new Error("no_session");
  const m = w.chrome.cast.media;
  const url = startSec > 0 ? `${c.link.url}?t=${Math.floor(startSec)}` : c.link.url;
  const info = new m.MediaInfo(url, c.link.contentType);
  info.streamType = m.StreamType.BUFFERED;
  if (c.link.durationSec > 0) info.duration = Math.max(1, c.link.durationSec - startSec);
  const meta = c.payload.mediaType === "series" ? new m.TvShowMediaMetadata() : new m.MovieMediaMetadata();
  meta.title = c.link.subtitle ? `${c.link.title} — ${c.link.subtitle}` : c.link.title;
  if (c.payload.mediaType === "series") {
    meta.seriesTitle = c.link.title;
    if (c.payload.season != null) meta.season = c.payload.season;
    if (c.payload.episode != null) meta.episode = c.payload.episode;
  }
  if (c.link.posterUrl) meta.images = [new w.chrome.cast.Image(c.link.posterUrl)];
  info.metadata = meta;
  const request = new m.LoadRequest(info);
  request.autoplay = true;
  request.currentTime = 0;
  c.offset = startSec;
  c.started = false;
  emit({ state: { status: "loading", title: c.payload.title, position: startSec, duration: c.link.durationSec, updatedAt: Date.now() } });
  await session.loadMedia(request);
}

export type GoogleCastResult = "ok" | "cancelled" | "failed" | "local_file_required";

/**
 * Ouvre le sélecteur d'écrans de Chrome (doit partir d'un clic), puis envoie le
 * titre. Le sélecteur passe d'abord : le geste de l'utilisateur ne doit pas être
 * consommé par la requête réseau.
 */
export async function castWithGoogleCast(
  payload: CastPayload,
  /** Étape en cours, pour l'animation du panneau (nom de l'écran dès qu'il est connu). */
  onStage: (stage: CastStage, deviceName?: string) => void = () => {},
): Promise<GoogleCastResult> {
  const w = window as Win;
  if (!ready || !w.cast?.framework) return "failed";
  const ctx = w.cast.framework.CastContext.getInstance();
  if (!ctx.getCurrentSession()) {
    onStage("picking");
    try {
      await ctx.requestSession();
    } catch {
      return "cancelled";
    }
  }
  const name = ctx.getCurrentSession()?.getCastDevice()?.friendlyName as string | undefined;
  try {
    onStage("preparing", name);
    const response = await fetch("/api/connect/link", {
      method: "POST", headers: { "content-type": "application/json" }, credentials: "same-origin",
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) return body?.error === "local_file_required" ? "local_file_required" : "failed";
    if (current) finish(false);
    current = { link: body as Link, payload, offset: 0, sequence: 0, lastBeat: 0, started: false };
    onStage("launching", name);
    await load(current.link.startSec);
    // Chargé ne veut pas dire lancé : on attend la lecture (ou la pause) rapportée par l'écran.
    onStage("waiting", name);
    const deadline = Date.now() + 20_000;
    while (current && !current.started && Date.now() < deadline) await new Promise((r) => setTimeout(r, 400));
    return current ? "ok" : "failed";
  } catch {
    if (current) finish(false);
    return "failed";
  }
}

export async function controlGoogleCast(command: { kind: "pause" } | { kind: "resume" } | { kind: "stop" } | { kind: "seek"; seconds: number }): Promise<boolean> {
  const w = window as Win;
  if (!controller || !player) return false;
  try {
    if (command.kind === "pause") { if (!player.isPaused) controller.playOrPause(); }
    else if (command.kind === "resume") { if (player.isPaused) controller.playOrPause(); }
    else if (command.kind === "stop") {
      finish(false);
      w.cast?.framework.CastContext.getInstance().endCurrentSession(true);
    } else if (current) await load(Math.max(0, command.seconds));
    return true;
  } catch {
    return false;
  }
}
/* eslint-enable @typescript-eslint/no-explicit-any */
