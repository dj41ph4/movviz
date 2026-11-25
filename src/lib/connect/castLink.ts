import { resolveConnectPlay } from "@/lib/connect/resolve";
import { castProfileFor, createCastMedia } from "@/lib/connect/castMedia";
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
  contentType: "video/mp4";
  title: string;
  subtitle: string | null;
  posterUrl: string | null;
  durationSec: number;
  startSec: number;
  /** Session d'avancement : l'appareil qui pilote envoie les relevés (Reprendre, « Vu »). */
  progressSessionId: string | null;
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
  const profile = castProfileFor(model, {
    videoCodec: descriptor?.video.codec, bitDepth: descriptor?.video.bitDepth, width: descriptor?.video.width,
    hdr: !!descriptor?.video.hdr, audioCodec: descriptor?.audioTracks[0]?.codec,
  });
  const subtitle = t.seasonNumber != null ? `S${t.seasonNumber} E${t.episodeNumber}${t.episodeTitle ? ` · ${t.episodeTitle}` : ""}` : null;
  const token = createCastMedia({
    userId, path, mode: "remux", title: subtitle ? `${t.title} — ${subtitle}` : t.title,
    transcodeAudio: profile.transcodeAudio, video: profile.video, durationSec: durationSec || null,
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
      contentType: "video/mp4",
      title: t.title,
      subtitle,
      posterUrl: posterUrl(t.posterPath),
      durationSec,
      startSec: resolved.resumeSeconds ?? 0,
      progressSessionId,
    },
  };
}
