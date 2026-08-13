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

export interface PlexPartRef {
  /** URL brute du fichier chez Plex (/library/parts/{id}/file.{ext}) */
  sourceUrl: string;
  headers: Record<string, string>;
  container: string | null;
  videoCodec: string | null;
  audioStreams: PlexAudioStreamRef[];
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

    return {
      sourceUrl,
      headers,
      container: media?.container ?? null,
      videoCodec: media?.videoCodec ?? null,
      audioStreams,
    };
  } catch (e) {
    console.error("[plexSource] resolve failed", ratingKey, e);
    return null;
  }
}
