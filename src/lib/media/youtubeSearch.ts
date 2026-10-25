const LANG_TERMS: Record<string, string> = {
  fr: "bande-annonce officielle VF",
  en: "official trailer",
  de: "offizieller Trailer",
  it: "trailer ufficiale",
  nl: "officiële trailer",
};

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const EXCLUDED = /\b(spot|teaser|clip|featurette|recap|reaction|interview|making[- ]of|shorts?|review|explained|breakdown|fan[- ]?made|concept)\b/i;
// Studios, distributors and anime publishers whose uploads are the real trailer.
const OFFICIAL = /\b(marvel|disney|warner|sony|universal|paramount|netflix|prime video|official|crunchyroll|toei|bandai|aniplex|funimation|adn|anime digital network|wakanim|kaze|gkids|viz|tms|madman|muse|ani-one)\b/i;

type Row = { id: string; title: string; channel: string; duration: string };

async function fetchResults(query: string): Promise<Row[]> {
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return [];
  const html = await res.text();

  // Read the result metadata instead of returning the first videoId in the
  // page. YouTube mixes spots, interviews, recaps and unrelated videos into
  // the result list; the first ID is therefore not a safe trailer fallback.
  const script = html.match(/var ytInitialData\s*=\s*(\{.*?\});/s)?.[1];
  let data: unknown;
  if (script) {
    try { data = JSON.parse(script); } catch { data = undefined; }
  }
  const rows: Row[] = [];
  const walk = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (Array.isArray(value)) { value.forEach(walk); return; }
    const obj = value as Record<string, unknown>;
    const renderer = obj.videoRenderer as Record<string, unknown> | undefined;
    if (renderer && typeof renderer.videoId === "string") {
      const title = String((renderer.title as Record<string, unknown> | undefined)?.runs instanceof Array
        ? ((renderer.title as { runs: Array<{ text?: string }> }).runs.map((r) => r.text ?? "").join(""))
        : "");
      const channel = String((renderer.ownerText as Record<string, unknown> | undefined)?.runs instanceof Array
        ? ((renderer.ownerText as { runs: Array<{ text?: string }> }).runs.map((r) => r.text ?? "").join(""))
        : "");
      const duration = String((renderer.lengthText as { simpleText?: string } | undefined)?.simpleText ?? "");
      rows.push({ id: renderer.videoId, title, channel, duration });
    }
    Object.values(obj).forEach(walk);
  };
  walk(data);

  // Fallback for a changed YouTube markup: retain IDs, but give them no
  // metadata so they can only win when there is no structured result.
  if (!rows.length) {
    for (const m of html.matchAll(/[?"&]videoId[=:]"?([a-zA-Z0-9_-]{11})/g)) {
      if (!rows.some((r) => r.id === m[1])) rows.push({ id: m[1], title: "", channel: "", duration: "" });
    }
  }
  return rows;
}

const fold = (s: string) => s.toLocaleLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();

function rank(rows: Row[], title: string, language: string): Row[] {
  const normalizedTitle = fold(title);
  const wantedLanguage = language === "fr" ? /\b(vf|vostfr|francais|française|french)\b/i : /\b(official|trailer)\b/i;
  return rows.map((row, index) => {
    let score = 0;
    if (fold(row.title).includes(normalizedTitle)) score += 50;
    if (/\b(trailer|bande[- ]annonce|pv)\b/i.test(row.title)) score += 30;
    if (wantedLanguage.test(row.title)) score += 20;
    if (OFFICIAL.test(row.channel) || OFFICIAL.test(row.title)) score += 15;
    if (/\b(officiale?|officiel(?:le)?|official)\b/i.test(row.title)) score += 10;
    if (EXCLUDED.test(row.title)) score -= 100;
    if (!row.duration) score -= 5;
    return { row, score, index };
  })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    // Never return an unverified result. If YouTube's markup no longer
    // exposes usable metadata, the safe answer is no fallback at all.
    // Le titre du film doit figurer dans celui de la vidéo : sans cette
    // condition, « Loki - Bande-annonce officielle (VF) | Disney+ » cumulait
    // assez de points (bande-annonce + VF + Disney + officielle) pour passer
    // comme bande-annonce de « Le Bon, le Bart et le Loki ».
    .filter(({ row, score }) => score >= 45 && !EXCLUDED.test(row.title) && !!normalizedTitle && fold(row.title).includes(normalizedTitle))
    .map(({ row }) => row);
}

export async function searchYouTubeTrailer(
  title: string,
  year: number | null,
  language: string
): Promise<string | null> {
  return (await searchYouTubeTrailers(title, year, language, { limit: 1 }))[0] ?? null;
}

/**
 * Several ranked trailer candidates for a title — used when every TMDb
 * video refuses to play embedded (YouTube error 101/150: the rights holder
 * forbids playback outside YouTube). Searches in the user's language, then
 * in English, and skips `exclude` (keys already known to be blocked).
 */
export async function searchYouTubeTrailers(
  title: string,
  year: number | null,
  language: string,
  opts: { exclude?: ReadonlySet<string>; limit?: number } = {}
): Promise<string[]> {
  const limit = opts.limit ?? 5;
  const terms = [LANG_TERMS[language] ?? "official trailer", ...(language === "en" ? [] : ["trailer"])];
  const out: string[] = [];
  try {
    for (const term of terms) {
      const rows = await fetchResults(`${title} ${year ?? ""} ${term}`.replace(/\s+/g, " ").trim());
      for (const row of rank(rows, title, language)) {
        if (opts.exclude?.has(row.id) || out.includes(row.id)) continue;
        out.push(row.id);
        if (out.length >= limit) return out;
      }
    }
  } catch {
    // Network failure — silent fallback
  }
  return out;
}
