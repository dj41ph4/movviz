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

    // Read the result metadata instead of returning the first videoId in the
    // page. YouTube mixes spots, interviews, recaps and unrelated videos into
    // the result list; the first ID is therefore not a safe trailer fallback.
    const script = html.match(/var ytInitialData\s*=\s*(\{.*?\});/s)?.[1];
    let data: unknown;
    if (script) {
      try { data = JSON.parse(script); } catch { data = undefined; }
    }
    const rows: Array<{ id: string; title: string; channel: string; duration: string }> = [];
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
    const normalizedTitle = title.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const excluded = /\b(spot|teaser|clip|featurette|recap|reaction|interview|making[- ]of|shorts?)\b/i;
    const official = /\b(marvel|disney|warner|sony|universal|paramount|netflix|prime video|official)\b/i;
    const wantedLanguage = language === "fr" ? /\b(vf|francais|française|french)\b/i : /\b(official|trailer)\b/i;
    const scored = rows.map((row, index) => {
      const normalized = row.title.toLocaleLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      let score = 0;
      if (normalized.includes(normalizedTitle)) score += 50;
      if (/\b(trailer|bande[- ]annonce)\b/i.test(row.title)) score += 30;
      if (wantedLanguage.test(row.title)) score += 20;
      if (official.test(row.channel) || official.test(row.title)) score += 15;
      if (/\b(officiale?|officiel(?:le)?|official)\b/i.test(row.title)) score += 10;
      if (excluded.test(row.title)) score -= 100;
      if (!row.duration) score -= 5;
      return { row, score, index };
    }).sort((a, b) => b.score - a.score || a.index - b.index);
    const winner = scored.find(({ row, score }) => score >= 45 && !excluded.test(row.title)) ?? scored.find(({ row }) => !excluded.test(row.title));
    if (winner) return winner.row.id;


  } catch {
    // Network failure — silent fallback
  }

  return null;
}
