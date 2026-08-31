import { parseRelease } from "@/lib/naming/parser";
import type { LibraryFile } from "./types";

export interface PlexLanguageSource {
  audioStreams: { language: string | null; codec?: string }[];
  subtitleStreams: { language: string | null }[];
}

/** Locale → prefixes an actual Plex stream language/languageCode can carry
 *  for that language (full English name from `language`, ISO 639-1/2/3
 *  variants from `languageCode`) — e.g. "French"/"fr"/"fre"/"fra" all mean
 *  the same French track. */
const LOCALE_LANGUAGE_PREFIXES: Record<string, string[]> = {
  fr: ["french", "fr", "fre", "fra"],
  en: ["english", "en", "eng"],
  it: ["italian", "it", "ita"],
  nl: ["dutch", "nl", "nld", "dut"],
  de: ["german", "de", "ger", "deu"],
  // Pas une langue d'interface Movviz (5 locales UI) — uniquement une option
  // de préférence audio (voir preferredAudioLanguage dans userPrefs/store.ts).
  es: ["spanish", "es", "spa"],
};

/**
 * Generic locale→track matcher shared by every "pick the stream matching
 * Movviz's UI language" use site (audio codec badge, player default audio/
 * subtitle selection) — one prefix table, never reimplemented per caller.
 */
export function findTrackForLocale<T extends { language?: string | null }>(
  tracks: T[] | null | undefined,
  locale: string
): T | null {
  if (!tracks?.length) return null;
  const prefixes = LOCALE_LANGUAGE_PREFIXES[locale];
  if (!prefixes) return null;
  return (
    tracks.find((s) => {
      const lang = (s.language ?? "").toLowerCase();
      return lang && prefixes.some((p) => lang.startsWith(p));
    }) ?? null
  );
}

/**
 * Picks the audio track matching Movviz's own selected UI language — a file
 * can have English EAC3 and French AAC at once, and which one is "the" audio
 * codec badge shouldn't depend on stream order in the source file (Plex/
 * ffprobe just report them in whatever order the container stores them).
 * Returns null when no stream matches (falls back to whatever the caller
 * already had — unaffected file/parsed-based codec detection is unchanged).
 */
export function findAudioStreamForLocale(
  info: PlexLanguageSource | null | undefined,
  locale: string
): { language: string | null; codec?: string } | null {
  if (!info?.audioStreams.length) return null;
  return findTrackForLocale(info.audioStreams, locale);
}

export function deriveLanguageFromPlex(info: PlexLanguageSource | null | undefined): string | null {
  if (!info || info.audioStreams.length === 0) return null;
  const audioLangs = new Set(info.audioStreams.map((s) => (s.language ?? "").toLowerCase()).filter(Boolean));
  const hasFrenchAudio = [...audioLangs].some((l) => l.startsWith("fr"));
  const hasOtherAudio = [...audioLangs].some((l) => !l.startsWith("fr"));
  if (hasFrenchAudio && hasOtherAudio) return "MULTI · VF";
  if (hasFrenchAudio) return "VF";
  if (hasOtherAudio) {
    const hasFrenchSub = info.subtitleStreams.some((s) => (s.language ?? "").toLowerCase().startsWith("fr"));
    return hasFrenchSub ? "VOSTFR" : "VO";
  }
  return null;
}

export function detectFileLanguage(file: LibraryFile | null | undefined, plexInfo?: PlexLanguageSource | null): string | null {
  if (!file) return null;
  const plexLang = deriveLanguageFromPlex(plexInfo);
  if (plexLang) return plexLang;
  const basename = file.path.replace(/^.*[/\\]/, "").replace(/\.(mkv|mp4|avi|ts|m2ts|wmv|mov|webm|flv)$/i, "");
  return parseRelease(basename).language;
}
