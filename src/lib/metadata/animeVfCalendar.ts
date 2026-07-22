import { titleSimilarity } from "@/lib/library/matching";
import { getCache } from "@/lib/cache/registry";

/**
 * There is no official API or feed anywhere for "when does a TV episode's
 * French dub release" — TMDb/TheTVDB only track the original air date, and
 * BetaSeries' "subtitles" data is community-uploaded .srt files, not an
 * official dub schedule. The one place this information genuinely exists in
 * a consistent, structured form is anime: French streamers (Crunchyroll, ADN,
 * Netflix, Disney+) announce VF dub launch dates per season, and mang-actu.com
 * republishes them as a clean HTML calendar. There's no public API for it
 * either, so this scrapes the page directly — best-effort, and it WILL break
 * if the site changes its markup. Scoped to anime season/film VF launch
 * dates only; it says nothing about individual episode air dates.
 */

const SOURCE_URL = "https://mang-actu.com/calendrier-des-sorties-animes-vf/";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h — the source itself only updates a few times a day

export interface AnimeVfLaunch {
  title: string;
  platform: string;
  launchDate: string; // ISO date
  vostfrOnly: boolean; // true = no French dub announced, subtitles only
  type: string; // "nouvelle saison" | "nouvelle série" | "film"
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

async function scrape(): Promise<AnimeVfLaunch[]> {
  try {
    const res = await fetch(SOURCE_URL, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; Movviz)" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return [];
    const html = await res.text();

    // Every entry starts with `<a class="masa-card" ...>` or `<div class="masa-card" ...>` —
    // split on that boundary so each chunk holds exactly one entry's markup.
    const blocks = html.split(/(?=<(?:a|div) class="masa-card")/g);
    const launches: AnimeVfLaunch[] = [];

    for (const block of blocks) {
      const opening = block.match(/^<(?:a|div) class="masa-card"[^>]*>/)?.[0];
      if (!opening) continue;
      const date = opening.match(/data-date="([^"]*)"/)?.[1];
      const platform = opening.match(/data-pl="([^"]*)"/)?.[1];
      const type = opening.match(/data-ty="([^"]*)"/)?.[1];
      const lang = opening.match(/data-lg="([^"]*)"/)?.[1] ?? "";
      const titleRaw = block.match(/class="masa-title">([^<]*)</)?.[1]?.trim();
      if (!date || !titleRaw) continue;

      launches.push({
        title: decodeHtmlEntities(titleRaw),
        platform: platform ?? "",
        launchDate: date,
        vostfrOnly: lang === "vostfr",
        type: type ?? "",
      });
    }
    return launches;
  } catch {
    return [];
  }
}

async function loadLaunches(): Promise<AnimeVfLaunch[]> {
  const cache = getCache("Anime VF calendar (mang-actu.com)", CACHE_TTL_MS);
  const cached = cache.get<AnimeVfLaunch[]>(SOURCE_URL);
  if (cached !== undefined) return cached;
  const launches = await scrape();
  cache.set(SOURCE_URL, launches);
  return launches;
}

const MATCH_THRESHOLD = 0.72;

/** Best-effort fuzzy match of a library series title against the scraped calendar. */
export async function findAnimeVfLaunch(seriesTitle: string): Promise<AnimeVfLaunch | null> {
  const launches = await loadLaunches();
  let best: AnimeVfLaunch | null = null;
  let bestScore = 0;
  for (const l of launches) {
    const score = titleSimilarity(seriesTitle, l.title);
    if (score >= MATCH_THRESHOLD && score > bestScore) {
      best = l;
      bestScore = score;
    }
  }
  return best;
}

export async function allAnimeVfLaunches(): Promise<AnimeVfLaunch[]> {
  return loadLaunches();
}
