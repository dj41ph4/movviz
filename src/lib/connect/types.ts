/**
 * Movviz Connect — contrat partagé entre le serveur, le site web et les apps
 * (TV, mobile, Tizen). Une seule icône « Caster » liste les appareils de
 * l'utilisateur ; un ordre est poussé à l'appareil choisi par le flux
 * /api/events?device=… et l'appareil rapporte son état en retour.
 */

export type DeviceKind = "tv" | "tizen" | "mobile" | "web" | "network";

/** Protocole utilisé pour atteindre l'appareil (appareils réseau : voir discovery). */
export type DeviceVia = "movviz" | "dlna";

export interface ConnectDevice {
  id: string;
  name: string;
  kind: DeviceKind;
  via: DeviceVia;
  /** Peut recevoir un ordre « lire » (une app Movviz ouverte, un lecteur réseau). */
  receiver: boolean;
  online: boolean;
  /** Dernier état rapporté par l'appareil lui-même (absent pour un lecteur réseau sans retour). */
  state: ReceiverState | null;
}

export type ReceiverStatus = "idle" | "loading" | "playing" | "paused" | "buffering";

export interface ReceiverState {
  status: ReceiverStatus;
  title?: string;
  mediaType?: "movie" | "series";
  tmdbId?: number;
  season?: number;
  episode?: number;
  /** Secondes. */
  position: number;
  duration: number;
  updatedAt: number;
}

export type ConnectCommand =
  | {
      kind: "play";
      title: string;
      mediaType: "movie" | "series";
      tmdbId: number;
      season?: number;
      episode?: number;
      /** Reprise à cette position (secondes). Absent : l'appareil reprend là où l'utilisateur en était. */
      resumeSeconds?: number;
      fromBeginning?: boolean;
      from?: { id: string; name: string };
    }
  | { kind: "pause" }
  | { kind: "resume" }
  | { kind: "stop" }
  | { kind: "seek"; seconds: number };

export const DEVICE_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
export const ONLINE_MS = 45_000;

const KINDS: readonly DeviceKind[] = ["tv", "tizen", "mobile", "web"];
const STATUSES: readonly ReceiverStatus[] = ["idle", "loading", "playing", "paused", "buffering"];

const CONTROL_CHARS = /[\u0000-\u001f]/g;
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(CONTROL_CHARS, "").trim().slice(0, max) : "");
const int = (v: unknown, lo: number, hi: number): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, Math.round(v))) : undefined;
const sec = (v: unknown): number | undefined =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(1_000_000, Math.max(0, Math.round(v * 10) / 10)) : undefined;

export function parseRegistration(body: unknown): { id: string; name: string; kind: DeviceKind; receiver: boolean } | null {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return null;
  const id = typeof b.id === "string" ? b.id : "";
  const kind = KINDS.find((k) => k === b.kind);
  const name = clean(b.name, 60);
  if (!DEVICE_ID_RE.test(id) || !kind || !name) return null;
  return { id, name, kind, receiver: b.receiver === true };
}

export function parseCommand(body: unknown): ConnectCommand | null {
  const c = body as Record<string, unknown> | null;
  if (!c || typeof c !== "object") return null;
  switch (c.kind) {
    case "play": {
      const mediaType = c.mediaType === "movie" || c.mediaType === "series" ? c.mediaType : null;
      const tmdbId = int(c.tmdbId, 1, 2_000_000_000);
      const title = clean(c.title, 200);
      if (!mediaType || tmdbId === undefined || !title) return null;
      const season = int(c.season, 0, 1000);
      const episode = int(c.episode, 0, 100_000);
      if (mediaType === "series" && (season === undefined) !== (episode === undefined)) return null;
      const resumeSeconds = sec(c.resumeSeconds);
      return {
        kind: "play",
        title,
        mediaType,
        tmdbId,
        ...(season !== undefined ? { season } : {}),
        ...(episode !== undefined ? { episode } : {}),
        ...(resumeSeconds !== undefined ? { resumeSeconds } : {}),
        ...(c.fromBeginning === true ? { fromBeginning: true } : {}),
      };
    }
    case "pause":
    case "resume":
    case "stop":
      return { kind: c.kind };
    case "seek": {
      const seconds = sec(c.seconds);
      return seconds === undefined ? null : { kind: "seek", seconds };
    }
    default:
      return null;
  }
}

export function parseState(body: unknown): ReceiverState | null {
  const s = body as Record<string, unknown> | null;
  if (!s || typeof s !== "object") return null;
  const status = STATUSES.find((x) => x === s.status);
  if (!status) return null;
  const title = clean(s.title, 200);
  const tmdbId = int(s.tmdbId, 1, 2_000_000_000);
  const season = int(s.season, 0, 1000);
  const episode = int(s.episode, 0, 100_000);
  return {
    status,
    ...(title ? { title } : {}),
    ...(s.mediaType === "movie" || s.mediaType === "series" ? { mediaType: s.mediaType } : {}),
    ...(tmdbId !== undefined ? { tmdbId } : {}),
    ...(season !== undefined ? { season } : {}),
    ...(episode !== undefined ? { episode } : {}),
    position: sec(s.position) ?? 0,
    duration: sec(s.duration) ?? 0,
    updatedAt: Date.now(),
  };
}
