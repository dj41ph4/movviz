import { randomBytes } from "node:crypto";

/**
 * Liens de lecture pour les écrans réseau (Chromecast, téléviseurs DLNA) :
 * ces appareils vont chercher la vidéo eux-mêmes, sans session Movviz. Chaque
 * lien porte un jeton aléatoire (256 bits) qui ne donne accès qu'à CE fichier,
 * pour quelques heures, et jamais à l'API.
 */

export type CastMediaMode = "direct" | "remux";

export interface CastMedia {
  userId: string;
  path: string;
  mode: CastMediaMode;
  title: string;
  /** Remux : piste audio réencodée en AAC quand l'écran ne sait pas la lire. */
  transcodeAudio: boolean;
  durationSec: number | null;
  expiresAt: number;
}

const TTL_MS = 8 * 60 * 60_000;
const MAX = 200;
const holder = globalThis as typeof globalThis & { __movvizCastMedia?: Map<string, CastMedia> };
const media = (holder.__movvizCastMedia ??= new Map<string, CastMedia>());

export const CAST_TOKEN_RE = /^[0-9a-f]{64}$/;

function sweep(now: number) {
  for (const [token, m] of media) if (m.expiresAt <= now) media.delete(token);
  while (media.size >= MAX) {
    const oldest = media.keys().next().value;
    if (oldest === undefined) break;
    media.delete(oldest);
  }
}

export function createCastMedia(entry: Omit<CastMedia, "expiresAt">): string {
  const now = Date.now();
  sweep(now);
  const token = randomBytes(32).toString("hex");
  media.set(token, { ...entry, expiresAt: now + TTL_MS });
  return token;
}

export function getCastMedia(token: string): CastMedia | null {
  if (!CAST_TOKEN_RE.test(token)) return null;
  const m = media.get(token);
  if (!m) return null;
  if (m.expiresAt <= Date.now()) {
    media.delete(token);
    return null;
  }
  return m;
}

export function contentTypeFor(path: string): string {
  const ext = path.toLowerCase().split(".").pop();
  return ext === "mkv" ? "video/x-matroska" : ext === "webm" ? "video/webm" : ext === "mov" ? "video/quicktime" : ext === "avi" ? "video/x-msvideo" : ext === "ts" ? "video/mp2t" : "video/mp4";
}

/** Codecs audio qu'un Chromecast lit sans aide (le reste passe en AAC stéréo). */
export const CHROMECAST_AUDIO = new Set(["aac", "mp3", "opus", "vorbis", "flac", "ac3", "eac3"]);
