import type { MetaSearchResult } from "@/lib/metadata/types";

/** Stable 0..1 confidence/traction signal. Popularity reacts quickly to a
 * new release while vote count prevents a tiny, obscure sample from beating
 * an established title. Neither language nor country is considered. */
export function audienceSignal(item: Pick<MetaSearchResult, "popularity" | "voteCount">): number {
  const popularity = Math.min(1, Math.log1p(Math.max(0, item.popularity ?? 0)) / Math.log(201));
  const votes = Math.min(1, Math.log1p(Math.max(0, item.voteCount ?? 0)) / Math.log(10_001));
  return popularity * 0.65 + votes * 0.35;
}
