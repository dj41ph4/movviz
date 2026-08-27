import { titleSimilarity } from "@/lib/library/matching";

const FETCH_TIMEOUT_MS = 3000;
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

export interface RawYoutubeCandidate {
  key: string;
  title: string;
  channelId: string;
  channelTitle?: string;
}

/**
 * Recherche YouTube générique — extrait les videoIds du html de
 * /results?search_query=... Ne dépend pas d'une API officielle.
 * Filtre optionnel par channelId de confiance côté appelant.
 */
export async function searchYoutubeRaw(query: string): Promise<RawYoutubeCandidate[]> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
    });
    if (!res.ok) return [];
    const html = await res.text();
    // Extract ytInitialData JSON block to get structured videoRenderer entries
    // Fallback: regex videoId
    const candidates: RawYoutubeCandidate[] = [];
    const seen = new Set<string>();
    // Try structured extraction: look for videoId + channelId pairs in JSON
    // Simplest robust approach: regex all videoIds, then for each try to find nearby channelId
    const ids = [...html.matchAll(/[?"&]videoId[=:]"?([a-zA-Z0-9_-]{11})/g)];
    for (const m of ids) {
      const key = m[1];
      if (seen.has(key)) continue;
      seen.add(key);
      // Skip reels/channels/playlists markers near this id
      if (html.includes(`"${key}","type":"reel"`)) continue;
      if (html.includes(`"${key}","type":"channel"`)) continue;
      // Attempt to extract channelId near this videoId (within 3000 chars)
      const idx = html.indexOf(key);
      const window = html.slice(Math.max(0, idx - 2000), idx + 3000);
      const chMatch = window.match(/"channelId"\s*:\s*"(UC[a-zA-Z0-9_-]{22})"/);
      const titleMatch = window.match(/"title"\s*:\s*\{"runs":\s*\[\{"text":\s*"([^"]{2,120})"/) || window.match(/"title"\s*:\s*"([^"]{2,120})"/);
      let title = titleMatch ? titleMatch[1] : "";
      // Fallback: try simpleText
      if (!title) {
        const simple = window.match(/"simpleText"\s*:\s*"([^"]{5,120})"/);
        if (simple) title = simple[1];
      }
      candidates.push({ key, title: title || "", channelId: chMatch ? chMatch[1] : "", channelTitle: undefined });
      if (candidates.length >= 12) break;
    }
    return candidates;
  } catch {
    return [];
  }
}

export function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function detectContentType(title: string): "teaser" | "trailer" | null {
  const n = normalizeTitle(title);
  // Reject explicit non-trailer types
  if (/\b(clip|featurette|interview|making of|behind the scenes|bloopers|tv spot|scene|excerpt|deleted scene)\b/.test(n)) return null;
  const hasTeaser = /\bteaser\b/.test(n);
  const hasTrailer = /\btrailer\b/.test(n) || /\bbande annonce\b/.test(n);
  if (hasTeaser && !hasTrailer) return "teaser";
  if (hasTrailer) return "trailer";
  // If neither but title looks like trailer (e.g. contains restoration terms), treat as trailer
  if (/\b(restored|remastered|re trailer|restoration|4k|hd)\b/.test(n) && /\b(trailer|bande)\b/.test(n)) return "trailer";
  return null;
}

export function detectRestoration(title: string): import("./types").RestorationType {
  const n = normalizeTitle(title);
  if (/\brestored\b|\brestauree\b|\brestaure\b|\brestoration\b|\bbande annonce restauree\b/.test(n)) return "restored";
  if (/\bremastered\b|\bremaster\b|\bremasterisee\b/.test(n)) return "remastered";
  if (/\bre trailer\b|\bretrailer\b|\brecreated trailer\b|\brecreation\b/.test(n)) return "re-trailer";
  if (/\bhd master\b|\b4k master\b|\b4k restoration\b/.test(n)) return "hd-master";
  return "unknown";
}

export function detectLanguage(title: string, locale: string): string | null {
  const n = normalizeTitle(title);
  // Strong VF signals
  if (/\b(vf|version francaise|french|bande annonce vf|vf trailer)\b/.test(n)) return "fr";
  if (/\b(vo|version originale|original)\b/.test(n)) {
    // VO without language qualifier — return null to let locale fallback handle it
    return null;
  }
  // Locale fallback based on explicit language word
  const langTerms: Record<string, string[]> = {
    fr: ["vf", "francaise", "french"],
    en: ["english", "official trailer"],
    de: ["deutsch", "offizieller trailer"],
    it: ["italiano", "trailer ufficiale"],
    nl: ["nederlands", "officiele trailer"],
  };
  for (const [lang, terms] of Object.entries(langTerms)) {
    if (terms.some((t) => n.includes(normalizeTitle(t)))) return lang;
  }
  // For fr locale, VF is strong but not deducible from ambiguous word — stay null
  return null;
}

export function scoreTitleSimilarity(queryTitle: string, candidateTitle: string): number {
  return titleSimilarity(queryTitle, candidateTitle);
}
