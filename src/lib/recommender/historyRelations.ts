import path from "node:path";
import { getCache } from "@/lib/cache/registry";
import { getMovieRecommendations, getTvRecommendations, getMovieSimilar, getTvSimilar, getGenreProfile, discoverByFilters } from "@/lib/metadata/tmdb";
import { crossTypeBridgeFilters } from "./crossType";
import { ProgressiveCache } from "./progressiveCache";
import type { MetaSearchResult } from "@/lib/metadata/types";
import type { Seed } from "./seedBuilder";
import { subscribeToRecommendationKeys, recommendationKeyReady } from "./updates";

type Relations = { recommendations: MetaSearchResult[]; similar: MetaSearchResult[]; bridge: MetaSearchResult[] };
const dataDir = process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data");
const cache = getCache("historyRelations:v1", 30 * 24 * 60 * 60 * 1000, path.join(dataDir, "history-relations.json"), 50_000);
const globals = globalThis as typeof globalThis & { __movvizHistoryRelations?: ProgressiveCache<Relations> };
export const historyRelations = globals.__movvizHistoryRelations ??= new ProgressiveCache<Relations>(
  (key) => cache.get<Relations>(key), (key, value) => { cache.set(key, value); recommendationKeyReady(key); }, async (key) => {
    const [rawType, rawId] = key.split(":");
    const type = rawType as "movie" | "series";
    const id = Number(rawId);
    const [recommendations, similar, profile] = await Promise.all([
      type === "movie" ? getMovieRecommendations(id) : getTvRecommendations(id),
      type === "movie" ? getMovieSimilar(id) : getTvSimilar(id), getGenreProfile(type, id),
    ]);
    // TMDb's null/error fallback has totalPages=0: don't persist a false empty.
    if (recommendations.totalPages === 0 && similar.totalPages === 0) return null;
    const filters = profile ? crossTypeBridgeFilters(type, profile) : null;
    const opposite = type === "movie" ? "series" : "movie";
    const bridge = filters ? await discoverByFilters(opposite, { ...filters, sort: "vote_average.desc" }) : null;
    return { recommendations: recommendations.results, similar: similar.results, bridge: bridge?.results ?? [] };
  });

export async function readHistoryRelations(type: "movie" | "series", seeds: Seed[], userId: string) {
  subscribeToRecommendationKeys(userId, seeds.map((s) => `${type}:${s.tmdbId}`));
  const values = await historyRelations.read(seeds.map((s) => `${type}:${s.tmdbId}`));
  return seeds.flatMap((seed) => {
    const relations = values.get(`${type}:${seed.tmdbId}`);
    return relations ? [{ seed, relations }] : [];
  });
}
