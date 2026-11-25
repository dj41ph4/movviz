import { resolveConnectPlay } from "@/lib/connect/resolve";
import { castProfileFor, contentTypeFor, createCastMedia } from "@/lib/connect/castMedia";
import { castToneMapAllowed } from "@/lib/connect/castPolicy";
import { resolveEpisodePlayback, resolveMoviePlayback } from "@/lib/playback/sourceResolver";
import { getOrProbeMediaDescriptor } from "@/lib/playback/engine/mediaProbeCache";
import { openPlaybackSession } from "@/lib/playback/progressStore";
import type { ConnectCommand } from "@/lib/connect/types";

/**
 * Lien de lecture public pour un écran trouvé par l'appareil lui-même (Chromecast
 * du salon d'un ami, d'un hôtel… vu par le téléphone ou par Chrome) : le serveur
 * n'est pas sur ce réseau, c'est l'écran qui vient chercher la vidéo à l'adresse
 * publique de Movviz, avec un jeton qui n'ouvre que ce fichier.
 */
export interface CastLink {
  url: string;
  /** Remux Cast : « video/mp4 » ; DLNA : type du fichier d'origine (video/x-matroska…). */
  contentType: string;
  title: string;
  subtitle: string | null;
  posterUrl: string | null;
  durationSec: number;
  startSec: number;
  /** Session d'avancement : l'appareil qui pilote envoie les relevés (Reprendre, « Vu »). */
  progressSessionId: string | null;
  /** Flux continu (remux/recodage) : pas de plages d'octets, un saut recharge à « ?t= ». */
  stream: boolean;
  /** Fichier tel quel : taille en octets (fiche DIDL des téléviseurs DLNA). */
  sizeBytes: number | null;
  /** Même lien en HTTP (MOVVIZ_PUBLIC_HTTP_URL) : dernier recours des téléviseurs DLNA qui refusent le HTTPS. */
  httpUrl: string | null;
}

/** Au-delà, un fichier tel quel ne passe pas par l'envoi d'une box ordinaire : flux léger d'emblée. */
const REMOTE_DIRECT_MAX_BPS = 25_000_000;

function httpBase(): string | null {
  const raw = (process.env.MOVVIZ_PUBLIC_HTTP_URL ?? "").trim().replace(/\/+$/, "");
  return /^http:\/\/[^\s/]+(:\d+)?$/.test(raw) ? raw : null;
}

function posterUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https:\/\//.test(path)) return path;
  return path.startsWith("/") && !path.startsWith("/api/") ? `https://image.tmdb.org/t/p/w780${path}` : null;
}

export async function createCastLink(
  userId: string,
  command: Extract<ConnectCommand, { kind: "play" }>,
  publicBase: string,
  /** Modèle de l'écran (SDK Cast) : décide de la copie ou du recodage ; inconnu = profil sûr. */
  model: string | null = null,
  /**
   * « dlna » : téléviseur DLNA trouvé par le téléphone (Samsung, LG… sans Google Cast).
   * Fichier servi tel quel avec plages d'octets, comme le fait le serveur chez soi :
   * le téléviseur décode lui-même et navigue dans le film.
   */
  // « dlna-compat » : repli si le téléviseur refuse le fichier (vieux modèle, 4K/HDR) :
  // flux H.264 1080p + AAC (profil sûr), non navigable, un saut recharge à « ?t= ».
  via: "cast" | "dlna" | "dlna-compat" = "cast",
  /** L'appareil (donc l'écran à côté de lui) n'est pas sur le réseau du serveur. */
  remote = false,
): Promise<{ ok: true; link: CastLink } | { ok: false; error: string }> {
  const resolved = resolveConnectPlay(userId, command);
  if (!resolved) return { ok: false, error: "not_playable" };
  const item = resolved.queue[resolved.startIndex];
  const t = resolved.target;
  const source = t.type === "movie" ? resolveMoviePlayback(t.movvizId) : resolveEpisodePlayback(t.seriesId ?? "", t.seasonNumber ?? 0, t.episodeNumber ?? 0);
  const path = source.ok && source.value.source === "movviz" ? source.value.path : null;
  if (!path || !item) return { ok: false, error: "local_file_required" };

  const descriptor = await getOrProbeMediaDescriptor(t.movvizId, path).catch(() => null);
  const durationSec = descriptor?.durationMs ? descriptor.durationMs / 1000 : 0;
  const profile = castProfileFor(via === "cast" ? model : null, {
    videoCodec: descriptor?.video.codec, bitDepth: descriptor?.video.bitDepth, width: descriptor?.video.width,
    hdr: !!descriptor?.video.hdr, audioCodec: descriptor?.audioTracks[0]?.codec,
    toneMapAllowed: castToneMapAllowed(),
  });
  const subtitle = t.seasonNumber != null ? `S${t.seasonNumber} E${t.episodeNumber}${t.episodeTitle ? ` · ${t.episodeTitle}` : ""}` : null;
  // Hors de chez soi, un gros fichier (REMUX 4K…) saturerait l'envoi de la box : flux léger d'emblée.
  // Débit inconnu (analyse ratée) hors de chez soi : prudence, on le traite comme trop lourd.
  const heavy = remote && (descriptor?.bitrate == null || descriptor.bitrate > REMOTE_DIRECT_MAX_BPS);
  const direct = via === "dlna" && !heavy;
  // Trop lourd hors de chez soi : recodage IMPOSÉ et débit plafonné (une copie H.264 d'un
  // REMUX 1080p partirait sinon à 30-40 Mb/s), sur les deux voies (Google Cast et DLNA).
  const width = descriptor?.video.width ?? 0;
  const video = direct ? null : heavy
    ? { ...(profile.video ?? { width: Math.min(1920, width || 1920), toneMap: false, preset: width > 1920 ? "ultrafast" as const : "veryfast" as const, ...(width > 1920 ? { fastDecode: true } : {}) }), maxRateMbps: 12 }
    : profile.video;
  const token = createCastMedia({
    userId, path, mode: direct ? "direct" : "remux", title: subtitle ? `${t.title} — ${subtitle}` : t.title,
    transcodeAudio: !direct && (profile.transcodeAudio || heavy), video, durationSec: durationSec || null,
  });
  let progressSessionId: string | null = null;
  try {
    progressSessionId = openPlaybackSession(userId, {
      ratingKey: item.ratingKey, mediaId: t.movvizId, mediaType: t.type === "movie" ? "movie" : "episode",
      durationMs: Math.round(durationSec * 1000), tmdbId: t.tmdbId, seasonNumber: t.seasonNumber, episodeNumber: t.episodeNumber, title: t.title,
    }).session.id;
  } catch { /* l'avancement est un plus, jamais un blocage */ }
  return {
    ok: true,
    link: {
      url: `${publicBase.replace(/\/$/, "")}/api/connect/media/${token}`,
      contentType: direct ? contentTypeFor(path) : "video/mp4",
      title: t.title,
      subtitle,
      posterUrl: posterUrl(t.posterPath),
      durationSec,
      startSec: resolved.resumeSeconds ?? 0,
      progressSessionId,
      stream: !direct,
      sizeBytes: direct && descriptor?.size ? descriptor.size : null,
      httpUrl: via !== "cast" && httpBase() ? `${httpBase()}/api/connect/media/${token}` : null,
    },
  };
}
