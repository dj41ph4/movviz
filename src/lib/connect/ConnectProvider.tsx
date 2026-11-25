"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useI18n } from "@/i18n/provider";
import { toast } from "@/components/ui/Toast";
import { useBetaPlayer } from "@/lib/settings/useBetaPlayer";
import {
  CONNECT_EVENT,
  defaultDeviceName,
  detectDeviceKind,
  getDeviceId,
  readReceiverEnabled,
  setReceiverEnabled as storeReceiverEnabled,
  subscribeReceiverEnabled,
  type ConnectEventDetail,
} from "./client";
import { playerBridge } from "./playerBridge";
import type { ConnectCommand, ConnectDevice, ReceiverState, ReceiverStatus } from "./types";

/** Ce qu'un bouton « Caster » envoie : le titre à lire (et l'épisode / la position si connus). */
export interface CastPayload {
  title: string;
  mediaType: "movie" | "series";
  tmdbId: number;
  season?: number;
  episode?: number;
  resumeSeconds?: number;
  fromBeginning?: boolean;
}

type ControlCommand = Exclude<ConnectCommand, { kind: "play" }>;

interface ConnectContextValue {
  ready: boolean;
  selfId: string | null;
  /** Autres appareils en ligne qui acceptent une lecture. */
  receivers: ConnectDevice[];
  receiverEnabled: boolean;
  setReceiverEnabled: (on: boolean) => void;
  /** Appareil auquel cet appareil a envoyé la dernière lecture (télécommande). */
  controlledId: string | null;
  sendPlay: (device: ConnectDevice, payload: CastPayload) => Promise<boolean>;
  sendControl: (device: ConnectDevice, command: ControlCommand) => Promise<boolean>;
  refresh: () => void;
}

const ConnectCtx = createContext<ConnectContextValue | null>(null);

export function useConnect(): ConnectContextValue | null {
  return useContext(ConnectCtx);
}

const noopSubscribe = () => () => {};

const HEARTBEAT_MS = 20_000;
const SAFETY_REFRESH_MS = 30_000;

function statusOf(local: ReturnType<typeof playerBridge.read>): ReceiverStatus {
  if (!local) return "idle";
  if (local.buffering) return "buffering";
  return local.playing ? "playing" : "paused";
}

/**
 * Movviz Connect côté navigateur : déclare cet appareil, tient la liste des
 * autres appareils du compte, envoie les ordres et — si l'utilisateur l'a
 * autorisé — obéit aux ordres reçus et rapporte ce qui se lit ici.
 */
export function ConnectProvider({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  const { t } = useI18n();
  const tRef = useRef(t);
  const { enabled: betaPlayer } = useBetaPlayer();
  const betaRef = useRef(betaPlayer);
  useEffect(() => {
    tRef.current = t;
    betaRef.current = betaPlayer;
  }, [t, betaPlayer]);

  const selfId = useSyncExternalStore(noopSubscribe, getDeviceId, () => null);
  const [devices, setDevices] = useState<ConnectDevice[]>([]);
  const [ready, setReady] = useState(false);
  const receiverEnabled = useSyncExternalStore(subscribeReceiverEnabled, readReceiverEnabled, () => false);
  const receiverRef = useRef(false);
  useEffect(() => {
    receiverRef.current = receiverEnabled;
  }, [receiverEnabled]);
  const [controlledId, setControlledId] = useState<string | null>(null);

  const register = useCallback(async () => {
    const id = getDeviceId();
    try {
      await fetch("/api/connect/devices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id, name: defaultDeviceName(), kind: detectDeviceKind(), receiver: receiverRef.current }),
        keepalive: true,
      });
    } catch {
      /* hors ligne : le prochain battement réessaiera */
    }
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/connect/devices", { cache: "no-store" });
      if (!r.ok) return;
      const data = (await r.json()) as { devices?: ConnectDevice[] };
      setDevices(Array.isArray(data.devices) ? data.devices : []);
      setReady(true);
    } catch {
      /* garde la dernière liste connue */
    }
  }, []);

  // Déclaration, battement de cœur, retrait à la fermeture de la page.
  useEffect(() => {
    if (!enabled) return;
    void register().then(refresh);
    const beat = setInterval(() => void register(), HEARTBEAT_MS);
    const safety = setInterval(() => void refresh(), SAFETY_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void register().then(refresh);
    };
    const onLeave = () => {
      try {
        void fetch(`/api/connect/devices?id=${encodeURIComponent(getDeviceId())}`, { method: "DELETE", keepalive: true });
      } catch {
        /* la page se ferme : le serveur l'oubliera tout seul */
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    window.addEventListener("pagehide", onLeave);
    return () => {
      clearInterval(beat);
      clearInterval(safety);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      window.removeEventListener("pagehide", onLeave);
    };
  }, [enabled, register, refresh]);

  const setReceiverEnabled = useCallback((on: boolean) => {
    receiverRef.current = on;
    storeReceiverEnabled(on);
    void register();
  }, [register]);

  // Ordre reçu : lire un titre, ou piloter le lecteur ouvert ici.
  const handleCommand = useCallback(async (command: ConnectCommand) => {
    if (!receiverRef.current) return;
    const tt = tRef.current;
    if (command.kind === "play") {
      const params = new URLSearchParams({ tmdbId: String(command.tmdbId), type: command.mediaType });
      if (command.season !== undefined && command.episode !== undefined) {
        params.set("season", String(command.season));
        params.set("episode", String(command.episode));
      }
      if (command.fromBeginning) params.set("fromBeginning", "1");
      else if (command.resumeSeconds !== undefined) params.set("resume", String(command.resumeSeconds));
      try {
        const r = await fetch(`/api/connect/resolve?${params}`, { cache: "no-store" });
        if (!r.ok) {
          toast("error", tt("connect.notPlayable"));
          return;
        }
        const { target, resumeSeconds } = (await r.json()) as {
          target: { type: "movie" | "series"; tmdbId: number; title: string; posterPath: string | null; ratingKey: string; movvizId: string; seriesId?: string; seasonNumber?: number; episodeNumber?: number; episodeTitle?: string };
          resumeSeconds?: number;
        };
        const label = target.seasonNumber != null
          ? `${target.title} — ${target.seasonNumber}x${String(target.episodeNumber).padStart(2, "0")}${target.episodeTitle ? ` · ${target.episodeTitle}` : ""}`
          : target.title;
        // Personne devant l'écran pour répondre à « reprendre ? » : le choix est déjà fait.
        playerBridge.play({
          ratingKey: target.ratingKey,
          movvizId: target.movvizId,
          seriesId: target.seriesId,
          title: label,
          useTranscode: betaRef.current,
          tmdbId: target.tmdbId,
          type: target.type,
          seasonNumber: target.seasonNumber,
          episodeNumber: target.episodeNumber,
          posterUrl: target.posterPath ? `https://image.tmdb.org/t/p/w500${target.posterPath}` : null,
          ...(resumeSeconds !== undefined ? { resumeFromSeconds: resumeSeconds } : { startFromBeginning: true }),
        });
        if (command.from?.name) toast("info", tt("connect.startedFrom", { device: command.from.name }));
      } catch {
        toast("error", tt("connect.notPlayable"));
      }
      return;
    }
    if (command.kind === "stop") {
      playerBridge.close();
      return;
    }
    const player = playerBridge.current();
    if (!player) return;
    if (command.kind === "pause") player.pause();
    else if (command.kind === "resume") player.resume();
    else if (command.kind === "seek") player.seek(command.seconds);
  }, []);

  // Événements Connect relayés par le flux /api/events (voir useLibrarySSE).
  useEffect(() => {
    if (!enabled) return;
    const onEvent = (e: Event) => {
      const { channel, data } = (e as CustomEvent<ConnectEventDetail>).detail;
      const payload = data as { targetId?: string; deviceId?: string; command?: ConnectCommand; state?: ReceiverState } | null;
      if (channel === "connect-roster") void refresh();
      else if (channel === "connect-state" && payload?.deviceId && payload.state) {
        const { deviceId, state } = payload;
        setDevices((list) => list.map((d) => (d.id === deviceId ? { ...d, state } : d)));
      } else if (channel === "connect-command" && payload?.command && payload.targetId === getDeviceId()) {
        void handleCommand(payload.command);
      }
    };
    window.addEventListener(CONNECT_EVENT, onEvent);
    return () => window.removeEventListener(CONNECT_EVENT, onEvent);
  }, [enabled, refresh, handleCommand]);

  // Récepteur : rapporte ce qui se lit ici (état, position) aux autres appareils.
  useEffect(() => {
    if (!enabled || !receiverEnabled) return;
    let last: { status: ReceiverStatus; position: number; key: string; at: number } | null = null;
    const report = () => {
      const local = playerBridge.read();
      const status = statusOf(local);
      const key = local ? `${local.tmdbId ?? ""}:${local.season ?? ""}:${local.episode ?? ""}` : "";
      const now = Date.now();
      const position = local?.position ?? 0;
      const moved = last ? Math.abs(position - last.position) : Infinity;
      const due =
        !last ||
        last.status !== status ||
        last.key !== key ||
        (status === "playing" && now - last.at >= 5000) ||
        (status !== "playing" && moved >= 1.5);
      if (!due) return;
      if (!last && status === "idle") {
        last = { status, position, key, at: now };
        return;
      }
      last = { status, position, key, at: now };
      const state = local
        ? { status, title: local.title, mediaType: local.mediaType, tmdbId: local.tmdbId, season: local.season, episode: local.episode, position: local.position, duration: local.duration }
        : { status: "idle" as const, position: 0, duration: 0 };
      void fetch("/api/connect/state", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ deviceId: getDeviceId(), state }),
      }).catch(() => {});
    };
    const timer = setInterval(report, 1000);
    const off = playerBridge.subscribe(report);
    return () => {
      clearInterval(timer);
      off();
    };
  }, [enabled, receiverEnabled]);

  const post = useCallback(async (device: ConnectDevice, command: ConnectCommand): Promise<boolean> => {
    const tt = tRef.current;
    try {
      const r = await fetch("/api/connect/command", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ targetId: device.id, fromId: getDeviceId(), command }),
      });
      if (r.status === 404) {
        toast("error", tt("connect.offline", { device: device.name }));
        void refresh();
        return false;
      }
      if (!r.ok) {
        toast("error", tt("connect.failed", { device: device.name }));
        return false;
      }
      return true;
    } catch {
      toast("error", tt("connect.failed", { device: device.name }));
      return false;
    }
  }, [refresh]);

  const sendPlay = useCallback(async (device: ConnectDevice, payload: CastPayload) => {
    const ok = await post(device, { kind: "play", ...payload });
    if (ok) {
      setControlledId(device.id);
      // Retour immédiat dans la liste, le vrai état suit dans la seconde.
      setDevices((list) => list.map((d) => (d.id === device.id
        ? { ...d, state: { status: "loading", title: payload.title, mediaType: payload.mediaType, tmdbId: payload.tmdbId, season: payload.season, episode: payload.episode, position: payload.resumeSeconds ?? 0, duration: d.state?.duration ?? 0, updatedAt: Date.now() } }
        : d)));
      toast("success", tRef.current("connect.sent", { device: device.name }));
    }
    return ok;
  }, [post]);

  const sendControl = useCallback(async (device: ConnectDevice, command: ControlCommand) => {
    const ok = await post(device, command);
    if (ok) {
      setControlledId(device.id);
      setDevices((list) => list.map((d) => {
        if (d.id !== device.id || !d.state) return d;
        if (command.kind === "pause") return { ...d, state: { ...d.state, status: "paused" } };
        if (command.kind === "resume") return { ...d, state: { ...d.state, status: "playing", updatedAt: Date.now() } };
        if (command.kind === "seek") return { ...d, state: { ...d.state, position: command.seconds, updatedAt: Date.now() } };
        return { ...d, state: { ...d.state, status: "idle", position: 0, duration: 0 } };
      }));
    }
    return ok;
  }, [post]);

  const receivers = useMemo(() => devices.filter((d) => d.receiver && d.id !== selfId), [devices, selfId]);

  const value = useMemo<ConnectContextValue>(() => ({
    ready,
    selfId,
    receivers,
    receiverEnabled,
    setReceiverEnabled,
    controlledId,
    sendPlay,
    sendControl,
    refresh: () => void refresh(),
  }), [ready, selfId, receivers, receiverEnabled, setReceiverEnabled, controlledId, sendPlay, sendControl, refresh]);

  return <ConnectCtx.Provider value={value}>{children}</ConnectCtx.Provider>;
}
