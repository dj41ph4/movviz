import type { PremiumProvider, PremiumTrailerCandidate } from "./types";
import { trustedChannelForProvider } from "./types";
import { searchYoutubeRaw, detectContentType, detectRestoration, detectLanguage } from "./youtubeSearch";
import { titleSimilarity } from "@/lib/library/matching";

const MIN_TITLE_SIMILARITY = 0.85;

function yearScore(candidateTitle: string, year: number | null): number {
  if (year == null) return 0.5;
  const m = candidateTitle.match(/\b(19\d{2}|20\d{2})\b/);
  if (!m) return 0.3; // no year in title — weak signal, not reject
  const y = parseInt(m[1], 10);
  if (y === year) return 1;
  if (Math.abs(y - year) === 1) return 0.8;
  return 0; // wrong year => reject
}

export async function resolveForProvider(
  provider: PremiumProvider,
  title: string,
  originalTitle: string | null,
  year: number | null,
  locale: string,
): Promise<PremiumTrailerCandidate[]> {
  const trusted = trustedChannelForProvider(provider);
  // If placeholder still present, we still attempt search but filter will drop everything — safe.
  // Build conservative query variants: localized + year, original + year, localized alone
  const queries: string[] = [];
  const add = (q: string) => {
    const v = q.trim().replace(/\s+/g, " ");
    if (v && !queries.includes(v)) queries.push(v);
  };
  // Restoration-aware terms increase hit rate on these archival channels
  const restorationSuffix = "bande annonce restauree remastered re-trailer hd";
  if (title) {
    if (year) add(`${title} ${year} ${restorationSuffix}`);
    add(`${title} ${restorationSuffix}`);
    add(title);
  }
  if (originalTitle && originalTitle !== title) {
    if (year) add(`${originalTitle} ${year} trailer restored remastered`);
    add(`${originalTitle} trailer`);
  }

  const all: PremiumTrailerCandidate[] = [];
  // Sequential queries would be slow — but per-provider we run its own queries sequentially with short timeout;
  // resolver runs providers in parallel, so total remains bounded.
  for (const q of queries.slice(0, 2)) { // limit to 2 queries per provider to stay within 3s global deadline
    const raws = await searchYoutubeRaw(q);
    for (const r of raws) {
      if (trusted && r.channelId !== trusted.channelId) continue;
      // Title similarity gate
      const titleScore = Math.max(
        titleSimilarity(title, r.title),
        originalTitle ? titleSimilarity(originalTitle, r.title) : 0,
      );
      if (titleScore < MIN_TITLE_SIMILARITY) continue;
      const contentType = detectContentType(r.title);
      if (!contentType) continue; // reject clip/featurette etc.
      const ys = yearScore(r.title, year);
      if (ys === 0) continue; // wrong remake year
      const restoration = detectRestoration(r.title);
      const language = detectLanguage(r.title, locale);
      const confidence = (titleScore * 0.6) + (ys * 0.3) + (restoration !== "unknown" ? 0.1 : 0);
      // Height unknown at this stage — probe will filter <1080 later
      all.push({
        kind: "youtube",
        provider,
        key: r.key,
        title: r.title,
        channelId: r.channelId,
        channelTitle: r.channelTitle,
        contentType,
        language,
        restoration,
        titleScore,
        yearScore: ys,
        confidence,
      });
    }
    if (all.length >= 4) break; // enough candidates for this provider
  }
  // Deduplicate by key within provider
  const seen = new Map<string, PremiumTrailerCandidate>();
  for (const c of all) {
    const k = c.kind === "youtube" ? c.key : (c as any).source?.url;
    if (!seen.has(k) || (c.confidence > (seen.get(k) as any).confidence)) seen.set(k, c);
  }
  return [...seen.values()];
}
