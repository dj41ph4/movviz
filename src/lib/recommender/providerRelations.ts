import path from "node:path";
import { getCache } from "@/lib/cache/registry";
import { getWatchProviders, getTitleOriginCountries } from "@/lib/metadata/tmdb";
import { ProgressiveCache } from "./progressiveCache";
import { getRecommendationPool, recommendationsPending } from "./engine";
import type { MetaSearchResult } from "@/lib/metadata/types";
import { subscribeToRecommendationKeys, recommendationKeyReady } from "./updates";
const dataDir = process.env.MOVVIZ_CONFIG_DIR ?? process.env.MOVVIZ_DATA_DIR ?? path.join(process.cwd(), ".movviz-data");
const cache = getCache("recommendationProviders:v1", 24 * 60 * 60 * 1000, path.join(dataDir, "recommendation-providers.json"), 100_000);
const globals = globalThis as typeof globalThis & {
  __movvizRecommendationProviders?: ProgressiveCache<number[]>;
  __movvizRecommendationOrigins?: ProgressiveCache<string[]>;
};
const origins = globals.__movvizRecommendationOrigins ??= new ProgressiveCache<string[]>(
  (key) => cache.get<string[]>(`origin:${key}`),
  (key, value) => { cache.set(`origin:${key}`, value); recommendationKeyReady(`origin:${key}`); },
  async (key) => {
    const [type, id] = key.split(":");
    return getTitleOriginCountries(type as "movie" | "series", Number(id));
  });
const providers = globals.__movvizRecommendationProviders ??= new ProgressiveCache<number[]>(
  (key) => cache.get<number[]>(key), (key, value) => { cache.set(key, value); recommendationKeyReady(`provider:${key}`); }, async (key) => {
    const [type, region, id] = key.split(":");
    const values = await getWatchProviders(type as "movie" | "series", Number(id), region, false);
    return values.map((p) => p.providerId);
  });

/** Availability is public metadata, ranking/history remain strictly per user.
 * Filter ALL candidates, never just the first 20/200 generic suggestions. */
export async function getProviderRelationPool(userId: string, type: "movie" | "series", providerId: number, region: string, originCountries?: string[]) {
  const pool = await getRecommendationPool(userId, type);
  const keys = pool.map((item) => `${type}:${region}:${item.tmdbId}`);
  subscribeToRecommendationKeys(userId, keys.map((key) => `provider:${key}`));
  const memberships = await providers.read(keys);
  let results = selectProviderCandidates(pool, memberships, type, region, providerId);
  const originKeys = originCountries?.length ? results.map((item) => `${type}:${item.tmdbId}`) : [];
  if (originKeys.length) {
    subscribeToRecommendationKeys(userId, originKeys.map((key) => `origin:${key}`));
    const countries = await origins.read(originKeys);
    results = results.filter((item) => countries.get(`${type}:${item.tmdbId}`)?.some((country) => originCountries!.includes(country)));
  }
  return { results, pending: providers.hasPending(keys) || origins.hasPending(originKeys) || recommendationsPending(userId) };
}

export function selectProviderCandidates(pool: MetaSearchResult[], memberships: Map<string, number[]>, type: "movie" | "series", region: string, providerId: number) {
  return pool.filter((item) => memberships.get(`${type}:${region}:${item.tmdbId}`)?.includes(providerId));
}
