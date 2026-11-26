"use client";

import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Cast, Loader2, Monitor, MonitorPlay, Pause, Play, RotateCcw, RotateCw, Smartphone, Square, Tv, TvMinimalPlay, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/provider";
import { Toggle } from "@/components/ui/Toggle";
import { useConnect, type CastPayload } from "@/lib/connect/ConnectProvider";
import { playerBridge } from "@/lib/connect/playerBridge";
import { castWithGoogleCast, controlGoogleCast, getGoogleCast, getGoogleCastServer, subscribeGoogleCast, type GoogleCastResult } from "@/lib/connect/googleCast";
import { endCastJob, getCastJob, getCastJobServer, startCastJob, subscribeCastJob, type CastJob } from "@/lib/connect/castProgress";
import type { ConnectDevice, ReceiverState } from "@/lib/connect/types";
import { toast } from "@/components/ui/Toast";
import "./cast.css";

type Variant = "topbar" | "player" | "title";

interface CastButtonProps {
  variant: Variant;
  /** Ce que « Caster » lance (fiche titre, lecteur). Absent : télécommande seule (barre du haut). */
  payload?: CastPayload | (() => CastPayload | null);
  /** Lecteur : l'élément vidéo, pour AirPlay et les écrans du navigateur (Chromecast…). */
  video?: () => HTMLVideoElement | null;
  /** Lecteur : classe du bouton, identique aux autres boutons de la barre. */
  className?: string;
  /** Lecteur : prévenu à l'ouverture / fermeture, pour garder la barre visible pendant le choix. */
  onOpenChange?: (open: boolean) => void;
}

/** Écran Google Cast piloté directement par ce navigateur, sur le réseau où il se trouve. */
const LOCAL_CAST_ID = "gcast_local";

const ACTIVE: ReadonlySet<ReceiverState["status"]> = new Set(["playing", "paused", "buffering", "loading"]);

function fmt(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** Position estimée maintenant : la dernière rapportée + le temps écoulé en lecture. */
function livePosition(state: ReceiverState, now: number): number {
  const base = state.position;
  if (state.status !== "playing") return base;
  const ahead = base + (now - state.updatedAt) / 1000;
  return state.duration > 0 ? Math.min(state.duration, ahead) : ahead;
}

function DeviceIcon({ device, className }: { device: ConnectDevice; className?: string }) {
  // Écran Google Cast trouvé par ce navigateur (SDK officiel) : logo Cast ; écrans vus par le serveur : icône neutre.
  if (device.id === LOCAL_CAST_ID) return <Cast className={className} aria-hidden="true" />;
  const Icon = device.kind === "network" ? MonitorPlay : device.kind === "tv" || device.kind === "tizen" ? Tv : device.kind === "mobile" ? Smartphone : Monitor;
  return <Icon className={className} aria-hidden="true" />;
}

/** Petites barres animées : « ça joue en ce moment sur cet appareil ». */
function Equalizer() {
  return (
    <span className="mv-cast-eq" aria-hidden="true">
      <span /><span /><span />
    </span>
  );
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

const PHONE_QUERY = "(max-width: 639px)";
function subscribePhone(fn: () => void): () => void {
  const mq = window.matchMedia(PHONE_QUERY);
  mq.addEventListener("change", fn);
  return () => mq.removeEventListener("change", fn);
}
function useIsPhone(): boolean {
  return useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE_QUERY).matches, () => false);
}

/**
 * Écrans proposés par le navigateur lui-même (Remote Playback : Chromecast via Chrome…). Un flux
 * MSE (lecteur Movviz en remux, iPhone en ManagedMediaSource) n'est pas transmissible : rien n'est
 * proposé dans ce cas. AirPlay n'est pas reproduit ici : Apple réserve son nom et son icône à ses
 * propres commandes.
 */
function useBrowserTargets(video: (() => HTMLVideoElement | null) | undefined, open: boolean) {
  const [remote, setRemote] = useState(false);
  useEffect(() => {
    const el = video?.();
    if (!el) return;
    const remotePlayback = (el as HTMLVideoElement & { remote?: RemotePlayback }).remote;
    const source = el.currentSrc || el.src || "";
    if (!remotePlayback || el.disableRemotePlayback || source.startsWith("blob:")) return;
    let watchId: number | null = null;
    remotePlayback.watchAvailability((available) => setRemote(available)).then((id) => { watchId = id; }).catch(() => setRemote(false));
    return () => {
      setRemote(false);
      if (watchId !== null) remotePlayback.cancelWatchAvailability(watchId).catch(() => {});
    };
  }, [video, open]);
  return { remote };
}

export function CastButton({ variant, payload, video, className, onOpenChange }: CastButtonProps) {
  const t = useT();
  const connect = useConnect();
  const [open, setOpen] = useState(false);
  const job = useSyncExternalStore(subscribeCastJob, getCastJob, getCastJobServer);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const phone = useIsPhone();
  const targets = useBrowserTargets(video, open);
  const gcast = useSyncExternalStore(subscribeGoogleCast, getGoogleCast, getGoogleCastServer);
  const localCast: ConnectDevice | null = gcast.connected && gcast.deviceName
    ? { id: LOCAL_CAST_ID, name: gcast.deviceName, kind: "network", via: "chromecast", receiver: true, online: true, state: gcast.state }
    : null;
  const serverReceivers = connect?.receivers ?? [];
  // Le même écran vu par le serveur et par ce navigateur : une seule ligne, celle pilotée d'ici.
  const receivers = localCast
    ? [localCast, ...serverReceivers.filter((d) => d.name.toLowerCase() !== localCast.name.toLowerCase())]
    : serverReceivers;
  // État « connecté » : seulement l'appareil piloté depuis ici (pas une TV lancée par quelqu'un d'autre).
  const playingDevice = receivers.find((d) => d.state && ACTIVE.has(d.state.status) && (d.id === connect?.controlledId || d.id === LOCAL_CAST_ID));
  const [panelShift, setPanelShift] = useState(0);
  const anyActive = receivers.some((d) => d.state && ACTIVE.has(d.state.status));
  const now = useNow(open && (anyActive || !!job));

  const close = useCallback((restoreFocus = true) => {
    setOpen(false);
    if (restoreFocus) buttonRef.current?.focus();
  }, []);

  // Clic à l'extérieur, Échap : fermeture. Focus sur le premier appareil à l'ouverture.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    const focusTimer = setTimeout(() => panelRef.current?.querySelector<HTMLElement>("[data-cast-focus]")?.focus(), 30);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
      clearTimeout(focusTimer);
    };
  }, [open, close]);

  useEffect(() => {
    if (open) connect?.refresh();
    onOpenChange?.(open);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Le panneau du lecteur s'ouvre aligné sur le bouton, mais ne sort jamais de l'écran (375 px).
  const toggle = () => {
    if (!open && variant === "player" && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const width = Math.min(340, window.innerWidth - 32);
      const left = rect.right - width;
      setPanelShift(left < 16 ? 16 - left : 0);
    }
    setOpen((o) => !o);
  };

  if (!connect) return null;

  const browserTargets = variant === "player" && targets.remote;
  // Toujours visible (ordinateur, navigateur mobile) : la liste dit ce qui est possible, ou comment le rendre possible.

  const resolvePayload = (): CastPayload | null => (typeof payload === "function" ? payload() : payload ?? null);
  const canCast = variant !== "topbar" && !!resolvePayload();
  const nearbyCast = gcast.available && !localCast && canCast;

  const reportCast = (result: GoogleCastResult, name: string) => {
    if (result === "local_file_required") toast("error", t("connect.localFileRequired"));
    else if (result === "failed") toast("error", t("connect.nearbyFailed"));
    else if (result === "ok") toast("success", t("connect.startedOn", { device: name }));
  };

  /** Un seul envoi à la fois : un clic pendant un envoi le rappelle au lieu d'en lancer un second. */
  const busyToast = () => {
    if (job) toast("info", t("connect.busyCasting", { device: job.deviceName }));
  };

  /** Fermeture après réussite, le temps de voir la ligne passer à « En lecture ». */
  const closeSoon = () => setTimeout(() => setOpen(false), 700);

  /** Écran Google Cast du réseau de cet appareil (où qu'il soit par rapport au serveur). */
  const castNearby = async () => {
    const p = resolvePayload();
    if (!p) return;
    const stage = startCastJob(LOCAL_CAST_ID, gcast.deviceName ?? "Google Cast", "picking");
    if (!stage) return busyToast();
    let name = gcast.deviceName ?? "Google Cast";
    try {
      if (variant === "player") playerBridge.current()?.pause();
      const result = await castWithGoogleCast(p, (s, n) => { if (n) name = n; stage(s, n); });
      reportCast(result, name);
      if (variant === "player") {
        if (result === "ok") playerBridge.close();
        else playerBridge.current()?.resume();
      } else if (result === "ok") closeSoon();
    } finally {
      endCastJob();
    }
  };

  const castTo = async (device: ConnectDevice) => {
    if (device.id === LOCAL_CAST_ID) return castNearby();
    const p = resolvePayload();
    if (!p) return;
    const stage = startCastJob(device.id, device.name, "sending");
    if (!stage) return busyToast();
    try {
      // Lecteur : transfert, pause ici ; il ne se ferme qu'une fois la lecture partie là-bas.
      if (variant === "player") playerBridge.current()?.pause();
      const ok = await connect.sendPlay(device, p);
      if (ok) stage("waiting");
      const started = ok && (await connect.waitForPlayback(device.id, p.tmdbId, 20_000));
      if (started) toast("success", t("connect.startedOn", { device: device.name }));
      // Ordre reçu mais lecture non confirmée : l'écran est peut-être juste lent, on le dit sans alarmer.
      else if (ok && variant !== "player") toast("info", t("connect.sent", { device: device.name }));
      else if (ok) toast("error", t("connect.failed", { device: device.name }));
      if (variant === "player") {
        if (started) playerBridge.close();
        else playerBridge.current()?.resume();
      } else if (ok) closeSoon();
    } finally {
      endCastJob();
    }
  };

  const label = playingDevice
    ? t("connect.nowOn", { device: playingDevice.name })
    : t("connect.button");

  const button = (
    <button
      ref={buttonRef}
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls={open ? panelId : undefined}
      data-cast-active={playingDevice ? "" : undefined}
      className={cn(
        variant === "topbar" && "relative flex h-11 w-11 items-center justify-center rounded-full glass transition-colors hover:text-brand-glow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow/70",
        variant === "title" && "relative flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white/80 backdrop-blur transition-transform hover:scale-110 hover:text-white active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80",
        variant === "player" && cn("relative", className),
        playingDevice && "text-brand-glow",
        job && "mv-cast-connecting",
      )}
    >
      <TvMinimalPlay className={variant === "topbar" ? "h-[18px] w-[18px]" : variant === "title" ? "h-4 w-4" : "h-5 w-5"} strokeWidth={playingDevice ? 2.4 : 2} />
      {playingDevice && <span className="mv-cast-dot" aria-hidden="true" />}
    </button>
  );

  const title = variant === "player" ? t("connect.panelTitlePlayer") : t("connect.panelTitle");

  const panelBody: ReactNode = (
    <>
      <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4 sm:pt-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <TvMinimalPlay className="h-4 w-4 shrink-0 text-brand-glow" aria-hidden="true" />
          <h2 className="truncate text-[15px] font-semibold text-white">{title}</h2>
        </div>
        <button
          type="button"
          onClick={() => close()}
          aria-label={t("connect.close")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="max-h-[min(60vh,420px)] overflow-y-auto overscroll-contain px-2 pb-2" role="list" aria-label={t("connect.devicesLabel")}>
        {receivers.length === 0 && !browserTargets && !nearbyCast && (
          <div className="mx-2 my-2 rounded-2xl border border-dashed border-white/12 px-4 py-6 text-center">
            <Tv className="mx-auto mb-2.5 h-7 w-7 text-white/35" aria-hidden="true" />
            <p className="text-[13px] font-semibold text-white/85">{t("connect.emptyTitle")}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-white/50">{t("connect.emptyHint")}</p>
          </div>
        )}

        {receivers.map((device, index) => (
          <DeviceRow
            key={device.id}
            device={device}
            now={now}
            stage={job?.deviceId === device.id ? stageText(t, job, now) : null}
            dimmed={!!job && job.deviceId !== device.id}
            canCast={canCast}
            focusFirst={index === 0}
            onCast={() => void castTo(device)}
            onControl={(command) => void (device.id === LOCAL_CAST_ID ? controlGoogleCast(command) : connect.sendControl(device, command))}
          />
        ))}

        {nearbyCast && (
          <div className={cn(receivers.length > 0 && "mt-1 border-t border-white/8 pt-1")}>
            <BrowserTargetRow
              icon={<Cast className="h-5 w-5" aria-hidden="true" />}
              title={job?.deviceId === LOCAL_CAST_ID && job.deviceName !== "Google Cast" ? job.deviceName : t("connect.nearbyCast")}
              hint={t("connect.nearbyCastHint")}
              stage={job?.deviceId === LOCAL_CAST_ID ? stageText(t, job, now) : null}
              dimmed={!!job && job.deviceId !== LOCAL_CAST_ID}
              focusFirst={receivers.length === 0}
              onClick={() => void castNearby()}
            />
          </div>
        )}

        {browserTargets && (
          <div className={cn((receivers.length > 0 || nearbyCast) && "mt-1 border-t border-white/8 pt-1")}>
            <BrowserTargetRow
              icon={<Cast className="h-5 w-5" aria-hidden="true" />}
              title={t("connect.remoteScreen")}
              hint={t("connect.remoteScreenHint")}
              focusFirst={receivers.length === 0 && !nearbyCast}
              dimmed={!!job}
              onClick={() => {
                if (job) return busyToast();
                const remote = (video?.() as (HTMLVideoElement & { remote?: RemotePlayback }) | null)?.remote;
                void remote?.prompt().catch(() => {});
                close(false);
              }}
            />
          </div>
        )}
      </div>

      <div className="mx-2 mb-2 flex items-center justify-between gap-3 rounded-2xl bg-white/[0.04] px-3.5 py-3">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold text-white/90">{t("connect.receiveTitle")}</p>
          <p className="mt-0.5 text-[11.5px] leading-snug text-white/50">{t("connect.receiveHint")}</p>
        </div>
        <Toggle on={connect.receiverEnabled} onChange={() => connect.setReceiverEnabled(!connect.receiverEnabled)} label={t("connect.receiveTitle")} />
      </div>
    </>
  );

  const sheet = phone && variant !== "player";

  return (
    <div ref={rootRef} className={cn("relative", variant === "topbar" && "nx-topbar-cast")}>
      {button}
      {open && !sheet && (
        <div
          ref={panelRef}
          id={panelId}
          role="dialog"
          aria-label={title}
          // Les raccourcis du lecteur (espace, flèches) ne doivent pas agir derrière le panneau.
          onKeyDown={(e) => e.stopPropagation()}
          className={cn(
            "mv-cast-panel absolute z-[60] w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[22px] border border-white/10 bg-[#0b1230]/95 shadow-[0_24px_70px_-12px_rgba(0,0,0,0.75)] backdrop-blur-2xl",
            variant === "player" ? "bottom-full right-0 mb-3 origin-bottom-right" : "right-0 top-[calc(100%+10px)] origin-top-right",
          )}
          style={panelShift ? { right: -panelShift } : undefined}
        >
          {panelBody}
        </div>
      )}
      {open && sheet && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[80]" role="presentation">
          <div className="mv-cast-backdrop absolute inset-0 bg-black/55 backdrop-blur-[2px]" onClick={() => close()} aria-hidden="true" />
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            onKeyDown={(e) => e.stopPropagation()}
            className="mv-cast-sheet absolute inset-x-0 bottom-0 overflow-hidden rounded-t-[26px] border-t border-white/10 bg-[#0b1230] pb-[max(env(safe-area-inset-bottom),12px)] shadow-[0_-20px_60px_-10px_rgba(0,0,0,0.8)]"
          >
            <div className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-white/20" aria-hidden="true" />
            {panelBody}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function statusLabel(t: ReturnType<typeof useT>, state: ReceiverState | null): string {
  if (!state || state.status === "idle") return t("connect.ready");
  if (state.status === "playing") return t("connect.playing");
  if (state.status === "paused") return t("connect.paused");
  return t("connect.buffering");
}

function kindLabel(t: ReturnType<typeof useT>, device: ConnectDevice): string {
  if (device.via === "chromecast") return t("connect.kindGoogleCast");
  if (device.via === "dlna") return t("connect.kindDlna");
  if (device.kind === "tv") return t("connect.kindTv");
  if (device.kind === "tizen") return t("connect.kindTizen");
  if (device.kind === "mobile") return t("connect.kindMobile");
  return t("connect.kindWeb");
}

/** Texte de l'étape en cours ; l'attente affiche les secondes écoulées. */
function stageText(t: ReturnType<typeof useT>, job: CastJob, now: number): string {
  const device = job.deviceName;
  switch (job.stage) {
    case "sending": return t("connect.stageSending", { device });
    case "picking": return t("connect.stagePicking");
    case "connecting": return t("connect.stageConnecting", { device });
    case "preparing": return t("connect.stagePreparing");
    case "launching": return t("connect.stageLaunching");
    case "waiting": return t("connect.stageWaiting", { seconds: String(Math.max(0, Math.floor((now - job.since) / 1000))) });
  }
}

/** Ligne en cours d'envoi : l'étape remplace le sous-titre, barre indéterminée dessous. */
function StageLine({ text }: { text: string }) {
  return (
    <span key={text} className="mv-cast-stage mt-0.5 block truncate text-[12px] font-medium text-brand-glow" role="status" aria-live="polite">
      {text}
    </span>
  );
}

function DeviceRow({ device, now, stage, dimmed, canCast, focusFirst, onCast, onControl }: {
  device: ConnectDevice;
  now: number;
  stage: string | null;
  dimmed: boolean;
  canCast: boolean;
  focusFirst: boolean;
  onCast: () => void;
  onControl: (command: { kind: "pause" } | { kind: "resume" } | { kind: "stop" } | { kind: "seek"; seconds: number }) => void;
}) {
  const t = useT();
  const busy = stage != null;
  const state = device.state;
  // Pendant l'envoi, notre propre « loading » optimiste ne doit pas afficher la télécommande.
  const active = !busy && !!state && ACTIVE.has(state.status);
  const position = state ? livePosition(state, now) : 0;
  const duration = state?.duration ?? 0;
  const progress = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
  const nowPlaying = active && state?.title
    ? state.season != null && state.episode != null
      ? `${state.title} · S${state.season} E${state.episode}`
      : state.title
    : null;

  const seekFromBar = (e: React.PointerEvent<HTMLDivElement>) => {
    if (duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    onControl({ kind: "seek", seconds: Math.round(ratio * duration) });
  };

  const rowInner = (
    <>
      <StageIcon busy={busy} active={active}>
        <DeviceIcon device={device} className="h-[22px] w-[22px]" />
      </StageIcon>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[14px] font-semibold text-white">{device.name}</span>
          {active && state?.status === "playing" && <Equalizer />}
        </span>
        {stage != null ? <StageLine text={stage} /> : (
          <span className="mt-0.5 block truncate text-[12px] text-white/55">
            {nowPlaying ?? `${kindLabel(t, device)} · ${statusLabel(t, state)}`}
          </span>
        )}
      </span>
      {busy && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-glow" aria-hidden="true" />}
    </>
  );

  return (
    <div role="listitem" className={cn("relative overflow-hidden rounded-2xl transition-[background-color,opacity] duration-200", (active || busy) && "bg-white/[0.035]", dimmed && "opacity-50")}>
      {canCast ? (
        <button
          type="button"
          data-cast-focus={focusFirst ? "" : undefined}
          onClick={onCast}
          aria-busy={busy || undefined}
          className={cn("group flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-glow/70", busy && "cursor-wait")}
        >
          {rowInner}
        </button>
      ) : (
        <div className="group flex w-full items-center gap-3 px-2.5 py-2.5" tabIndex={focusFirst && !active ? -1 : undefined} data-cast-focus={focusFirst && !active ? "" : undefined}>
          {rowInner}
        </div>
      )}

      {busy && <span className="mv-cast-indeterminate" aria-hidden="true" />}

      {active && state && (
        <div className="px-3 pb-3 pt-0.5">
          <div
            className="group/bar relative h-5 cursor-pointer touch-none"
            onPointerDown={seekFromBar}
            role="slider"
            aria-label={state.title ?? device.name}
            aria-valuemin={0}
            aria-valuemax={Math.round(duration)}
            aria-valuenow={Math.round(position)}
            aria-valuetext={`${fmt(position)} / ${fmt(duration)}`}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Home") { e.preventDefault(); onControl({ kind: "seek", seconds: 0 }); }
              else if (e.key === "End" && duration > 0) { e.preventDefault(); onControl({ kind: "seek", seconds: Math.max(0, duration - 5) }); }
              else if (e.key === "ArrowLeft") { e.preventDefault(); onControl({ kind: "seek", seconds: Math.max(0, position - 10) }); }
              else if (e.key === "ArrowRight") { e.preventDefault(); onControl({ kind: "seek", seconds: Math.min(duration || position + 10, position + 10) }); }
            }}
          >
            <div className="absolute inset-x-0 top-1/2 h-[3px] -translate-y-1/2 overflow-hidden rounded-full bg-white/15 transition-[height] group-hover/bar:h-[5px]">
              <div className="h-full rounded-full bg-brand-glow" style={{ width: `${progress}%` }} />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="w-14 text-[11px] tabular-nums text-white/55">{fmt(position)}</span>
            <div className="flex items-center gap-1">
              <RemoteButton label={t("connect.back10")} onClick={() => onControl({ kind: "seek", seconds: Math.max(0, position - 10) })}>
                <RotateCcw className="h-[18px] w-[18px]" />
              </RemoteButton>
              <RemoteButton
                primary
                focus={focusFirst && !canCast}
                label={state.status === "paused" ? t("connect.resume") : t("connect.pause")}
                onClick={() => onControl({ kind: state.status === "paused" ? "resume" : "pause" })}
              >
                {state.status === "paused" ? <Play className="h-5 w-5 translate-x-[1px] fill-current" /> : <Pause className="h-5 w-5 fill-current" />}
              </RemoteButton>
              <RemoteButton label={t("connect.forward10")} onClick={() => onControl({ kind: "seek", seconds: duration > 0 ? Math.min(duration, position + 10) : position + 10 })}>
                <RotateCw className="h-[18px] w-[18px]" />
              </RemoteButton>
              <RemoteButton label={t("connect.stop")} onClick={() => onControl({ kind: "stop" })}>
                <Square className="h-4 w-4 fill-current" />
              </RemoteButton>
            </div>
            <span className="w-14 text-right text-[11px] tabular-nums text-white/55">{duration > 0 ? fmt(duration) : ""}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function RemoteButton({ label, onClick, primary, focus, children }: { label: string; onClick: () => void; primary?: boolean; focus?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      data-cast-focus={focus ? "" : undefined}
      className={cn(
        "flex items-center justify-center rounded-full transition-all duration-150 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-glow/70",
        // Règle du bouton blanc : gris au repos, blanc seulement au survol / focus.
        primary
          ? "h-11 w-11 bg-white/[0.14] text-white hover:bg-white hover:text-black focus-visible:bg-white focus-visible:text-black"
          : "h-10 w-10 text-white/75 hover:bg-white/10 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

/** Vignette de l'appareil : halo pulsé pendant l'envoi, teinte de marque en lecture. */
function StageIcon({ busy, active, children }: { busy: boolean; active: boolean; children: ReactNode }) {
  return (
    <span className={cn(
      "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] transition-colors",
      busy ? "mv-cast-halo bg-brand/25 text-brand-glow" : active ? "bg-brand/25 text-brand-glow" : "bg-white/[0.07] text-white/80 group-hover:bg-white/[0.11]",
    )}>
      {children}
    </span>
  );
}

function BrowserTargetRow({ icon, title, hint, stage = null, dimmed = false, focusFirst, onClick }: { icon: ReactNode; title: string; hint: string; stage?: string | null; dimmed?: boolean; focusFirst: boolean; onClick: () => void }) {
  const busy = stage != null;
  return (
    <div className={cn("relative overflow-hidden rounded-2xl transition-[background-color,opacity] duration-200", busy && "bg-white/[0.035]", dimmed && "opacity-50")}>
      <button
        type="button"
        onClick={onClick}
        aria-busy={busy || undefined}
        data-cast-focus={focusFirst ? "" : undefined}
        className={cn("group flex w-full items-center gap-3 rounded-2xl px-2.5 py-2.5 text-left transition-colors hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-glow/70", busy && "cursor-wait")}
      >
        <StageIcon busy={busy} active={false}>{icon}</StageIcon>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-semibold text-white">{title}</span>
          {stage != null ? <StageLine text={stage} /> : <span className="mt-0.5 block truncate text-[12px] text-white/55">{hint}</span>}
        </span>
        {busy && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-brand-glow" aria-hidden="true" />}
      </button>
      {busy && <span className="mv-cast-indeterminate" aria-hidden="true" />}
    </div>
  );
}
