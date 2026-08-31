/**
 * Résolution partagée du fichier Plex brut d'un ratingKey — server-side.
 *
 * Utilisée par le pipeline MSE (parseur MP4 maison) ET le pipeline ffmpeg
 * remux : les deux ont besoin de la même URL de fichier source
 * (`/library/parts/{id}/file.{ext}`) et des mêmes headers d'authentification
 * Plex. Extrait de `mse/source.ts` pour éviter la duplication.
 */
import { loadPlexConfig } from "@/lib/plex/store";
import { safePlexUrl } from "@/lib/plex/safeUrl";
import { plexClientHeaders } from "@/lib/player/plexStream";

export interface PlexAudioStreamRef {
  /** Index de la piste dans la liste des pistes audio de ce Part (ordre = -map 0:a:<index> ffmpeg) */
  index: number;
  id: number | null;
  codec: string | null;
  language: string | null;
  selected: boolean;
}

export interface PlexSubtitleStreamRef {
  /** Index de la piste dans la liste des pistes sous-titres de ce Part (ordre = -map 0:s:<index> ffmpeg) */
  index: number;
  id: number | null;
  codec: string | null;
  language: string | null;
  /** true si ffmpeg peut convertir la piste en WebVTT texte (srt/ass/ssa/webvtt/mov_text…) */
  toTextConvertible: boolean;
  selected: boolean;
}

/** Codecs de sous-titres TEXTE extractibles en WebVTT par ffmpeg (les pistes
 *  image — pgs/vobsub — ne sont pas convertibles en texte). */
export function isSubtitleToTextCodec(codec: string | null | undefined): boolean {
  const c = (codec ?? "").toLowerCase();
  return [
    "srt", "subrip", "ass", "ssa", "webvtt", "vtt",
    "mov_text", "text", "ttml", "subtext",
  ].includes(c);
}

export interface PlexPartRef {
  /** URL brute du fichier chez Plex (/library/parts/{id}/file.{ext}) */
  sourceUrl: string;
  headers: Record<string, string>;
  container: string | null;
  videoCodec: string | null;
  audioStreams: PlexAudioStreamRef[];
  subtitleStreams: PlexSubtitleStreamRef[];
  /** ID numérique du Part — nécessaire pour /library/parts/{id}/indexes/sd/{ms} (vignettes BIF de scrub). */
  partId: number | null;
  /** Base Plex (`http(s)://host:port`) — pour construire d'autres endpoints (BIF, chapitres) sans re-résoudre la config. */
  base: string;
  /** Durée totale Plex, en millisecondes. Indispensable pour un MP4
   * fragmenté FFmpeg : le navigateur ne connaît que la durée déjà reçue. */
  durationMs: number | null;
}

export async function resolvePlexPartUrl(
  ratingKey: string,
  userId: string
): Promise<PlexPartRef | null> {
  const cfg = loadPlexConfig();
  if (!cfg.hostname || !cfg.adminToken) return null;
  const base = safePlexUrl(`${cfg.useSsl ? "https" : "http"}://${cfg.hostname}:${cfg.port}`);
  if (!base) return null;
  const headers = plexClientHeaders(cfg.adminToken, `movviz-${userId}`);

  try {
    const metaRes = await fetch(`${base}/library/metadata/${ratingKey}`, {
      headers,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!metaRes.ok) return null;
    const data = await metaRes.json();
    const metadata = data?.MediaContainer?.Metadata?.[0];
    const media = metadata?.Media?.[0];
    const part = media?.Part?.[0];
    if (!part?.id && !part?.key) return null;

    const streamPath =
      typeof part.key === "string" && part.key.startsWith("/")
        ? part.key
        : `/library/parts/${part.id}/file.${media.container || "mp4"}`;
    const sourceUrl = `${base}${streamPath}`;

    const streams: Array<{ id?: number; streamType?: number; codec?: string; language?: string; selected?: boolean }> =
      part?.Stream ?? [];
    const audioStreams: PlexAudioStreamRef[] = streams
      .filter((s) => s.streamType === 2)
      .map((s, index) => ({
        index,
        id: typeof s.id === "number" ? s.id : null,
        codec: s.codec ?? null,
        language: s.language ?? null,
        selected: s.selected === true,
      }));

    const subtitleStreams: PlexSubtitleStreamRef[] = streams
      .filter((s) => s.streamType === 3)
      .map((s, index) => ({
        index,
        id: typeof s.id === "number" ? s.id : null,
        codec: s.codec ?? null,
        language: s.language ?? null,
        toTextConvertible: isSubtitleToTextCodec(s.codec),
        selected: s.selected === true,
      }));

    return {
      sourceUrl,
      headers,
      container: media?.container ?? null,
      videoCodec: media?.videoCodec ?? null,
      audioStreams,
      subtitleStreams,
      partId: typeof part.id === "number" ? part.id : null,
      base,
      durationMs: typeof metadata?.duration === "number" && metadata.duration > 0
        ? metadata.duration
        : null,
    };
  } catch (e) {
    console.error("[plexSource] resolve failed", ratingKey, e);
    return null;
  }
}
