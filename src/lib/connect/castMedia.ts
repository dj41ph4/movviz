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
  /** Remux : vidéo recodée en H.264 (écran incompatible avec la source), sinon copiée. */
  video?: CastVideoTranscode | null;
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


/** Recodage vidéo pour un écran qui ne lit pas la source telle quelle (H.264 8 bits, SDR). */
export interface CastVideoTranscode {
  width: number;
  toneMap: boolean;
  preset: "veryfast" | "ultrafast";
}

export interface CastProfile {
  video: CastVideoTranscode | null;
  transcodeAudio: boolean;
}

interface SourceInfo {
  videoCodec?: string;
  bitDepth?: number;
  width?: number;
  hdr?: boolean;
  audioCodec?: string;
}

/**
 * Ce que l'écran Google Cast lit vraiment, d'après son modèle (mDNS « md », SDK
 * Cast « modelName »). Vérifié sur un vrai Google Nest Hub : HEVC et E-AC3 en
 * copie = erreur immédiate, HEVC + AAC = saut à la fin (« terminé » à tort) ;
 * H.264 + AAC en flux fragmenté = lecture correcte. Modèle inconnu : le profil
 * sûr de tout Chromecast (H.264 1080p, AAC).
 */
export function castProfileFor(model: string | null | undefined, src: SourceInfo): CastProfile {
  const m = (model ?? "").toLowerCase();
  // Chromecast avec Google TV, Google TV Streamer, Chromecast Ultra : HEVC, HDR et Dolby Digital.
  const advanced = /google tv|streamer|ultra/.test(m);
  // Écrans connectés Nest Hub / Hub Max : dalle 1024 ou 1280 px de large.
  const maxWidth = /hub/.test(m) ? 1280 : advanced ? 3840 : 1920;
  const codec = (src.videoCodec ?? "").toLowerCase();
  const width = src.width ?? 0;
  const eightBit = !src.bitDepth || src.bitDepth <= 8;
  const codecOk = (codec === "h264" && eightBit) || (advanced && (codec === "hevc" || codec === "h264" || codec === "vp9"));
  const hdrOk = !src.hdr || advanced;
  const video: CastVideoTranscode | null = codecOk && hdrOk && width <= maxWidth
    ? null
    : src.hdr && !advanced
      // Conversion HDR→SDR : coûteuse, limitée à 960 px pour rester en temps réel sur un NAS sans GPU.
      ? { width: Math.min(maxWidth, 960, width || 960), toneMap: true, preset: "ultrafast" }
      : { width: Math.min(maxWidth, width || maxWidth), toneMap: false, preset: "veryfast" };
  const audio = (src.audioCodec ?? "aac").toLowerCase();
  const audioOk = ["aac", "mp3", "opus", "vorbis", "flac"].includes(audio) || (advanced && (audio === "ac3" || audio === "eac3"));
  return { video, transcodeAudio: !audioOk };
}

/** Arguments ffmpeg du flux MP4 fragmenté servi à un écran Cast (« ?t= » secondes de départ). */
export function remuxArgs(path: string, startSec: number, media: Pick<CastMedia, "transcodeAudio" | "video">): string[] {
  const v = media.video ?? null;
  const filters = v ? [`scale=min(${v.width}\\,iw):-2`, ...(v.toneMap ? ["zscale=t=linear:npl=100", "format=gbrpf32le", "zscale=p=bt709", "tonemap=tonemap=hable:desat=0", "zscale=t=bt709:m=bt709:r=tv"] : []), "format=yuv420p"] : [];
  return [
    "-hide_banner", "-loglevel", "error", "-nostdin",
    ...(startSec > 0 ? ["-ss", startSec.toFixed(2)] : []),
    "-i", path,
    "-map", "0:v:0", "-map", "0:a:0?",
    ...(v
      ? ["-c:v", "libx264", "-preset", v.preset, "-crf", "23", "-profile:v", "high", "-level:v", "4.1", "-vf", filters.join(","), "-g", "48", "-keyint_min", "48", "-sc_threshold", "0"]
      : ["-c:v", "copy"]),
    ...(media.transcodeAudio ? ["-c:a", "aac", "-b:a", "256k", "-ac", "2"] : ["-c:a", "copy"]),
    "-sn", "-dn",
    "-movflags", "frag_keyframe+empty_moov+default_base_moof",
    "-f", "mp4", "pipe:1",
  ];
}
