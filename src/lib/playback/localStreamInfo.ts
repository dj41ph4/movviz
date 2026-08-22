import { isFfmpegAvailable } from "@/lib/playback/ffmpeg/remuxSession";
import { getPlaybackMarkers } from "@/lib/playback/markers/store";
import { isSubtitleToTextCodec, resolvePlexPartUrl } from "@/lib/playback/plexSource";

/**
 * Metadata used by the desktop player when its first leg reads Movviz's
 * local file.  The file remains the first playback source; Plex is queried
 * only for the stream description necessary to select an audio track or the
 * FFmpeg remux fallback.  Without that description, a local MKV with AC-3
 * looked like an unknown direct stream and the player could never select the
 * audio-only FFmpeg path.
 */
export async function getLocalStreamInfo(plexRatingKey: string | null, userId: string) {
  const markers = getPlaybackMarkers(plexRatingKey ?? "");
  if (!plexRatingKey) {
    return {
      videoCodec: null,
      audioCodec: null,
      container: null,
      audioStreams: [],
      subtitleStreams: [],
      ffmpegAvailable: false,
      durationMs: null,
      markers,
    };
  }

  const [part, ffmpegAvailable] = await Promise.all([
    resolvePlexPartUrl(plexRatingKey, userId),
    isFfmpegAvailable().catch(() => false),
  ]);
  if (!part) {
    return {
      videoCodec: null,
      audioCodec: null,
      container: null,
      audioStreams: [],
      subtitleStreams: [],
      ffmpegAvailable: false,
      durationMs: null,
      markers,
    };
  }

  const audioStreams = part.audioStreams.map((stream) => ({
    id: String(stream.id ?? ""),
    codec: stream.codec ?? "",
    language: stream.language ?? "",
    channels: 0,
    selected: stream.selected,
  }));
  const subtitleStreams = part.subtitleStreams.map((stream) => ({
    id: String(stream.id ?? ""),
    codec: stream.codec ?? "",
    language: stream.language ?? "",
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
