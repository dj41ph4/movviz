const LANG_TERMS: Record<string, string> = {
  fr: "bande-annonce officielle VF",
  en: "official trailer",
  de: "offizieller Trailer",
  it: "trailer ufficiale",
  nl: "officiële trailer",
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

export async function searchYouTubeTrailer(
  title: string,
  year: number | null,
  language: string
): Promise<string | null> {
  const term = LANG_TERMS[language] ?? "official trailer";
  const query = `${title} ${year ?? ""} ${term}`.trim();
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return null;
    const html = await res.text();

    // YouTube embeds search results as `ytInitialData` JSON in a <script> tag.
    // Video IDs appear as `"videoId":"XXXXXXXXXXX"` (JSON) and occasionally
    // in URL params within the HTML. We match both forms.
    const ids = [...html.matchAll(/[?"&]videoId[=:]"?([a-zA-Z0-9_-]{11})/g)];
    if (ids.length > 0) {
      const seen = new Set<string>();
      for (const m of ids) {
        const id = m[1];
        if (seen.has(id)) continue;
        seen.add(id);
        // Skip non-video patterns (reels, channels, playlists)
        if (html.includes(`"${id}","type":"reel"`)) continue;
        if (html.includes(`"${id}","type":"channel"`)) continue;
        if (html.includes(`"${id}","type":"playlist"`)) continue;
        return id;
      }
    }


  } catch {
    // Network failure — silent fallback
  }

  return null;
}
