import { parseRelease } from "@/lib/naming/parser";
import type { LibraryFile } from "./types";

export interface PlexLanguageSource {
  audioStreams: { language: string | null }[];
  subtitleStreams: { language: string | null }[];
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
