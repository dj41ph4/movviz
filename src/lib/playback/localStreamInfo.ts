import { isFfmpegAvailable } from "@/lib/playback/ffmpeg/remuxSession";
import { getPlaybackMarkers } from "@/lib/playback/markers/store";
import { isSubtitleToTextCodec, resolvePlexPartUrl } from "@/lib/playback/plexSource";
import { getOrProbeMediaDescriptor } from "@/lib/playback/engine/mediaProbeCache";

/**
 * Metadata used by the desktop player when its first leg reads Movviz's
 * local file.  The file remains the first playback source; Plex is queried
 * only for the stream description necessary to select an audio track or the
 * FFmpeg remux fallback.  Without that description, a local MKV with AC-3
 * looked like an unknown direct stream and the player could never select the
 * audio-only FFmpeg path.
 *
 * mediaId/filePath (optional — movie/episode callers that have them) unlock
 * a language-label cross-check against Movviz's own ffprobe MediaDescriptor
 * (already cached by getOrProbeMediaDescriptor, so this costs nothing extra
 * on a warm file). Plex's own scanned `language` tag can be wrong (confirmed
 * live: "8 Mile" 's Plex metadata reports its first audio track as French
 * when the container's own tag — and the actual audio — is English); ffprobe
 * reads the container's tag directly, so it wins whenever both exist for the
 * same ordinal stream position. Selection itself never depended on this
 * label (the player already matches tracks by position, not by id/language),
 * so this only fixes what's DISPLAYED in the audio/subtitle menus.
 */
/** ffprobe reports ISO 639-2 (3-letter, e.g. "eng"/"fre"). Intl.DisplayNames
 *  wants a BCP-47 subtag (2-letter ISO 639-1) to produce the language's own
 *  autonym ("français" when asked in French, "English" when asked in
 *  English) — matching exactly what Plex's own labels already look like
 *  when they're correct. Covers the languages actually seen in this app's
 *  media library rather than the full ISO 639-2 set. */
const ISO_639_2_TO_1: Record<string, string> = {
  eng: "en", fre: "fr", fra: "fr", ger: "de", deu: "de", ita: "it", spa: "es",
  por: "pt", dut: "nl", nld: "nl", jpn: "ja", kor: "ko", chi: "zh", zho: "zh",
  rus: "ru", ara: "ar", swe: "sv", nor: "no", dan: "da", fin: "fi", pol: "pl",
  tur: "tr", hin: "hi", gre: "el", ell: "el", ces: "cs", cze: "cs", hun: "hu",
};

function ffprobeLanguageAutonym(code: string | undefined): string | null {
  if (!code) return null;
  const iso1 = ISO_639_2_TO_1[code.toLowerCase()] ?? (code.length === 2 ? code.toLowerCase() : null);
  if (!iso1) return null;
  try {
    const name = new Intl.DisplayNames([iso1], { type: "language" }).of(iso1);
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : null;
  } catch {
    return null;
  }
}

/** Corrects a Plex-sourced stream's displayed language against Movviz's own
 *  ffprobe tag for the SAME ordinal position (see getLocalStreamInfo's own
 *  comment) — only when ffprobe actually has a real tag AND it genuinely
 *  disagrees with Plex's. A stream ffprobe has no tag for keeps Plex's label
 *  untouched rather than replacing a real (if wrong) label with nothing. */
export function correctedLanguage(plexLanguage: string, ffprobeCode: string | undefined): string {
  const autonym = ffprobeLanguageAutonym(ffprobeCode);
  if (!autonym) return plexLanguage;
  const current = plexLanguage.trim().toLowerCase();
  // Loose match: "français"/"French"/"fr" all count as already-correct, no
  // need to overwrite a label that's merely in a different script/language
  // than the autonym itself.
  if (current === autonym.toLowerCase()) return plexLanguage;
  return autonym;
}

type MediaDescriptorLike = NonNullable<Awaited<ReturnType<typeof getOrProbeMediaDescriptor>>>;

/** Listes de pistes issues de la sonde ffprobe seule — utilisées quand Plex
 *  n'a rien à dire (titre purement local, pas encore scanné) pour que le
 *  menu audio / sous-titres existe quand même. L'id est l'index ffprobe : le
 *  lecteur relie le choix du menu à la piste réelle par position, jamais par id. */
function streamsFromDescriptor(media: MediaDescriptorLike) {
  return {
    audioStreams: media.audioTracks.map((track) => ({
      id: String(track.index),
      codec: track.codec ?? "",
      language: ffprobeLanguageAutonym(track.language) ?? track.language ?? "",
      title: track.title ?? "",
      channels: track.channels ?? 0,
      forced: !!track.forced,
      selected: !!track.default,
    })),
    subtitleStreams: media.subtitleTracks.map((track) => ({
      id: String(track.index),
      codec: track.codec ?? "",
      language: ffprobeLanguageAutonym(track.language) ?? track.language ?? "",
      title: track.title ?? "",
      forced: !!track.forced,
      toTextConvertible: track.type === "text",
      selected: !!track.default,
    })),
  };
}

export async function getLocalStreamInfo(plexRatingKey: string | null, userId: string, mediaId?: string, filePath?: string) {
  const markers = getPlaybackMarkers(plexRatingKey ?? "");
  if (!plexRatingKey) {
    const localMedia = mediaId && filePath ? await getOrProbeMediaDescriptor(mediaId, filePath).catch(() => null) : null;
    const local = localMedia ? streamsFromDescriptor(localMedia) : { audioStreams: [], subtitleStreams: [] };
    return {
      videoCodec: null,
      audioCodec: null,
      container: null,
      ...local,
      ffmpegAvailable: false,
      durationMs: null,
      markers,
    };
  }

  const [part, ffmpegAvailable, media] = await Promise.all([
    resolvePlexPartUrl(plexRatingKey, userId),
    isFfmpegAvailable().catch(() => false),
    mediaId && filePath ? getOrProbeMediaDescriptor(mediaId, filePath).catch(() => null) : Promise.resolve(null),
  ]);
  if (!part) {
    return {
      videoCodec: null,
      audioCodec: null,
      container: null,
      ...(media ? streamsFromDescriptor(media) : { audioStreams: [], subtitleStreams: [] }),
      ffmpegAvailable: false,
      durationMs: null,
      markers,
    };
  }

  // Priorité aux informations propres à Movviz (ffprobe sur le fichier) : langue,
  // titre, codec, canaux et piste par défaut viennent d'abord de la sonde.
  // Plex ne complète que ce qui manque, et fournit l'id de la piste de même
  // position (nécessaire à ses propres routes de repli) — la position reste
  // le lien entre les deux, comme partout dans le lecteur.
  const probed = media ? streamsFromDescriptor(media) : null;
  const audioStreams = probed && probed.audioStreams.length > 0
    ? probed.audioStreams.map((stream, i) => ({ ...stream, id: String(part.audioStreams[i]?.id ?? stream.id) }))
    : part.audioStreams.map((stream) => ({
      id: String(stream.id ?? ""),
      codec: stream.codec ?? "",
      language: stream.language ?? "",
      title: stream.title ?? "",
      channels: stream.channels ?? 0,
      forced: false,
      selected: stream.selected,
    }));
  const subtitleStreams = probed && probed.subtitleStreams.length > 0
    ? probed.subtitleStreams.map((stream, i) => ({ ...stream, id: String(part.subtitleStreams[i]?.id ?? stream.id) }))
    : part.subtitleStreams.map((stream) => ({
      id: String(stream.id ?? ""),
      codec: stream.codec ?? "",
      language: stream.language ?? "",
      title: stream.title ?? "",
      forced: stream.forced ?? false,
      toTextConvertible: isSubtitleToTextCodec(stream.codec),
      selected: stream.selected,
    }));

  return {
    videoCodec: part.videoCodec,
    audioCodec: audioStreams.find((stream) => stream.selected)?.codec ?? audioStreams[0]?.codec ?? null,
    container: part.container,
    audioStreams,
    subtitleStreams,
    // A binary alone is not enough: the FFmpeg route needs this exact Plex
    // source too, so do not advertise remux when metadata resolution failed.
    ffmpegAvailable,
    durationMs: part.durationMs,
    markers,
  };
}
