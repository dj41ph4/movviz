import type { PremiumTrailerCandidate } from "./types";
import { classifyHeight } from "./youtubeProbe";

export function rankPremiumCandidates(candidates: PremiumTrailerCandidate[], opts: { locale: string; originalLanguage?: string | null; context: "carousel" | "details" }): PremiumTrailerCandidate[] {
  // Hard filters already applied before ranking: trusted channel, title match, year, type, height>=1080
  // Scoring:
  // +30 user language, +15 original language, +10 other movviz language, +5 rest
  // +20 restoration explicite (restored/remastered), +15 re-trailer, +10 hd-master
  // +15 4K, +10 QHD, +5 FHD
  // +10 official/trusted provider (all are trusted by whitelist)
  // + titleConfidence*10 + yearConfidence*5
  const scored = candidates.map((c) => {
    let score = 0;
    // Language
    if (c.language === opts.locale) score += 30;
    else if (c.language === opts.originalLanguage) score += 15;
    else if (c.language && ["fr", "en", "it", "nl", "de"].includes(c.language)) score += 10;
    else if (c.language) score += 5;
    else {
      // null language — slightly prefer if locale is en (VO often unlabeled)
      if (opts.locale === "en") score += 8;
    }
    // Restoration
    if (c.restoration === "restored") score += 20;
    else if (c.restoration === "remastered") score += 20;
    else if (c.restoration === "re-trailer") score += 15;
    else if (c.restoration === "hd-master") score += 10;
    // Quality
    const h = c.kind === "youtube" ? c.height : c.source.height;
    const cls = classifyHeight(h);
    if (cls === "4K") score += 15;
    else if (cls === "QHD") score += 10;
    else if (cls === "FHD") score += 5;
    // Provider is trusted by definition, +5
    score += 5;
    // Title/year confidence
    score += c.titleScore * 10;
    score += c.yearScore * 5;
    score += c.confidence * 5;

    // Context: carousel prefers teaser, details prefers trailer
    // This is applied as tie-breaker after scoring — but spec says within premium layer,
    // respect context. We sort by context-preferred type first, then score.
    const typeRank = opts.context === "carousel"
      ? c.contentType === "teaser" ? 0 : 1
      : c.contentType === "trailer" ? 0 : 1;

    return { c, score, typeRank };
  });

  scored.sort((a, b) => {
    if (a.typeRank !== b.typeRank) return a.typeRank - b.typeRank;
    if (b.score !== a.score) return b.score - a.score;
    return b.c.confidence - a.c.confidence;
  });

  return scored.map((s) => s.c);
}

export function deduplicateCandidates(candidates: PremiumTrailerCandidate[]): PremiumTrailerCandidate[] {
  const seen = new Map<string, PremiumTrailerCandidate>();
  for (const c of candidates) {
    const key = c.kind === "youtube" ? `yt:${c.key}` : `direct:${c.source.url}`;
    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, c);
    } else {
      // Keep higher confidence
      if (c.confidence > existing.confidence) seen.set(key, c);
    }
  }
  return [...seen.values()];
}
