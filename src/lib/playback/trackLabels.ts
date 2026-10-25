/**
 * Libellés des pistes audio / sous-titres du lecteur — une seule source pour
 * que le menu affiche toujours « Langue · codec canaux (titre) », que la
 * piste vienne de Plex ou de la sonde ffprobe locale. Aucun import serveur :
 * utilisable côté client.
 */

const AUDIO_CODEC_NAMES: Record<string, string> = {
  aac: "AAC", ac3: "AC-3", eac3: "E-AC-3", dts: "DTS", dca: "DTS", truehd: "TrueHD",
  mlp: "TrueHD", flac: "FLAC", opus: "Opus", vorbis: "Vorbis", mp3: "MP3", mp2: "MP2",
  pcm: "PCM", alac: "ALAC",
};

const SUBTITLE_CODEC_NAMES: Record<string, string> = {
  srt: "SRT", subrip: "SRT", ass: "ASS", ssa: "SSA", webvtt: "WebVTT", vtt: "WebVTT",
  mov_text: "TX3G", pgs: "PGS", hdmv_pgs_subtitle: "PGS", pgssub: "PGS",
  dvd_subtitle: "VobSub", dvdsub: "VobSub", vobsub: "VobSub", dvb_subtitle: "DVB",
};

export function audioCodecName(codec: string | null | undefined): string {
  const key = (codec ?? "").toLowerCase().replace(/[. _-]/g, "");
  if (!key) return "";
  if (key.startsWith("pcm")) return "PCM";
  return AUDIO_CODEC_NAMES[key] ?? key.toUpperCase();
}

export function subtitleCodecName(codec: string | null | undefined): string {
  const key = (codec ?? "").toLowerCase();
  if (!key) return "";
  return SUBTITLE_CODEC_NAMES[key] ?? key.toUpperCase();
}

/** 1→1.0, 2→2.0, 6→5.1, 8→7.1 (le dernier canal des multicanaux est le LFE). */
export function channelLayout(channels: number | null | undefined): string {
  const n = Math.round(Number(channels) || 0);
  if (n <= 0) return "";
  if (n <= 2) return `${n}.0`;
  return `${n - 1}.1`;
}

function dedupe(parts: (string | null | undefined | false)[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of parts) {
    const value = (part || "").trim();
    if (!value || seen.has(value.toLowerCase())) continue;
    seen.add(value.toLowerCase());
    out.push(value);
  }
  return out;
}

const TITLE_NOISE = new Set([
  "fr", "fre", "fra", "en", "eng", "de", "ger", "deu", "it", "ita", "es", "spa", "nl", "dut", "nld", "pt", "por",
  "full", "forced", "forcé", "forcés", "forces", "complet", "complets", "srt", "subrip", "pgs", "ass", "ssa",
  "vobsub", "sub", "subs", "subtitle", "subtitles", "audio",
]);

/** Les titres de pistes des releases répètent langue / codec / « Full » /
 *  « Forced » (« FR Full : SRT »). Ne garde que ce qui apporte une information
 *  en plus (« SDH », « VO », « Commentaire »…) ; chaîne vide si tout est redondant. */
export function cleanTrackTitle(title: string | null | undefined, redundant: (string | null | undefined)[] = []): string {
  const known = new Set(redundant.flatMap((value) => (value || "").toLowerCase().split(/[^\p{L}\p{N}]+/u)).filter(Boolean));
  const kept = (title || "").split(/[^\p{L}\p{N}.+]+/u).filter(Boolean).filter((token) => {
    const lower = token.toLowerCase();
    return !TITLE_NOISE.has(lower) && !known.has(lower) && !/^\d+(\.\d+)?$/.test(lower);
  });
  return kept.join(" ");
}

/** « Français · E-AC-3 5.1 » — le titre du conteneur est ajouté seulement
 *  quand il apporte une information en plus (commentaire, VO, etc.). */
export function audioTrackLabel(track: {
  language?: string | null; codec?: string | null; channels?: number | null; title?: string | null; id?: string;
}): string {
  const codec = [audioCodecName(track.codec), channelLayout(track.channels)].filter(Boolean).join(" ");
  const language = (track.language || "").trim();
  const title = cleanTrackTitle(track.title, [language, audioCodecName(track.codec), track.codec]);
  const parts = dedupe([language, codec, title]);
  return parts.length ? parts.join(" · ") : (track.id ?? "");
}

/** « Français · SRT · Forcé » */
export function subtitleTrackLabel(track: {
  language?: string | null; codec?: string | null; title?: string | null; forced?: boolean | null; id?: string;
}, forcedLabel = "Forced"): string {
  const language = (track.language || "").trim();
  const title = cleanTrackTitle(track.title, [language, subtitleCodecName(track.codec), track.codec]);
  const parts = dedupe([language, subtitleCodecName(track.codec), title, track.forced && forcedLabel]);
  return parts.length ? parts.join(" · ") : (track.id ?? "");
}
